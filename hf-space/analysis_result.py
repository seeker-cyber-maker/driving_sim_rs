"""Convert bounded native observations into portable, byte-bound analysis files.

No selection is performed here: native snapshots were taken before turnover.
"""
import copy
import gzip
import hashlib
import json
import math
import struct
import uuid
from pathlib import Path

MAX_ANALYSIS_BYTES = 256 * 1024 * 1024
METRIC_NAMES = ('total_score','total_speed','total_abs_steering','total_actual_distance',
    'total_drifting_amount','total_momentum_change_frequency','total_throttle_change_frequency',
    'total_braking_frequency','total_distance_from_wall','total_distance_from_center',
    'network_novelty','collision_count','best_lap_performance','total_racing_line_efficiency')
AVERAGE = set(METRIC_NAMES[:10])
AVERAGE_ONLY = {'total_abs_steering','total_momentum_change_frequency','total_throttle_change_frequency',
    'total_braking_frequency','total_distance_from_wall','total_distance_from_center'}
CHANNELS = [{'metric':metric,'type':kind} for metric in METRIC_NAMES for kind in ('default','average')
    if not (kind=='default' and metric in AVERAGE_ONLY) and not (kind=='average' and metric not in AVERAGE)]
ROLES = ('fitness','fastest_lap','clean_laps')

def encoded(value):
    return json.dumps(value,allow_nan=False,separators=(',',':')).encode()

def bounded_read(path,limit=MAX_ANALYSIS_BYTES):
    path=Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_size>limit:
        raise ValueError('Invalid or oversized native analysis file')
    with path.open('rb') as stream:data=stream.read(limit+1)
    if len(data)>limit:raise ValueError('Native analysis exceeds complete artifact limit')
    return data

def parsed(data):
    return json.loads(data,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite native analysis')))

def parameter_hash(network):
    params=[]
    for matrix,bias in zip(network['weights'],network['biases']):
        params.extend(value for row in matrix for value in row)
        params.extend(bias)
    return hashlib.sha256(b''.join(struct.pack('<d',value) for value in params)).hexdigest()

def file_descriptor(name,data):
    return {'name':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def checked_row(row,generation,car):
    if not isinstance(row,dict) or row.get('schema')!=1 or row.get('generation')!=generation or row.get('car')!=car:
        raise ValueError('Missing or reordered native observations')
    if row.get('candidate_id')!=f'g{generation:06}-c{car:06}':raise ValueError('Native candidate identity mismatch')
    if set(row.get('raw_metrics',{}))!=set(METRIC_NAMES):raise ValueError('Incomplete native raw metrics')
    channels=row.get('channels')
    keys=('values','population_relative','unavailable_reasons')
    if not isinstance(channels,dict) or set(channels)!=set(keys) or any(not isinstance(channels[k],list) or len(channels[k])!=18 for k in keys):
        raise ValueError('Incomplete native channels')
    for value,rank,reason in zip(*(channels[k] for k in keys)):
        for number in (value,rank):
            if number is not None and (type(number) not in (int,float) or not math.isfinite(number)):
                raise ValueError('Invalid native measurement')
        if value is None:
            if rank is not None or not isinstance(reason,str) or not reason:raise ValueError('Missing channel fabricated')
        elif rank is None or not 0<=rank<=1 or reason is not None:raise ValueError('Invalid native channel rank')
    return row

def assemble_analysis(out,template,primary,network_bytes,track_bytes,config,backend,validator):
    native_dir=Path(out)/'analysis'
    native=parsed(bounded_read(native_dir/'analysis.json',1024*1024))
    if native.get('schema')!='ald.native-analysis' or native.get('version')!=1 or native.get('mode')!=config['mode']:
        raise ValueError('Native analysis contract unavailable')
    descriptors=bounded_read(native_dir/'descriptors.jsonl')
    population=1 if config['mode']=='evaluate' else config['population']
    generations=1 if config['mode']=='evaluate' else config['generations']
    expected=population*generations
    winner_rows=native.get('winners',{})
    if set(winner_rows)!=set(ROLES):raise ValueError('Incomplete native winner categories')
    selected_ids={r['candidate_id']:r for r in winner_rows.values() if r is not None}
    seen_selected=set();count=0;evaluation_row=None
    # Stream rows instead of retaining every decoded population in memory.
    import io
    for line in io.BytesIO(descriptors):
        if not line.strip():raise ValueError('Empty native descriptor row')
        count+=1
        if count>expected:raise ValueError('Extra native observations')
        row=checked_row(parsed(line),(count-1)//population+1,(count-1)%population)
        if row['candidate_id'] in selected_ids:
            if row!=selected_ids[row['candidate_id']]:raise ValueError('Winner observation not in descriptor stream')
            seen_selected.add(row['candidate_id'])
        if config['mode']=='evaluate':evaluation_row=row
    if count!=expected or native.get('rows')!=count or set(selected_ids)!=seen_selected:
        raise ValueError('Incomplete native analysis')
    files={'descriptors.jsonl':descriptors}
    conditions={'track_sha256':hashlib.sha256(track_bytes).hexdigest(),
        'network_sha256':hashlib.sha256(network_bytes).hexdigest(),'vehicle_type':template['Type'],
        'requested_ticks':config['ticks'],'control_hz':config['control_hz'],
        'collision':config['collision'],'idle':config['idle'],'math_profile':'proton','clean_min_laps':config['clean_min_laps']}
    winners={}
    for role,row in winner_rows.items():
        metadata={'status':'unavailable','reason':('frozen_evaluation_does_not_select_winners' if config['mode']=='evaluate'
            else 'no_completed_lap' if role=='fastest_lap' else 'no_eligible_clean_laps'),
            'candidate_id':None,'generation':None,'car':None,'selection_fitness':None,
            'best_lap_seconds':None,'forward_laps':None,'physical_contacts':None,'collision_updates':None,
            'total_actual_distance':None,'artifact':None}
        if row is not None:
            if config['mode']!='train':raise ValueError('Frozen evaluation selected a winner')
            objective=row['objectives'];lap=objective['best_lap_seconds']
            if role=='fitness' and row['generation']!=generations:raise ValueError('Fitness winner is not final population')
            if role!='fitness' and (lap is None or lap<=0 or objective['forward_laps']<1):raise ValueError('Winner did not complete a lap')
            if role=='clean_laps' and (objective['forward_laps']<config['clean_min_laps'] or objective['physical_contacts']!=0):
                raise ValueError('Clean winner not eligible')
            selected=parsed(bounded_read(native_dir/'winners'/f'{role}.json',1024*1024))
            if selected.get('observation')!=row or parameter_hash(selected)!=row['weights_sha256']:
                raise ValueError('Selected weights do not match observed controller')
            game=copy.deepcopy(template)
            game['NeuralNetwork']['Weights']=selected['weights'];game['NeuralNetwork']['Biases']=selected['biases']
            if role=='fitness':data=primary
            else:
                game['Id']=str(uuid.uuid4());game['Name']='HF '+('fastest lap' if role=='fastest_lap' else 'clean laps')+' winner'
                data=gzip.compress(encoded(game),mtime=0)
            checked=validator(data)
            observed={'weights':checked['NeuralNetwork']['Weights'],'biases':checked['NeuralNetwork']['Biases']}
            if parameter_hash(observed)!=row['weights_sha256']:raise ValueError('Game export changed selected weights')
            name=f'winners/{role}.evolution';files[name]=data
            metadata.update(status='available',reason=None,candidate_id=row['candidate_id'],generation=row['generation'],car=row['car'],
                selection_fitness=row['selection_fitness'],artifact=file_descriptor(name,data),**objective)
            metadata.pop('active',None)
        winners[role]=metadata
    if config['mode']=='train' and winners['fitness']['status']!='available':raise ValueError('Missing fitness winner')
    summary={'schema':'ald.run-analysis','version':1,'mode':config['mode'],'execution_backend':backend,
        'conditions':conditions,'observations':{'generations':generations,'cars':count,'raw_metric_count':14,'reward_channel_count':18},
        'winners':winners,'semantics':{
            'fitness':'Final evaluated population leader; rank fitness is relative to that population',
            'fastest_lap':'Run-global positive completed lap; earliest generation/car breaks ties',
            'clean_laps':'Run-global zero physical contacts and required forward laps; fastest eligible lap; earliest generation/car breaks ties',
            'channels':'Unsigned ranks within the observed population; averages divide by 0.1 * stats updates; null is unavailable',
            'collision_count':'Reward collision updates differ from physical contacts',
            'training':'Training reuses physical vehicle state between generations; winner observations need not equal a fresh replay',
            'evaluation':'Fresh cars, exact fixed weights, no reproduction/mutation/decay; novelty is relative to the evaluation population'}}
    analysis={**summary,'metric_names':list(METRIC_NAMES),'reward_channels':CHANNELS,'settings':config,
        'descriptors':{**file_descriptor('descriptors.jsonl',descriptors),'rows':count}}
    files['analysis.json']=encoded(analysis)
    evaluation=None
    if config['mode']=='evaluate':
        original={'weights':template['NeuralNetwork']['Weights'],'biases':template['NeuralNetwork']['Biases']}
        if evaluation_row['weights_sha256']!=parameter_hash(original) or primary!=network_bytes or evaluation_row['selection_fitness'] is not None:
            raise ValueError('Frozen evaluation altered input policy')
        evaluation={'schema':'ald.frozen-evaluation','version':1,'conditions':conditions,
            'input_sha256':hashlib.sha256(network_bytes).hexdigest(),'weights_unchanged':True,'measurements':evaluation_row}
        files['evaluation.json']=encoded(evaluation)
    if sum(map(len,files.values()))>MAX_ANALYSIS_BYTES:raise ValueError('Complete analysis exceeds 256 MiB; no truncation')
    return files,summary,evaluation
