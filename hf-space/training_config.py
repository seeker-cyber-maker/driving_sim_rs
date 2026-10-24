"""Settings contract shared by the CPU and leased GPU dispatch paths."""
import copy
import math

DEFAULTS={'mode':'train','clean_min_laps':2,'population':4,'generations':1,'ticks':60,'mutation':.01,'seed':42,
    'mutation_end':.01,'schedule':'fixed','selection':'best','parents':1,'elite':1,
    'crossover':'none','decay':0,'adaptive_mutation':False,'control_hz':60,'workers':1,
    'collision':False,'idle':False,'freeze':{'layers':[],'inputs':[],'outputs':[]},
    'rewards':[{'metric':'total_score','type':'default','weight':100}]}
METRICS={'total_score','total_speed','total_abs_steering','total_actual_distance',
    'total_drifting_amount','total_momentum_change_frequency','total_throttle_change_frequency',
    'total_braking_frequency','total_distance_from_wall','total_distance_from_center',
    'network_novelty','collision_count','best_lap_performance','total_racing_line_efficiency'}

def validate_freeze(value):
    """Check the settings envelope; the uploaded network supplies exact bounds."""
    if not isinstance(value,dict) or set(value)!={'layers','inputs','outputs'}:
        raise ValueError('Invalid freeze selection')
    result={}
    for key,low,high in (('layers',1,10),('inputs',0,19),('outputs',0,4)):
        items=value[key]
        if (not isinstance(items,list) or len(items)>high-low+1 or
            any(type(item) is not int or not low<=item<=high for item in items) or
            items!=sorted(set(items))):
            raise ValueError('Invalid frozen '+key)
        result[key]=items[:]
    return result

def validate_config(value=None, *, work_limit=4_000_000):
    if value is None:return copy.deepcopy(DEFAULTS)
    if not isinstance(value,dict) or set(value)-set(DEFAULTS):raise ValueError('Unexpected training settings')
    c={**copy.deepcopy(DEFAULTS),**value}
    if type(c['control_hz']) is not int or c['control_hz']!=60:
        raise ValueError('New training and evaluation runs require control_hz=60; historical records are not converted')
    bounds={'population':(1,1024,True),'generations':(1,2000,True),'ticks':(1,18000,True),
        'mutation':(0,4.2,False),'mutation_end':(0,4.2,False),'seed':(0,2147483647,True),
        'clean_min_laps':(1,100,True),'parents':(1,1024,True),'elite':(0,1024,True),'decay':(0,1,False),'workers':(1,4,True)}
    for key,(low,high,integer) in bounds.items():
        v=c[key]
        if type(v) not in (int,float) or not math.isfinite(v) or not low<=v<=high or (integer and type(v) is not int):raise ValueError('Invalid '+key)
    for key,choices in {'mode':('train','evaluate'),'schedule':('fixed','linear','geometric'),'selection':('best','tournament','roulette'),
                        'crossover':('none','single_point','uniform'),'control_hz':(60,)}.items():
        if c[key] not in choices or (key=='control_hz' and type(c[key]) is not int):raise ValueError('Invalid '+key)
    for key in ('adaptive_mutation','collision','idle'):
        if type(c[key]) is not bool:raise ValueError('Invalid '+key)
    c['freeze']=validate_freeze(c['freeze'])
    if c['mode']=='train' and (c['parents']>c['population'] or c['elite']>c['population']):raise ValueError('Parents/elites exceed population')
    if c['mode']=='train' and (c['mutation']<=0 or (c['schedule']!='fixed' and c['mutation_end']<=0)):raise ValueError('This training runner requires positive mutation rates, including when continuing an uploaded network')
    # Echo the rate actually passed to the native CLI, not an unused form value.
    if c['schedule']=='fixed':c['mutation_end']=c['mutation']
    rewards=c['rewards']
    if not isinstance(rewards,list) or not 1<=len(rewards)<=len(METRICS):raise ValueError('Use one or more distinct supported rewards')
    seen=set();clean=[]
    for r in rewards:
        if not isinstance(r,dict) or set(r)!= {'metric','type','weight'}:raise ValueError('Unexpected reward fields')
        if not isinstance(r['metric'],str) or r['metric'] not in METRICS or r['type'] not in ('default','average') or r['metric'] in seen or type(r['weight']) is not int or abs(r['weight'])>100:raise ValueError('Invalid reward')
        seen.add(r['metric']);clean.append(dict(r))
    if not any(r['weight'] for r in clean):raise ValueError('A reward weight must be nonzero')
    c['rewards']=clean
    if c['mode']=='evaluate':
        c.update(population=1,generations=1,mutation=0,mutation_end=0,decay=0,adaptive_mutation=False,parents=1,elite=0,crossover='none',selection='best',schedule='fixed',freeze={'layers':[],'inputs':[],'outputs':[]})
    if c['population']*c['generations']>32_768:raise ValueError('Run exceeds 32,768 car-generation analysis rows')
    if c['population']*c['generations']*c['ticks']>work_limit:raise ValueError('Run exceeds backend vehicle-tick limit')
    return c
