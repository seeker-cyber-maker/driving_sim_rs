"""Ephemeral challenge-condition check for one fixed network replay.

This predicts conditions attached to a supplied hosted track. It never grants
or persists original-game stars, and never scores an evolutionary population.
"""
from __future__ import annotations

import math
import re
from collections.abc import Mapping

MAX_TICKS = 18_000
MAX_ROWS = 18_001
MAX_CHALLENGES = 64
EPSILON = 1e-5
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SUPPORTED = {
    "LapChallenge", "LapInTimeChallenge", "AnyLapInTimeChallenge",
    "ScoreChallenge", "ScoreInTimeChallenge", "NegativeLapChallenge",
    "NegativeLapInTimeChallenge", "NegativeScoreChallenge",
    "LimitedNeuronsLapChallenge", "ScoreWithMoreNeuronsThanChallenge",
    "LapWithMoreNeuronsThanChallenge",
    "LimitedSensorsLapChallenge", "LapWithVehicleChallenge",
    "EliminationEnabledLapChallenge", "EliminationDisabledLapChallenge",
    "EliminationEnabledScoreChallenge", "EliminationDisabledScoreChallenge",
    "DriftInTimeChallenge", "TopSpeedInTimeChallenge", "SlowLapChallenge",
    "CollisionLapChallenge",
}
POPULATION_OR_HISTORY = {
    "RaceChallenge", "SimultaneousPositiveNegativeLapChallenge",
    "NoEliminationInTimeChallenge", "LimitedAgentsCountLapChallenge",
    "LimitedAgentsCountScoreChallenge", "LimitedEliminationCountLapChallenge",
    "LimitedEliminationCountScoreChallenge", "LapInGenerationsChallenge",
    "ScoreInGenerationsChallenge",
}

# These are SHA-256 hashes of exact compressed hosted replica track files. The
# matching captured game tracks use opponent races, while hosted replicas carry
# placeholder 1/2/3 lap challenges. Never report those placeholders as stars.
_ORIGINAL_RACE_TRACKS = {
    "14b52a7cbbf7de5606c772c74730c0e8776f39ed72955fef5ae1f7c2d8ccef77": (
        ("52746c9d-bedb-4679-8de1-1339478b250a", "R01 Easy"),
        ("b3389d76-a6aa-41b9-a0c3-af4ab7c45d0a", "R01 Medium"),
        ("5a5a9ce3-60c6-4a99-a64a-e3789ff1af4a", "R01 Expert"),
    ),
    "653286b00f2f04450e698d8b8e9d4ecb268064b323b182d2de9db7d017b22238": (
        ("4c8ea415-592d-4825-b066-041eaed6401b", "R02 Easy"),
        ("da2851f3-6cc8-4c50-b84a-e291ca2ae1fe", "R02 Medium"),
        ("fbee8c65-d248-4e23-a021-e89e6314012d", "R02 Expert"),
    ),
    "0e1b42ce51ae91a8702e173013a090d00145e518bb47d7a659cb1d1fdff011b5": (
        ("bcaf746b-9131-4c41-aea5-319ccde5784d", "R03 Easy"),
        ("21b8fabb-c77d-4f74-8e84-7b70521459c4", "R03 Medium"),
        ("5b4dfbef-2bbb-4bd2-9e37-23ccc8b4bac1", "R03 Expert"),
    ),
    "d7b89d64e118506e6cec259057886d9267ca4c6fab570e7ba0d6641e8f822f11": (
        ("5ddafd37-573c-4494-a592-744e5b77d0d3", "R04 Easy"),
        ("68f6356e-5b31-40b1-842e-ed2e476c4467", "R04 Medium"),
        ("2610f9d7-503a-490c-ae27-99f5b0b4d00f", "R04 Expert"),
    ),
    "dde36ad5f627bce65d45a96d46a68497f8d446f6011c9df19ee51ce71375cba8": (
        ("ab8c27e8-8396-4a72-b129-2b9befb436de", "R05 Easy"),
        ("6711b983-4b76-40af-bff1-69a3ce41878c", "R05 Medium"),
        ("350b58fa-d4dd-4fff-91b2-8dae87307997", "R05 Expert"),
    ),
    "9de8d912a59001ea13baa7f1b4f92884b8cddf91978f31e19f3237975713f739": (
        ("79b8188b-ea6b-446f-b1c4-3ff2c507b563", "R06 Formula"),
        ("af069dc8-d9a2-430d-90f2-d2687f7cbf78", "R06 Rally"),
        ("9d26d9f4-6255-4a4d-a65a-c1849b57ed6f", "R06 Snowmobile"),
    ),
    "8c6764f3accb1a8372d910d57f4f681572dd40c590c4a3d03517379bb360fcd7": (
        ("0fa65261-2c31-4117-bcc1-b4e2b223e9ba", "R07 Easy"),
        ("22bf973d-1fee-465b-b7f8-6b4940f30ff4", "R07 Medium"),
        ("90305aff-b44b-49ab-9e3d-ff4d054f7c21", "R07 Expert"),
    ),
    "6f11a9ffbcb477c9d19964566b1b612d2a94675605246e93e21f27bbbdb357ef": (
        ("641bb72e-48aa-4d31-8ad3-d057a2e22406", "R08 Raging Bison"),
        ("18f648c4-b239-496e-89db-f0cabc8e54b6", "R08 Ferret"),
        ("4a832686-e433-4411-8f7f-4be20d693188", "R08 Silverfish"),
    ),
    "3ec0a78478cca1a4f0d2d98ac81f40783928adf271b70f0c32d295a6da2cdaa9": (
        ("4a9ef57b-f720-4110-b943-834052261c72", "R09 301rng"),
        ("196f36bb-786a-4a58-b043-3b1446905f8a", "R09 Mars"),
        ("2ce49670-7b19-4f10-ac6b-ded1573bf9f9", "R09 null"),
    ),
    "a3bfb76422affc774b44c739b0636d08acb901fa7615b9adcb52c069f79834e1": (
        ("5e2acbda-7374-4d91-a428-086a18142aa9", "Champion null"),
        ("7baae2cc-c483-4323-85e6-ec38fe1929ab", "Champion Mars"),
        ("ac17fb21-1a39-4e2d-b0fb-8364455f3eca", "Champion 301rng"),
    ),
}


def _finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def _integer(value, low=0, high=MAX_TICKS):
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if low <= value <= high else None


def _seconds(value):
    value = _finite(value)
    return value if value is not None and 0.0 <= value <= 300.1 else None


def _time_parameter(value):
    value = _finite(value)
    return value if value is not None and 0.0 <= value <= 999.0 else None


def _has_unobserved_deadline(challenge, horizon):
    for key in ("TimeLimit", "TimeToReach", "MinTime"):
        seconds = _finite(challenge.get(key))
        if seconds is not None and seconds > horizon:
            return True
    return False


def check_ticks(track, config):
    """Bound observation ticks by config and any declared challenge deadline."""
    base = _integer(config.get("ticks"), 1, MAX_TICKS) if isinstance(config, Mapping) else None
    ticks = base or 1
    challenges = track.get("Challenges", []) if isinstance(track, Mapping) else []
    if isinstance(challenges, list):
        for challenge in challenges[:MAX_CHALLENGES]:
            if not isinstance(challenge, Mapping):
                continue
            for key in ("TimeLimit", "TimeToReach", "MinTime"):
                seconds = _finite(challenge.get(key))
                if seconds is not None and seconds > 0:
                    ticks = MAX_TICKS if seconds >= MAX_TICKS / 60 else max(ticks, math.ceil(seconds * 60.0))
    return max(1, min(MAX_TICKS, ticks))


def _validated_observation_rows(observations, requested_ticks):
    """Accept only the native 10 Hz tick/time sequence; never truncate it."""
    max_tick = min(MAX_TICKS + 6, requested_ticks + 6)
    if not isinstance(observations, (list, tuple)) or len(observations) > MAX_ROWS:
        return [], False
    rows = []
    previous_tick = None
    for index, row in enumerate(observations):
        if not isinstance(row, Mapping):
            return [], False
        tick = _integer(row.get("tick"), 6, max_tick)
        game_time = _seconds(row.get("game_time"))
        update_count = _integer(row.get("stats_update_count"), 1, MAX_ROWS)
        expected_time = (tick - 6) / 60.0 if tick is not None else None
        if (tick is None or tick % 6 != 0 or game_time is None or update_count != index + 1
                or not math.isclose(game_time, expected_time, rel_tol=0.0, abs_tol=1e-7)
                or previous_tick is not None and tick != previous_tick + 6):
            return [], False
        previous_tick = tick
        rows.append(row)
    return rows, True


def _shape_metadata(template):
    try:
        shape = template["NeuralNetwork"]["Shape"]
        sensors = template["Sensors"]
        vehicle = template["Type"]
        if (not isinstance(shape, list) or not shape or len(shape) > 12
                or any(_integer(n, 1, 4096) is None for n in shape)):
            raise ValueError
        if not isinstance(sensors, list) or len(sensors) > 128:
            raise ValueError
        if _integer(vehicle, 0, 3) is None:
            raise ValueError
        return sum(shape), sum(1 for sensor in sensors if isinstance(sensor, Mapping) and sensor.get("$type") == "raycast"), vehicle
    except (KeyError, TypeError, ValueError):
        return None, None, None


def _approx_le(a, b):
    return a < b or abs(a - b) < EPSILON


def _approx_ge(a, b):
    return a > b or abs(a - b) < EPSILON


def _meters_to_score(meters):
    # Captured UnitConstants.MetersToScore: 15 px/m, game score scale 5/384.
    return (meters / (1.0 / 15.0)) * (5.0 / 384.0)


def _threshold(challenge, key):
    value = challenge.get(key)
    return _finite(value)


def _evaluate(challenge, row, meta, lap_score, elimination):
    kind = challenge["$type"]
    time = row["game_time"]
    current = row["current_score"]
    best = row["current_best_score"]
    worst = row["worst_score"]
    lap_count = challenge.get("LapCount", 1)
    lap_count = _integer(lap_count, 1, 100)
    target_lap = lap_score * lap_count if lap_count is not None else None

    if kind in POPULATION_OR_HISTORY:
        return None
    if kind == "RaceChallenge":
        return None
    if kind == "LapChallenge":
        return best >= target_lap
    if kind == "LapInTimeChallenge":
        limit = _time_parameter(challenge.get("TimeToReach"))
        return None if limit is None else best >= target_lap and _approx_le(time, limit)
    if kind == "AnyLapInTimeChallenge":
        lap = row.get("best_lap_seconds")
        limit = _time_parameter(challenge.get("TimeToReach"))
        return None if limit is None else (False if lap is None else _approx_le(lap, limit))
    if kind in ("ScoreChallenge", "ScoreInTimeChallenge", "EliminationEnabledScoreChallenge", "EliminationDisabledScoreChallenge"):
        meters = _threshold(challenge, "MetersToReach")
        if meters is None:
            return None
        reached = _approx_ge(best, _meters_to_score(meters))
        if kind == "ScoreInTimeChallenge":
            # Unlike lap-in-time, source ScoreInTime uses ordinary <=.
            limit = _time_parameter(challenge.get("TimeToReach"))
            return None if limit is None else reached and time <= limit
        if kind == "EliminationEnabledScoreChallenge":
            return reached and elimination is True
        if kind == "EliminationDisabledScoreChallenge":
            return reached and elimination is False
        return reached
    if kind == "NegativeLapChallenge":
        return worst <= -target_lap
    if kind == "NegativeLapInTimeChallenge":
        limit = _time_parameter(challenge.get("TimeToReach"))
        return None if limit is None else worst <= -target_lap and _approx_le(time, limit)
    if kind == "NegativeScoreChallenge":
        meters = _threshold(challenge, "MetersToReach")
        if meters is None:
            return None
        return worst < _meters_to_score(meters) and abs(worst - _meters_to_score(meters)) >= EPSILON
    if kind == "LimitedNeuronsLapChallenge":
        limit = _integer(challenge.get("MaxNeurons"), 0, 100000)
        return None if limit is None or meta["neurons"] is None else best >= target_lap and meta["neurons"] <= limit
    if kind == "LapWithMoreNeuronsThanChallenge":
        limit = _integer(challenge.get("MinNeurons"), 0, 100000)
        return None if limit is None or meta["neurons"] is None else best >= target_lap and meta["neurons"] >= limit
    if kind == "ScoreWithMoreNeuronsThanChallenge":
        limit = _integer(challenge.get("MinNeurons"), 0, 100000)
        meters = _threshold(challenge, "MetersToReach")
        return None if limit is None or meters is None or meta["neurons"] is None else _approx_ge(best, _meters_to_score(meters)) and meta["neurons"] >= limit
    if kind == "LimitedSensorsLapChallenge":
        limit = _integer(challenge.get("MaxSensors"), 0, 128)
        return None if limit is None or meta["vision_sensors"] is None else best >= target_lap and meta["vision_sensors"] <= limit
    if kind == "LapWithVehicleChallenge":
        vehicle = _integer(challenge.get("VehicleType"), 0, 3)
        return None if vehicle is None or meta["vehicle"] is None else best >= target_lap and meta["vehicle"] == vehicle
    if kind == "EliminationEnabledLapChallenge":
        return None if elimination is None else best >= target_lap and elimination
    if kind == "EliminationDisabledLapChallenge":
        return None if elimination is None else best >= target_lap and not elimination
    if kind == "SlowLapChallenge":
        minimum = _time_parameter(challenge.get("MinTime"))
        return None if minimum is None else best >= target_lap and _approx_ge(time, minimum)
    if kind == "DriftInTimeChallenge":
        min_drift = _time_parameter(challenge.get("MinDriftTime"))
        limit = _time_parameter(challenge.get("TimeLimit"))
        drift = row.get("drift_cumulative")
        if min_drift is None or limit is None or drift is None:
            return None
        return _approx_le(time, limit) and drift >= min_drift
    if kind == "TopSpeedInTimeChallenge":
        threshold = _threshold(challenge, "TopSpeedKph")
        limit = _time_parameter(challenge.get("TimeLimit"))
        speed = row.get("speed_kph")
        if threshold is None or limit is None or speed is None:
            return None
        return _approx_le(time, limit) and speed > threshold
    if kind == "CollisionLapChallenge":
        collision_limit = _integer(challenge.get("MinCollisions"), 1, 999)
        collisions = _integer(row.get("collision_count"), 0, 8_000_000)
        if collision_limit is None or collisions is None:
            return None
        # Source: candidates stay within target + 5 score units, must cross
        # strictly beyond target, and collision count must be strictly greater.
        return current <= target_lap + 5.0 and current > target_lap and collisions > collision_limit
    return None


def _track_entries(track):
    challenges = track.get("Challenges", []) if isinstance(track, Mapping) else []
    if not isinstance(challenges, list) or len(challenges) > MAX_CHALLENGES:
        return []
    entries = []
    used_ids = set()
    for index, challenge in enumerate(challenges):
        if not isinstance(challenge, Mapping):
            challenge = {"$type": "UnknownChallenge", "Text": "Invalid challenge definition"}
        else:
            challenge = dict(challenge)
        cid = challenge.get("Id")
        if not isinstance(cid, str) or not cid or len(cid) > 128 or cid in used_ids:
            cid = f"challenge-{index + 1}"
            suffix = 1
            while cid in used_ids:
                suffix += 1
                cid = f"challenge-{index + 1}-{suffix}"
        used_ids.add(cid)
        challenge["Id"] = cid
        entries.append(challenge)
    return entries


def needs_observations(track, track_sha256):
    """Whether at least one provided challenge is eligible for a single-network pass."""
    if not isinstance(track_sha256, str) or not SHA256_RE.fullmatch(track_sha256):
        return False
    if not _track_entries(track) or track_sha256 in _ORIGINAL_RACE_TRACKS:
        return False
    return any(challenge.get("$type") in SUPPORTED for challenge in _track_entries(track))


def resolve_check(track, template, config, observations, *, network_sha256, track_sha256, backend, error=None):
    """Resolve the supplied track's conditions against one fixed network replay."""
    if not isinstance(network_sha256, str) or not SHA256_RE.fullmatch(network_sha256):
        raise ValueError("network_sha256 must be lowercase SHA-256")
    if not isinstance(track_sha256, str) or not SHA256_RE.fullmatch(track_sha256):
        raise ValueError("track_sha256 must be lowercase SHA-256")
    if backend not in ("cpu", "cuda"):
        raise ValueError("backend must be cpu or cuda")
    if not isinstance(track, Mapping) or not isinstance(config, Mapping):
        raise ValueError("track and config must be objects")
    source_challenges = track.get("Challenges", [])
    if not isinstance(source_challenges, list) or len(source_challenges) > MAX_CHALLENGES:
        raise ValueError("track challenge list is malformed or exceeds its bound")
    ticks = check_ticks(track, config)
    neurons, vision_sensors, vehicle = _shape_metadata(template)
    meta = {"neurons": neurons, "vision_sensors": vision_sensors, "vehicle": vehicle}
    elimination = config.get("collision") if isinstance(config.get("collision"), bool) else False
    source_races = _ORIGINAL_RACE_TRACKS.get(track_sha256)
    source_basis = ("Original built-in race challenge definitions identified by exact hosted track digest; "
                    "opponent race assets are absent, so this is not an original-game award check." if source_races else
                    "Track-defined conditions checked against one fresh replay of the current network; this is a prediction, not a game award.")
    entries = _track_entries(track)
    if source_races:
        entries = [{"Id": cid, "$type": "RaceChallenge", "Text": f"Race against {opponent}"} for cid, opponent in source_races]
    result_rows = []
    if error is not None:
        unavailable_reason = "Current-network observation is unavailable."
    else:
        unavailable_reason = "The bounded current-network observation was not available."
    raw_rows, rows_valid = _validated_observation_rows(observations, ticks) if error is None else ([], True)
    horizon = max((_finite(row.get("game_time")) for row in raw_rows), default=0.0)
    for challenge in entries:
        kind = challenge.get("$type") if isinstance(challenge.get("$type"), str) else "UnknownChallenge"
        text = challenge.get("Text") if isinstance(challenge.get("Text"), str) else kind
        text = " ".join(text.split())[:256]
        item = {"id": str(challenge.get("Id", "unknown"))[:128], "type": kind[:96], "text": text,
                "status": "not_checked", "reason": None, "completion_seconds": None}
        if error is not None:
            item["reason"] = unavailable_reason
            result_rows.append(item)
            continue
        if source_races or kind == "RaceChallenge":
            item["reason"] = "Opponent race results and controller assets are not available."
            result_rows.append(item)
            continue
        if kind in POPULATION_OR_HISTORY:
            item["reason"] = "This condition depends on population or training history, which the current-network check does not infer."
            result_rows.append(item)
            continue
        if kind not in SUPPORTED:
            item["reason"] = "This challenge type is not supported by the current-network check."
            result_rows.append(item)
            continue
        if not rows_valid:
            item["reason"] = "Observation sequence is incomplete or invalid."
            result_rows.append(item)
            continue
        if not raw_rows:
            item["reason"] = unavailable_reason
            result_rows.append(item)
            continue
        lap_score = _finite(track.get("LapScore")) if isinstance(track, Mapping) else None
        if lap_score is None or lap_score <= 0:
            item["reason"] = "Track lap threshold is missing or invalid."
            result_rows.append(item)
            continue
        missing = False
        malformed = False
        completion = None
        running_best = 0.0
        collision_impossible = False
        for row in raw_rows:
            time = _seconds(row.get("game_time"))
            tick = _integer(row.get("tick"), 0, MAX_TICKS + 6)
            current_score = _finite(row.get("current_score"))
            callback_best = _finite(row.get("current_best_score"))
            worst_score = _finite(row.get("worst_score"))
            if callback_best is not None:
                running_best = max(running_best, callback_best)
            best_score = running_best
            normalized = dict(row)
            normalized.update(game_time=time, current_score=current_score,
                              current_best_score=best_score, worst_score=worst_score)
            required = [time is not None, tick is not None, current_score is not None,
                        callback_best is not None, best_score is not None, worst_score is not None]
            if kind == "AnyLapInTimeChallenge":
                lap = _finite(row.get("best_lap_seconds"))
                normalized["best_lap_seconds"] = lap if lap is not None and lap > 0 else None
                required.append("best_lap_seconds" in row)
            elif kind == "DriftInTimeChallenge":
                drift = _finite(row.get("drift_cumulative"))
                normalized["drift_cumulative"] = drift if drift is not None and drift >= 0 else None
                required.append(normalized["drift_cumulative"] is not None)
            elif kind == "TopSpeedInTimeChallenge":
                speed = _finite(row.get("speed_kph"))
                normalized["speed_kph"] = speed if speed is not None and speed >= 0 else None
                required.append(normalized["speed_kph"] is not None)
            elif kind == "CollisionLapChallenge":
                collisions = _integer(row.get("collision_count"), 0, 8_000_000)
                normalized["collision_count"] = collisions
                required.append(collisions is not None)
            if not all(required):
                missing = True
                malformed = malformed or tick is None
                break
            try:
                if kind == "CollisionLapChallenge" and current_score > lap_score * challenge.get("LapCount", 1) + 5.0:
                    collision_impossible = True
                passed = False if collision_impossible else _evaluate(challenge, normalized, meta, lap_score, elimination)
            except (KeyError, TypeError, ValueError, OverflowError):
                passed = None
            if passed is None:
                missing = True
                continue
            if passed:
                completion = time
                break
        if completion is not None:
            item["status"] = "met"
            item["completion_seconds"] = completion
        elif missing:
            item["reason"] = ("Observation fields are incomplete or invalid." if malformed else
                               "Required evidence for this condition is unavailable.")
        elif _has_unobserved_deadline(challenge, horizon):
            item["reason"] = "The challenge deadline exceeds the bounded observation horizon."
        else:
            item["status"] = "not_met"
            item["reason"] = "Condition was not met during the bounded current-network replay."
        result_rows.append(item)
    status = "no_challenges" if not result_rows else (
        "unavailable" if error is not None or not rows_valid or not raw_rows and needs_observations(track, track_sha256)
        else "complete")
    if source_races and error is None:
        status = "complete"
    return {"schema": "ald.star-check", "version": 1, "network_sha256": network_sha256,
            "track_sha256": track_sha256, "vehicle_type": vehicle, "execution_backend": backend,
            "status": status, "horizon_seconds": horizon, "collision_elimination": elimination,
            "scope": "current_network", "basis": source_basis, "challenges": result_rows}


def validate_star_check(value, network_sha256, track_sha256, vehicle_type, backend):
    """Raise ValueError for malformed or mismatched archive/UI star-check data."""
    if not isinstance(value, Mapping) or set(value) != {
        "schema", "version", "network_sha256", "track_sha256", "vehicle_type",
        "execution_backend", "status", "horizon_seconds", "collision_elimination",
        "scope", "basis", "challenges",
    }:
        raise ValueError("invalid star check keys")
    if value["schema"] != "ald.star-check" or type(value["version"]) is not int or value["version"] != 1:
        raise ValueError("invalid star check schema")
    if value["network_sha256"] != network_sha256 or value["track_sha256"] != track_sha256:
        raise ValueError("star check identity mismatch")
    if not isinstance(network_sha256, str) or not SHA256_RE.fullmatch(network_sha256) or not isinstance(track_sha256, str) or not SHA256_RE.fullmatch(track_sha256):
        raise ValueError("invalid star check digest")
    if value["vehicle_type"] != vehicle_type or value["execution_backend"] != backend:
        raise ValueError("star check execution identity mismatch")
    if _integer(value["vehicle_type"], 0, 3) is None or backend not in ("cpu", "cuda"):
        raise ValueError("invalid star check vehicle or backend")
    horizon = _finite(value["horizon_seconds"])
    if horizon is None or not 0 <= horizon <= 300.0:
        raise ValueError("invalid star check horizon")
    if not isinstance(value["collision_elimination"], bool):
        raise ValueError("invalid star check elimination setting")
    if value["scope"] != "current_network" or not isinstance(value["basis"], str) or not 1 <= len(value["basis"]) <= 1000:
        raise ValueError("invalid star check scope or basis")
    status = value["status"]
    if status not in ("complete", "unavailable", "no_challenges"):
        raise ValueError("invalid star check status")
    challenges = value["challenges"]
    if not isinstance(challenges, list) or len(challenges) > MAX_CHALLENGES:
        raise ValueError("invalid star check challenge list")
    if (status == "no_challenges") != (len(challenges) == 0):
        raise ValueError("star check status/challenge mismatch")
    required = {"id", "type", "text", "status", "reason", "completion_seconds"}
    for challenge in challenges:
        if not isinstance(challenge, Mapping) or set(challenge) != required:
            raise ValueError("invalid star check challenge keys")
        if not isinstance(challenge["id"], str) or not 1 <= len(challenge["id"]) <= 128:
            raise ValueError("invalid star check challenge id")
        if not isinstance(challenge["type"], str) or not 1 <= len(challenge["type"]) <= 96:
            raise ValueError("invalid star check challenge type")
        if not isinstance(challenge["text"], str) or len(challenge["text"]) > 256:
            raise ValueError("invalid star check challenge text")
        state = challenge["status"]
        if state not in ("met", "not_met", "not_checked"):
            raise ValueError("invalid star check challenge status")
        completion = challenge["completion_seconds"]
        if state == "met":
            completion = _finite(completion)
            if completion is None or not 0 <= completion <= horizon or challenge["reason"] is not None:
                raise ValueError("invalid completed star check challenge")
        elif completion is not None or not isinstance(challenge["reason"], str) or not 1 <= len(challenge["reason"]) <= 256:
            raise ValueError("invalid uncompleted star check challenge")
        if status == "unavailable" and state != "not_checked":
            raise ValueError("unavailable star check contains evaluated challenge")
    if len({challenge["id"] for challenge in challenges}) != len(challenges):
        raise ValueError("duplicate star check challenge id")
    return value
