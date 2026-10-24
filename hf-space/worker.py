"""Bounded native adapter. No engine modifications; no network calls.

The adapter validates the vanilla game network envelope before native dispatch.
"""
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess
import struct
import tempfile
import time
import uuid
from training_config import validate_config
from build_info import build_identity
from analysis_result import assemble_analysis
from star_check import check_ticks, needs_observations, resolve_check

MODULE_DIR = Path(__file__).resolve().parent
# Source checkout is nested; a hosted release is flat under /app. Deployment
# supplies explicit binary/template paths, so importing must not assume depth.
ROOT = MODULE_DIR.parent.parent if MODULE_DIR.name=='hf' and MODULE_DIR.parent.name=='integrations' else MODULE_DIR

def read_json(data):
    if len(data)>1024*1024: raise ValueError('Input exceeds 1 MB')
    if data[:2]==b'\x1f\x8b':
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
            data=stream.read(4*1024*1024+1)
    if len(data)>4*1024*1024: raise ValueError('Expanded input exceeds 4 MB')
    result=json.loads(data,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
    if not isinstance(result,dict): raise ValueError('Expected JSON object')
    return result

OUTPUT_NAMES = ('Steering', 'Acceleration', 'Handbrake', 'Brake', 'Boost')
VEHICLE_NAMES = ('Formula', 'Rally', 'Snowmobile', 'Truck')
SCALAR_SENSORS = {'speed', 'velocityFront', 'velocitySide', 'angularVelocity',
                  'wheelAngle', 'boostCapacity', 'correctDirection'}

def sensor_input(sensor):
    if not isinstance(sensor, dict): raise ValueError('Sensor object required')
    kind = sensor.get('$type')
    if not isinstance(kind, str): raise ValueError('Sensor type required')
    clean = {'$type': kind}
    def number(key, default=None, positive=False):
        value = sensor.get(key, default)
        if type(value) not in (int, float) or not math.isfinite(value) or abs(value)>1e6:
            raise ValueError('Invalid sensor parameter '+key)
        # The simulator converts descriptor values to float32 before use.
        if positive and (value<=0 or struct.unpack('f', struct.pack('f', value))[0]<=0):
            raise ValueError('Positive sensor parameter required: '+key)
        clean[key] = value
        return value
    if kind in SCALAR_SENSORS: return clean
    if kind == 'raycast':
        if not -360<=number('Degrees')<=360: raise ValueError('Degrees')
        if not 1<=number('Length')<=10000: raise ValueError('Length')
    elif kind in ('accelerationFront', 'accelerationSide'):
        number('MaxAcceleration', 10 if kind=='accelerationFront' else 12, positive=True)
    elif kind == 'distanceFromWall': number('MaxDistance', 150, positive=True)
    elif kind == 'trackCurvature':
        number('MinLookaheadDistance', 256)
        number('MaxLookaheadDistance', 512)
    elif kind == 'grip':
        offset = sensor.get('PositionOffset', {})
        if isinstance(offset, dict): coords = [offset.get('X',0), offset.get('Y',0)]
        elif isinstance(offset, list) and len(offset)==2: coords = offset
        else: raise ValueError('Grip offset must have two components')
        if any(type(n) not in (int,float) or not math.isfinite(n) or abs(n)>1e6 for n in coords):
            raise ValueError('Invalid grip offset')
        clean['PositionOffset'] = {'X':coords[0], 'Y':coords[1]}
    else: raise ValueError('Unsupported sensor type')
    return clean

def network_input(data):
    value=read_json(data)
    network=value['NeuralNetwork']; shape=network['Shape']; outputs=value.get('Outputs')
    vehicle_type=value.get('Type')
    if type(vehicle_type) is not int or not 0<=vehicle_type<len(VEHICLE_NAMES):
        raise ValueError('Vehicle Type must be Formula (0), Rally (1), Snowmobile (2), or Truck (3)')
    if (not isinstance(outputs,list) or not 1<=len(outputs)<=5 or
        any(type(n) is not int or not 0<=n<5 for n in outputs) or len(set(outputs))!=len(outputs)):
        raise ValueError('Use an ordered unique subset of the five game outputs')
    if vehicle_type!=0 and not {0,1}.issubset(outputs):
        raise ValueError('Rally, Snowmobile, and Truck networks require Steering and Acceleration outputs')
    if vehicle_type==2 and 2 in outputs:
        raise ValueError('Snowmobile Handbrake output is unavailable in the original game editor')
    if (not isinstance(shape,list) or not 2<=len(shape)<=12 or
        any(type(n) is not int or n<1 for n in shape) or shape[0]>20 or
        any(n>16 for n in shape[1:-1]) or shape[-1]!=len(outputs)):
        raise ValueError('Shape: up to 20 inputs, 10 hidden layers of 16, and 1–5 outputs')
    sensors=value['Sensors']
    if not isinstance(sensors,list) or len(sensors)!=shape[0]: raise ValueError('Sensor count')
    clean_sensors=[sensor_input(sensor) for sensor in sensors]
    rays=sum(s['$type']=='raycast' for s in clean_sensors)
    if rays>13 or len(sensors)-rays>7: raise ValueError('Use up to 13 vision and 7 other sensors')
    weights,biases=network['Weights'],network['Biases']
    if not isinstance(weights,list) or not isinstance(biases,list) or len(weights)!=len(shape)-1 or len(biases)!=len(shape)-1:
        raise ValueError('Layer count')
    for i,(a,b) in enumerate(zip(shape,shape[1:])):
        if (not isinstance(weights[i],list) or len(weights[i])!=a or
            any(not isinstance(row,list) or len(row)!=b for row in weights[i]) or
            not isinstance(biases[i],list) or len(biases[i])!=b): raise ValueError('Dimensions')
        for n in [x for row in weights[i] for x in row]+biases[i]:
            if type(n) not in (int,float) or not math.isfinite(n) or abs(n)>1e6: raise ValueError('Weight value')
    return {'Id':str(uuid.uuid4()),'Stats':{'Generations':[]},'Snapshots':[],
            'Type':vehicle_type,'Outputs':outputs[:],'Sensors':clean_sensors,
            'Name':'HF candidate','NeuralNetwork':{'Shape':shape,'InputShape':shape[0],'OutputShape':shape[-1],
                'NeuronsCount':sum(shape),'TotalParams':sum((a+1)*b for a,b in zip(shape,shape[1:])),
                'Weights':weights,'Biases':biases}}

def check_freeze_shape(freeze,shape):
    """Resolve selection against this policy, with at least one trainable parameter."""
    if any(layer>=len(shape)-1 for layer in freeze['layers']):
        raise ValueError('Frozen hidden layer exceeds network shape')
    if any(index>=shape[0] for index in freeze['inputs']):
        raise ValueError('Frozen input exceeds sensor count')
    if any(index>=shape[-1] for index in freeze['outputs']):
        raise ValueError('Frozen output exceeds output count')
    layers=set(freeze['layers']);inputs=set(freeze['inputs']);outputs=set(freeze['outputs'])
    trainable=0
    last=len(shape)-2
    for layer,(source_count,dest_count) in enumerate(zip(shape,shape[1:])):
        for source in range(source_count):
            for dest in range(dest_count):
                if not (layer+1 in layers or layer==0 and source in inputs or layer==last and dest in outputs):
                    trainable+=1
        for dest in range(dest_count):
            if not (layer+1 in layers or layer==last and dest in outputs):
                trainable+=1
    if not trainable:
        raise ValueError('Freeze selection leaves no trainable parameters; use frozen evaluation')

def verify_frozen_parameters(freeze,starting,trained):
    """Never publish a result whose native candidate violates the requested mask."""
    layers=set(freeze['layers']);inputs=set(freeze['inputs']);outputs=set(freeze['outputs'])
    last=len(starting['Shape'])-2
    for layer,matrix in enumerate(starting['Weights']):
        for source,row in enumerate(matrix):
            for dest,value in enumerate(row):
                if (layer+1 in layers or layer==0 and source in inputs or layer==last and dest in outputs):
                    if value!=trained['weights'][layer][source][dest]:
                        raise ValueError('Native trainer changed a frozen weight')
        for dest,value in enumerate(starting['Biases'][layer]):
            if layer+1 in layers or layer==last and dest in outputs:
                if value!=trained['biases'][layer][dest]:
                    raise ValueError('Native trainer changed a frozen bias')

def track_input(data):
    value=read_json(data)
    challenges=value.get('Challenges',[])
    if not isinstance(challenges,list) or len(challenges)>64:
        raise ValueError('Track supports at most 64 challenge definitions')
    for challenge in challenges:
        if (not isinstance(challenge,dict) or not isinstance(challenge.get('$type'),str)
            or not 1<=len(challenge['$type'])<=96):
            raise ValueError('Invalid track challenge type')
        for key,limit in (('Text',2048),('Id',128)):
            if key in challenge and (not isinstance(challenge[key],str) or len(challenge[key])>limit):
                raise ValueError('Invalid track challenge label')
    tiles=value['Tiles']
    if not isinstance(tiles,dict) or not 4<=len(tiles)<=256: raise ValueError('Track tile limit')
    start=value.get('StartTileConnection')
    if not isinstance(start,dict): raise ValueError('StartTileConnection must be an object')
    # Match the local runner's saved-track import: game files can omit default Type.
    # Normalize only this parsed copy; never rewrite the uploaded source bytes.
    if 'Type' not in start: start['Type']=0
    elif type(start['Type']) is not int: raise ValueError('StartTileConnection.Type must be an integer')
    return value

def native_environment(gpu_library=None):
    env={'PATH':'/usr/bin:/bin','LANG':'C','RUST_BACKTRACE':'0'}
    if gpu_library is not None:
        library=Path(gpu_library).resolve()
        if not library.is_file(): raise RuntimeError('CUDA library unavailable')
        # Device/loader plumbing from an active lease, never provider credentials.
        for key in ('LD_LIBRARY_PATH','LD_PRELOAD','CUDA_VISIBLE_DEVICES','NVIDIA_VISIBLE_DEVICES'):
            if key in os.environ: env[key]=os.environ[key]
        env['ALTD_GPU_LIB']=str(library)
    return env

def best_run_lap(history):
    # Native best_lap_s is generation-local. Include the independently logged
    # all-time value and prior generations, never a non-finite sentinel.
    values = [row.get(key) for row in history for key in ('best_lap_s', 'all_time_best_lap_s')]
    laps = [v for v in values if type(v) in (int, float) and math.isfinite(v) and v > 0]
    return min(laps) if laps else None

def vehicle_scene_template(scene_template, vehicle_type):
    if type(vehicle_type) is not int or not 0<=vehicle_type<len(VEHICLE_NAMES):
        raise ValueError('Unsupported vehicle Type')
    formula=Path(scene_template or ROOT/'assets/formula_template.json').resolve()
    if vehicle_type==0:return formula
    name=VEHICLE_NAMES[vehicle_type].lower()
    # Only the application-supplied Formula path determines the sibling asset
    # directory; uploaded JSON never supplies a template path.
    return (formula.parent/(name+'_template.json')).resolve()

def check_current_network(work, command, env, track, template, config, result, track_bytes, backend):
    """One independent fixed-weight check; its failure must not lose trained weights."""
    network_sha=hashlib.sha256(result).hexdigest()
    track_sha=hashlib.sha256(track_bytes).hexdigest()
    kwargs=dict(network_sha256=network_sha,track_sha256=track_sha,backend=backend)
    if not needs_observations(track,track_sha):
        return resolve_check(track,template,config,[],**kwargs)
    check_command=list(command)
    if '--freeze-spec' in check_command:
        index=check_command.index('--freeze-spec')
        del check_command[index:index+2]
    def option(name,value):
        check_command[check_command.index(name)+1]=str(value)
    n=template['NeuralNetwork']
    policy=work/'star-policy.json'
    # The template contains the exported final leader after training, or the
    # exact input weights after evaluation. No random population is initialized.
    policy.write_text(json.dumps({'shape':n['Shape'],'weights':n['Weights'],'biases':n['Biases'],
        'inputs':[f'sensor-{i}' for i in range(n['Shape'][0])],
        'outputs':[OUTPUT_NAMES[i] for i in template['Outputs']]},allow_nan=False))
    star_out=work/'star-result'
    for key,value in (('--network',policy),('--init-network',policy),('--out-dir',star_out),
                      ('--population',1),('--generations',1),('--ticks',check_ticks(track,config)),
                      ('--mutation-start',0),('--mutation-end',0)):
        option(key,value)
    if '--evaluate-frozen' not in check_command:check_command.append('--evaluate-frozen')
    check_command.append('--challenge-observations')
    try:
        subprocess.run(check_command,cwd=work,env=env,stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL,timeout=25,check=True)
        from analysis_result import bounded_read, parsed
        meta=parsed(bounded_read(star_out/'challenge-observations-meta.json',32*1024))
        rows=bounded_read(star_out/'challenge-observations.jsonl',4*1024*1024)
        observations=[parsed(line) for line in rows.splitlines()]
        if (meta.get('schema')!='ald.challenge-observations' or meta.get('version')!=1
            or meta.get('execution_backend')!=backend or meta.get('mode')!='evaluate'
            or meta.get('frames')!=len(observations) or len(observations)>3001
            or meta.get('requested_ticks')!=check_ticks(track,config)
            or type(meta.get('lap_score')) not in (float,int) or not math.isfinite(meta['lap_score'])
            or meta['lap_score']<=0):
            raise ValueError('Invalid challenge observations')
        check_track=dict(track,LapScore=meta['lap_score'])
        return resolve_check(check_track,template,config,observations,**kwargs)
    except subprocess.TimeoutExpired:
        return resolve_check(track,template,config,[],error='The star check reached its time limit; trained weights are preserved.',**kwargs)
    except (OSError,subprocess.CalledProcessError,ValueError,KeyError,TypeError):
        return resolve_check(track,template,config,[],error='The star check could not obtain complete observations; trained weights are preserved.',**kwargs)

def run_native(track_bytes,network_bytes,*,binary=None,importer=None,scene_template=None,with_report=False,gpu_library=None,config=None):
    started=time.perf_counter()
    config=validate_config(config, work_limit=8_000_000 if gpu_library is not None else 4_000_000)
    track=track_input(track_bytes); template=network_input(network_bytes)
    if config['mode']=='train':check_freeze_shape(config['freeze'],template['NeuralNetwork']['Shape'])
    # Deployment paths are supplied by trusted application configuration, never uploads.
    binary=Path(binary or ROOT/'target/release/altd-sim').resolve()
    importer=Path(importer or ROOT/'target/release/examples/extract_saved_track').resolve()
    scene_template=vehicle_scene_template(scene_template,template['Type'])
    if not all(p.is_file() for p in (binary,importer,scene_template)):
        raise RuntimeError('Native tools or scene template unavailable')
    # No inherited provider tokens, credential paths, or caller-chosen commands.
    env=native_environment(gpu_library)
    with tempfile.TemporaryDirectory(prefix='tiga-native-') as directory:
        work=Path(directory)
        env.update(HOME=directory,TMPDIR=directory)
        def save(name,value):
            path=work/name; path.write_text(json.dumps(value,allow_nan=False)); return str(path)
        saved=save('track.json',track)
        scene=work/'scene.json'
        subprocess.run([str(importer),saved,'User track',str(scene_template),str(scene)],
            cwd=work,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,check=True)
        imported=json.loads(scene.read_text())
        spawn=save('spawn.json',{'frames':[{'position':imported['reset_position'],'rotation':imported['reset_rotation']}]})
        n=template['NeuralNetwork']; names=[f'sensor-{i}' for i in range(n['Shape'][0])]
        network=save('network.json',{'shape':n['Shape'],'weights':n['Weights'],'biases':n['Biases'],'inputs':names,'outputs':[OUTPUT_NAMES[i] for i in template['Outputs']]})
        model=save('model.json',{'sensor_layout':{'names':names,'sensors':template['Sensors']}})
        settings=save('settings.json',{'population':config['population'],'selection_algorithm':config['selection'],'selection_size':config['parents'],
            'crossover':config['crossover'],'mutation_rate':config['mutation'],'adaptive_mutation':config['adaptive_mutation'],'weight_decay':config['decay'],
            'preserve_parents':'on_custom','preserve_parents_size':config['elite'],
            'rewards':config['rewards']})
        out=work/'result'
        command=[str(binary),'--math-profile','proton','--threads',str(config['workers']),'train-scratch',
            '--scene',str(scene),'--spawn-trace',spawn,'--network',network,'--init-network',network,
            '--model',model,'--settings',settings,'--shape',','.join(map(str,n['Shape'])),
            '--population',str(config['population']),'--generations',str(config['generations']),
            '--ticks',str(config['ticks']),'--seed',str(config['seed']),'--batch-count','1',
            '--out-dir',str(out),'--mutation-start',str(config['mutation']),
            '--mutation-end',str(config['mutation'] if config['schedule']=='fixed' else config['mutation_end']),
            '--schedule','linear' if config['schedule']=='fixed' else config['schedule'],'--save-final-candidate',
            '--checkpoint-every','0','--analysis','--clean-min-laps',str(config['clean_min_laps']),
            '--eliminate-on-wall' if config['collision'] else '--no-eliminate-on-wall',
            '--idle-eliminate' if config['idle'] else '--no-idle-eliminate']
        if config['mode']=='train' and any(config['freeze'].values()):
            command.extend(('--freeze-spec',save('freeze.json',config['freeze'])))
        if config['mode']=='evaluate':command.append('--evaluate-frozen')
        if gpu_library is not None: command.append('--gpu')
        subprocess.run(command,cwd=work,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45 if gpu_library is not None else 25,check=True)
        if config['mode']=='train':
            candidate=out/'candidate.json'
            if candidate.stat().st_size>1024*1024: raise ValueError('Output too large')
            trained=json.loads(candidate.read_text())
            if any(config['freeze'].values()):verify_frozen_parameters(config['freeze'],n,trained)
            n['Weights']=trained['weights']; n['Biases']=trained['biases']
        result=(network_bytes if config['mode']=='evaluate' else gzip.compress(json.dumps(template,allow_nan=False).encode(),mtime=0))
        network_input(result)
        history=[json.loads(line) for line in (out/'log.jsonl').read_text().splitlines() if line.strip()]
        last=history[-1] if history else {}
        files,summary,evaluation=assemble_analysis(out,template,result,network_bytes,track_bytes,config,'cuda' if gpu_library is not None else 'cpu',network_input)
        stars=check_current_network(work,command,env,track,template,config,result,track_bytes,
                                    'cuda' if gpu_library is not None else 'cpu')
        files['stars.json']=json.dumps(stars,allow_nan=False,separators=(',',':')).encode()
        report={'mode':config['mode'],'analysis_summary':summary,'_analysis_files':files,'build':build_identity(),'state':'completed','elapsed_seconds':time.perf_counter()-started,
            'generations_completed':len(history),'generations_requested':config['generations'],'population':config['population'],
            'best_score':last.get('best_score'),'mean_score':last.get('mean_score'),
            'best_lap_seconds':best_run_lap(history),'best_lap_scope':'Best completed lap observed during this run; may belong to a different car than the exported candidate','lapped_cars':last.get('lapped_cars'),
            'simulated_ticks':last.get('simulated_ticks'),'requested_ticks':config['ticks'],
            'candidate_validated':True,'execution_backend':'cuda' if gpu_library is not None else 'cpu',
            'vehicle_type':template['Type'],'vehicle_name':VEHICLE_NAMES[template['Type']],
            'inputs':{'track_sha256':hashlib.sha256(track_bytes).hexdigest(),'network_sha256':hashlib.sha256(network_bytes).hexdigest()},
            'settings':config,'history':[{'generation':i+1,'mutation':h.get('mutation_rate'),
                'best_score':h.get('best_score'),'mean_score':h.get('mean_score'),'best_lap_seconds':h.get('best_lap_s'),
                'lapped_cars':h.get('lapped_cars'),'simulated_ticks':h.get('simulated_ticks')} for i,h in enumerate(history)]}
    # The context has removed input/intermediate files before result publication.
    return (result,report) if with_report else result

def run_reported(track_bytes,network_bytes,config=None):
    return run_native(track_bytes,network_bytes,with_report=True,config=config)
