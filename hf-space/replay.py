"""Bounded native CPU replay with actual control and inference-cache telemetry.

One unchanged policy runs once. The native bench exports post-physics state
and its actual cached pre-physics inference inputs at each requested sample.
No sensor readings, commands or poses are reconstructed by this module.
"""

import hashlib
import json
import math
from pathlib import Path
import stat
import struct
import subprocess
import tempfile
import time

from worker import (
    OUTPUT_NAMES,
    native_environment,
    network_input,
    track_input,
    vehicle_scene_template,
)


MAX_TICKS = 900
SAMPLE_INTERVAL_TICKS = 6
MAX_WALL_SECONDS = 30.0
MAX_SCENE_BYTES = 16 * 1024 * 1024
MAX_DUMP_BYTES = 512 * 1024
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class ReplayError(RuntimeError):
    """The native recorder could not produce a complete verified recording."""


class ReplayTimeout(ReplayError, TimeoutError):
    """The recording exhausted its native subprocess or total wall budget."""


def _remaining(deadline):
    seconds = deadline - time.monotonic()
    if seconds <= 0:
        raise ReplayTimeout('Replay recording exceeded its time limit; try fewer ticks')
    return seconds


def _run(command, *, work, env, deadline, stage, timeout=None):
    remaining = _remaining(deadline)
    try:
        subprocess.run(
            command,
            cwd=work,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
            check=True,
            timeout=min(remaining, timeout) if timeout is not None else remaining,
        )
    except subprocess.TimeoutExpired as exc:
        raise ReplayTimeout('Replay recording exceeded its time limit; try fewer ticks') from exc
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ReplayError('Native replay ' + stage + ' failed') from exc
    _remaining(deadline)


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result


def _read_json(path, limit, label):
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Invalid output file')
        with path.open('rb') as stream:
            data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Output exceeds limit')
        value = json.loads(
            data,
            object_pairs_hook=_object,
            parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON')),
        )
        if not isinstance(value, dict):
            raise ValueError('Expected JSON object')
        return value
    except (OSError, ValueError, RecursionError) as exc:
        raise ReplayError('Native replay returned an invalid ' + label) from exc


def _number(value, label):
    finite = False
    if type(value) in (int, float):
        try:
            finite = math.isfinite(value)
        except OverflowError:
            pass
    if not finite:
        raise ReplayError('Native replay returned an invalid ' + label)
    return value


def _vector(value, label):
    if not isinstance(value, list) or len(value) != 2:
        raise ReplayError('Native replay returned an invalid ' + label)
    return [_number(component, label) for component in value]


def _counter(value, label):
    # Keep integer values exact in the browser's JSON number representation.
    if type(value) is not int or not 0 <= value <= 2**53 - 1:
        raise ReplayError('Native replay returned an invalid ' + label)
    return value


def _parameter_bytes(values):
    # Native Network.params stores float64 values, layer by layer: each weight
    # row, followed by that layer's bias. Comparing bytes also preserves -0.0.
    return b''.join(struct.pack('!d', _number(value, 'policy parameter')) for value in values)


def _controls(value, label):
    fields = {'steering', 'acceleration', 'brake', 'handbrake', 'boost'}
    if not isinstance(value, dict) or set(value) != fields:
        raise ReplayError('Native replay returned invalid ' + label)
    result = {key: _number(value[key], label) for key in sorted(fields)}
    if any(abs(v) > 1 for v in result.values()):
        raise ReplayError('Native replay returned out-of-range ' + label)
    return result


def _frame(dump, tick, expected_parameters, *, sensor_count):
    agents = dump.get('agents')
    networks = dump.get('next_networks')
    if (not isinstance(agents, list) or len(agents) != 1 or not isinstance(agents[0], dict)
            or not isinstance(networks, list) or len(networks) != 1
            or not isinstance(networks[0], list)
            or len(networks[0]) * 8 != len(expected_parameters)):
        raise ReplayError('Native replay must contain exactly one car and its policy')
    if _parameter_bytes(networks[0]) != expected_parameters:
        raise ReplayError('Native replay changed the selected policy; recording discarded')

    agent = agents[0]
    position = _vector(agent.get('position'), 'car position')
    velocity = _vector(agent.get('velocity'), 'car velocity')
    if type(agent.get('active')) is not bool:
        raise ReplayError('Native replay returned an invalid active state')
    frame = {
        'tick': tick,
        'x': position[0],
        'y': position[1],
        'rotation': _number(agent.get('rotation'), 'car rotation'),
        'vx': velocity[0],
        'vy': velocity[1],
        'active': agent['active'],
    }
    commands = _controls(agent.get('controls'), 'control commands')
    applied = _controls(agent.get('applied_controls'), 'applied controls')
    expected_applied = {key: max(0.0, value) if key in {'handbrake', 'boost'} else value
                        for key, value in commands.items()}
    if applied != expected_applied:
        raise ReplayError('Native replay control normalization does not match')
    if 'decision' not in agent:
        raise ReplayError('Native replay omitted its inference snapshot')
    decision = agent['decision']
    if decision is not None:
        if (not isinstance(decision, dict) or set(decision) != {'tick', 'inputs'}
                or type(decision['tick']) is not int or not 1 <= decision['tick'] <= tick
                or not isinstance(decision['inputs'], list) or len(decision['inputs']) != sensor_count):
            raise ReplayError('Native replay returned an invalid inference snapshot')
        decision = {'tick': decision['tick'],
                    'inputs': [_number(value, 'sensor input') for value in decision['inputs']]}
    frame.update(controls=commands, applied_controls=applied, decision=decision)
    for field in ('angular_velocity', 'boost_energy'):
        if field in agent:
            frame[field] = _number(agent[field], field)
    for field in ('collision_count', 'update_count'):
        if field in agent:
            frame[field] = _counter(agent[field], field)
    if 'metrics' in agent:
        metrics = agent['metrics']
        if (not isinstance(metrics, dict) or len(metrics) > 64
                or any(not isinstance(key, str) or not 1 <= len(key) <= 96 for key in metrics)):
            raise ReplayError('Native replay returned invalid metrics')
        frame['metrics'] = {
            key: None if value is None else _number(value, 'metric')
            for key, value in metrics.items()
        }
    return frame


def record_replay(track_bytes, network_bytes, *, binary, importer, scene_template, ticks=300):
    """Record one unchanged policy for 1–900 native 60 Hz ticks.

    ``binary``, ``importer`` and the Formula ``scene_template`` path must come
    from trusted application configuration. Uploads only supply saved track
    and game network bytes. Samples include tick 1, every sixth tick, and the
    requested endpoint. The importer spawn is labelled separately because the
    native reset settles the vehicle before the first measured tick.
    """
    deadline = time.monotonic() + MAX_WALL_SECONDS
    if type(ticks) is not int or not 1 <= ticks <= MAX_TICKS:
        raise ValueError('Replay ticks must be an integer from 1 to 900')
    track = track_input(track_bytes)
    template = network_input(network_bytes)
    binary = Path(binary).resolve()
    importer = Path(importer).resolve()
    scene_template = vehicle_scene_template(scene_template, template['Type'])
    if not all(path.is_file() for path in (binary, importer, scene_template)):
        raise ReplayError('Native replay tools or vehicle template unavailable')

    network = template['NeuralNetwork']
    parameters = []
    for matrix, bias in zip(network['Weights'], network['Biases']):
        parameters.extend(value for row in matrix for value in row)
        parameters.extend(bias)
    expected_parameters = _parameter_bytes(parameters)
    sample_ticks = sorted({1, ticks, *range(SAMPLE_INTERVAL_TICKS, ticks + 1, SAMPLE_INTERVAL_TICKS)})
    environment = native_environment()

    with tempfile.TemporaryDirectory(prefix='tiga-replay-') as directory:
        work = Path(directory)
        environment.update(TMPDIR=directory)

        def save(name, value):
            path = work / name
            path.write_text(json.dumps(value, allow_nan=False), encoding='utf-8')
            return str(path)

        saved_track = save('track.json', track)
        scene_path = work / 'scene.json'
        _run(
            [str(importer), saved_track, 'Replay track', str(scene_template), str(scene_path)],
            work=work, env=environment, deadline=deadline, stage='track import', timeout=10.0,
        )
        scene = _read_json(scene_path, MAX_SCENE_BYTES, 'scene')
        spawn_position = _vector(scene.get('reset_position'), 'requested spawn position')
        spawn_rotation = _number(scene.get('reset_rotation'), 'requested spawn rotation')
        spawn_path = save('spawn.json', {'frames': [{'position': spawn_position, 'rotation': spawn_rotation}]})
        names = [f'sensor-{index}' for index in range(network['Shape'][0])]
        network_path = save('network.json', {
            'shape': network['Shape'], 'weights': network['Weights'], 'biases': network['Biases'],
            'inputs': names, 'outputs': [OUTPUT_NAMES[index] for index in template['Outputs']],
        })
        model_path = save('model.json', {'sensor_layout': {'names': names, 'sensors': template['Sensors']}})
        dump_path = work / 'state.json'
        command = [
            str(binary), '--math-profile', 'proton', '--threads', '1', 'bench',
            '--scene', str(scene_path), '--network', network_path, '--model', model_path,
            '--spawn-trace', spawn_path, '--population', '1', '--warmup-ticks', '0',
            '--seed', '0', '--spawn-index', '0', '--batch-count', '1', '--dump-state', str(dump_path),
        ]
        _run(command + ['--ticks', str(ticks), '--record-interval', str(SAMPLE_INTERVAL_TICKS)],
             work=work, env=environment, deadline=deadline, stage='recording')
        dump = _read_json(dump_path, MAX_DUMP_BYTES, 'car state')
        samples = dump.get('replay_frames')
        if (not isinstance(samples, list) or len(samples) != len(sample_ticks)
                or any(not isinstance(sample, dict) or sample.get('tick') != tick
                       for sample, tick in zip(samples, sample_ticks))):
            raise ReplayError('Native replay omitted its expected trace samples')
        frames = [_frame({'agents': sample.get('agents'), 'next_networks': dump.get('next_networks')},
                         tick, expected_parameters, sensor_count=network['Shape'][0])
                  for sample, tick in zip(samples, sample_ticks)]
        _remaining(deadline)

        result = {
            'schema': 'ald.recorded-replay',
            'version': 2,
            'kind': 'fresh_cpu_evaluation',
            'physics_hz': 60,
            'sample_interval_ticks': SAMPLE_INTERVAL_TICKS,
            'first_sample_tick': 1,
            'control_hz': 60,
            'track_sha256': hashlib.sha256(track_bytes).hexdigest(),
            'network_sha256': hashlib.sha256(network_bytes).hexdigest(),
            'vehicle_type': template['Type'],
            'requested_ticks': ticks,
            'execution_backend': 'cpu',
            'math_profile': 'proton',
            'collision_elimination': False,
            'idle_elimination': False,
            'seed': 0,
            'population': 1,
            'warmup_ticks': 0,
            'policy_weights_verified': True,
            'sampling_method': 'single_native_bench_trace',
            'telemetry': {
                'source': 'native_cached_inference',
                'state_phase': 'post_physics',
                'decision_phase': 'pre_physics_at_decision_tick',
                'sensors': template['Sensors'],
                'output_ids': template['Outputs'],
                'controls': 'raw_network_commands_and_native_normalized_controls',
            },
            'position_units': 'game_world_units',
            'velocity_units': 'game_world_units_per_second',
            'rotation_units': 'radians',
            'native_spawn_kind': 'requested_before_native_reset_settle',
            'native_spawn': {'x': spawn_position[0], 'y': spawn_position[1], 'rotation': spawn_rotation},
            'frames': frames,
        }
        native_track = scene.get('track')
        if isinstance(native_track, dict):
            for field in ('tile_size', 'tile_map_position'):
                if field in native_track:
                    result[field] = _vector(native_track[field], field)
        if len(json.dumps(result, allow_nan=False).encode('utf-8')) > MAX_RESPONSE_BYTES:
            raise ReplayError('Native replay recording exceeds the output limit')
        _remaining(deadline)
        return result
