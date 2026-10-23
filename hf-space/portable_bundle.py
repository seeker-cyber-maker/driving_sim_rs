"""Strict versioned portable bundle validator shared by CLI and hosted API."""
from __future__ import annotations
import base64, binascii, gzip, hashlib, io, json, math, os, re, struct, sys, zlib
from pathlib import Path
from typing import Any
PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
from worker import network_input as _game_network_input, track_input as _game_track_input

SCHEMA = "ald.portable-bundle"
VERSION = 1
MAX_NETWORK = 4 * 1024 * 1024
MAX_TRACK = 1 * 1024 * 1024
MAX_RECIPE = 32 * 1024
MAX_RECEIPT = 512 * 1024
MAX_BUNDLE_V1 = 8 * 1024 * 1024
MAX_BUNDLE = 48 * 1024 * 1024
MAX_EXPANDED_JSON = 4 * 1024 * 1024
ANALYSIS_ARCHIVE_FORMAT = "ald.run-analysis-archive+gzip"
MAX_ANALYSIS_ARCHIVE = 32 * 1024 * 1024
MAX_ANALYSIS_EXPANDED = 256 * 1024 * 1024
MAX_ANALYSIS_FILE_BYTES = 192 * 1024 * 1024
MAX_DESCRIPTOR_ROWS = 128000
ANALYSIS_JSON_LIMIT = 512 * 1024
ANALYSIS_WINNER_LIMIT = 1024 * 1024
ANALYSIS_FILES = {
    "analysis.json", "descriptors.jsonl", "evaluation.json", "stars.json",
    "winners/fitness.evolution", "winners/fastest_lap.evolution", "winners/clean_laps.evolution",
}
HEX64 = re.compile(r"^[0-9a-f]{64}$")
BUCKET_PATH = re.compile(r"^hf://buckets/([A-Za-z0-9][A-Za-z0-9_.-]{0,63})/([A-Za-z0-9][A-Za-z0-9_.-]{0,127})(?:/([A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*))?$")
SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

RECIPE_KEYS = {
    "population", "generations", "ticks", "mutation", "seed", "mutation_end",
    "schedule", "selection", "parents", "elite", "crossover", "decay",
    "adaptive_mutation", "control_hz", "workers", "collision", "idle", "rewards",
    "mode", "clean_min_laps", "freeze",
}
LEGACY_RECIPE_KEYS = RECIPE_KEYS - {"mode", "clean_min_laps", "freeze"}
METRICS = {
    "total_score", "total_speed", "total_abs_steering", "total_actual_distance",
    "total_drifting_amount", "total_momentum_change_frequency", "total_throttle_change_frequency",
    "total_braking_frequency", "total_distance_from_wall", "total_distance_from_center",
    "network_novelty", "collision_count", "best_lap_performance", "total_racing_line_efficiency",
}
METRIC_ORDER = (
    "total_score", "total_speed", "total_abs_steering", "total_actual_distance",
    "total_drifting_amount", "total_momentum_change_frequency", "total_throttle_change_frequency",
    "total_braking_frequency", "total_distance_from_wall", "total_distance_from_center",
    "network_novelty", "collision_count", "best_lap_performance", "total_racing_line_efficiency",
)
AVERAGE_METRICS = set(METRIC_ORDER[:10])
AVERAGE_ONLY_METRICS = {"total_abs_steering", "total_momentum_change_frequency", "total_throttle_change_frequency",
                        "total_braking_frequency", "total_distance_from_wall", "total_distance_from_center"}
RECEIPT_KEYS = {"version", "kind", "state", "build_id", "backend", "output_sha256", "report"}
REPORT_KEYS = {
    "vehicle_type", "vehicle_name", "generations_completed", "generations_requested", "population",
    "elapsed_seconds", "best_score", "mean_score", "best_lap_seconds", "lapped_cars",
    "simulated_ticks", "requested_ticks", "candidate_validated", "execution_backend", "inputs", "settings",
}
ANALYSIS_SUMMARY_KEYS = {
    "schema", "version", "mode", "execution_backend", "conditions", "observations", "winners", "semantics",
}
HISTORY_ROW_KEYS = {
    "generation", "mutation", "best_score", "mean_score",
    "best_lap_seconds", "lapped_cars", "simulated_ticks",
}
INPUT_HASH_KEYS = {"track_sha256", "network_sha256"}


class BundleError(ValueError):
    pass


def _analysis_member_limit(name: str) -> int:
    if name in {"analysis.json", "evaluation.json", "stars.json"}:
        return ANALYSIS_JSON_LIMIT
    if name.startswith("winners/") and name.endswith(".evolution"):
        return ANALYSIS_WINNER_LIMIT
    if name == "descriptors.jsonl":
        return MAX_ANALYSIS_FILE_BYTES
    raise BundleError("analysis archive contains an unsupported filename")


def _analysis_jsonl_rows(raw: bytes) -> int:
    if not raw or not raw.endswith(b"\n"):
        raise BundleError("analysis descriptors must be newline-terminated JSONL")
    count = 0
    for line in io.BytesIO(raw):
        line = line[:-1] if line.endswith(b"\n") else line
        if not line:
            raise BundleError("analysis descriptors contain a blank row")
        row = _parse_json(line, limit=64 * 1024, label="analysis descriptor row")
        if not isinstance(row, dict):
            raise BundleError("analysis descriptor row must be an object")
        required = {"schema", "generation", "car", "candidate_id", "ticks_elapsed", "stats_update_count",
                    "raw_metrics", "channels", "selection_fitness", "objectives", "weights_sha256"}
        if set(row) != required or row.get("schema") != 1:
            raise BundleError("analysis descriptor row fields are unsupported")
        if (type(row["generation"]) is not int or not 1 <= row["generation"] <= 2000
                or type(row["car"]) is not int or not 0 <= row["car"] < 1024
                or row["candidate_id"] != f'g{row["generation"]:06}-c{row["car"]:06}'
                or type(row["ticks_elapsed"]) is not int or not 0 <= row["ticks_elapsed"] <= 18_012
                or type(row["stats_update_count"]) is not int or not 0 <= row["stats_update_count"] <= 18_012
                or not isinstance(row["weights_sha256"], str) or not HEX64.fullmatch(row["weights_sha256"])):
            raise BundleError("analysis descriptor identity or counts are invalid")
        metrics = row["raw_metrics"]
        if (not isinstance(metrics, dict) or set(metrics) != METRICS
                or any(v is not None and not _is_number(v, -1e12, 1e12)
                       for k, v in metrics.items())):
            raise BundleError("analysis descriptor raw metrics are invalid")
        channels = row["channels"]
        if (not isinstance(channels, dict)
                or set(channels) != {"values", "population_relative", "unavailable_reasons"}
                or any(not isinstance(channels[key], list) or len(channels[key]) != 18
                       for key in ("values", "population_relative", "unavailable_reasons"))):
            raise BundleError("analysis descriptor reward channels are invalid")
        for value, rank, reason in zip(channels["values"], channels["population_relative"], channels["unavailable_reasons"]):
            if value is None:
                if rank is not None or not isinstance(reason, str) or not reason:
                    raise BundleError("unavailable analysis channel is not represented explicitly")
            elif (not _is_number(value, -1e12, 1e12) or not _is_number(rank, 0, 1) or reason is not None):
                raise BundleError("available analysis channel is invalid")
        if row["selection_fitness"] is not None and not _is_number(row["selection_fitness"], -1e12, 1e12):
            raise BundleError("analysis descriptor selection fitness is invalid")
        objectives = row["objectives"]
        objective_keys = {"best_lap_seconds", "forward_laps", "physical_contacts", "collision_updates", "total_actual_distance", "active"}
        if (not isinstance(objectives, dict) or set(objectives) != objective_keys
                or any(objectives[k] is not None and not _is_number(objectives[k], 0, 1e12)
                       for k in ("best_lap_seconds", "total_actual_distance"))
                or any(type(objectives[k]) is not int or not 0 <= objectives[k] <= 8_000_000
                       for k in ("forward_laps", "physical_contacts", "collision_updates"))
                or type(objectives["active"]) is not bool):
            raise BundleError("analysis descriptor objectives are invalid")
        count += 1
        if count > MAX_DESCRIPTOR_ROWS:
            raise BundleError("analysis descriptor row limit exceeded")
    return count


def _network_weights_sha256(raw: bytes) -> str:
    try:
        network = _game_network_input(raw)["NeuralNetwork"]
        digest = hashlib.sha256()
        for matrix, bias in zip(network["Weights"], network["Biases"]):
            for row in matrix:
                for value in row:
                    digest.update(struct.pack("<d", value))
            for value in bias:
                digest.update(struct.pack("<d", value))
        return digest.hexdigest()
    except (KeyError, TypeError, ValueError, OverflowError, struct.error) as exc:
        raise BundleError("analysis winner network is invalid") from exc


def load_analysis_archive(raw: bytes) -> tuple[dict[str, Any], dict[str, bytes]]:
    """Validate the deterministic gzip envelope and return fixed inner members."""
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_ANALYSIS_ARCHIVE:
        raise BundleError("analysis archive is empty or exceeds 32 MiB")
    if not raw.startswith(b"\x1f\x8b"):
        raise BundleError("analysis archive is not gzip data")
    inflater = zlib.decompressobj(16 + zlib.MAX_WBITS)
    try:
        expanded = inflater.decompress(raw, MAX_ANALYSIS_EXPANDED + 1)
        if len(expanded) > MAX_ANALYSIS_EXPANDED or inflater.unconsumed_tail:
            raise BundleError("analysis archive expands beyond 256 MiB")
        expanded += inflater.flush(MAX_ANALYSIS_EXPANDED - len(expanded) + 1)
    except zlib.error as exc:
        raise BundleError("analysis archive gzip data is invalid") from exc
    if len(expanded) > MAX_ANALYSIS_EXPANDED:
        raise BundleError("analysis archive expands beyond 256 MiB")
    if not inflater.eof or inflater.unused_data:
        raise BundleError("analysis archive must contain one complete gzip member")
    value = _parse_json(expanded, limit=MAX_ANALYSIS_EXPANDED, label="analysis archive envelope")
    envelope = _strict_keys(value, {"schema", "version", "files"}, {"schema", "version", "files"}, "analysis archive")
    if envelope["schema"] != "ald.run-analysis-archive" or type(envelope["version"]) is not int or envelope["version"] != 1:
        raise BundleError("analysis archive schema or version is unsupported")
    entries = envelope["files"]
    if not isinstance(entries, list) or not 2 <= len(entries) <= len(ANALYSIS_FILES):
        raise BundleError("analysis archive file list is invalid")
    inner: dict[str, bytes] = {}
    total = 0
    for entry in entries:
        entry = _strict_keys(entry, {"name", "bytes", "sha256", "data_base64"},
                             {"name", "bytes", "sha256", "data_base64"}, "analysis archive member")
        name = entry["name"]
        if not isinstance(name, str) or name not in ANALYSIS_FILES or name in inner:
            raise BundleError("analysis archive filename is unsupported or duplicated")
        size = entry["bytes"]
        limit = _analysis_member_limit(name)
        if type(size) is not int or size < 1 or size > limit:
            raise BundleError("analysis archive member size is invalid")
        if not isinstance(entry["sha256"], str) or not HEX64.fullmatch(entry["sha256"]):
            raise BundleError("analysis archive member SHA-256 is invalid")
        encoded = entry["data_base64"]
        if not isinstance(encoded, str) or len(encoded) > 4 * ((limit + 2) // 3):
            raise BundleError("analysis archive member base64 exceeds its limit")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise BundleError("analysis archive member base64 is invalid") from exc
        if len(content) != size or hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise BundleError("analysis archive member bytes or hash do not match")
        total += len(content)
        if total > MAX_ANALYSIS_FILE_BYTES:
            raise BundleError("analysis archive members exceed 192 MiB")
        inner[name] = content
    if "analysis.json" not in inner or "descriptors.jsonl" not in inner:
        raise BundleError("analysis archive is missing required files")
    rows = _analysis_jsonl_rows(inner["descriptors.jsonl"])
    analysis = _parse_json(inner["analysis.json"], limit=ANALYSIS_JSON_LIMIT, label="analysis metadata")
    if analysis.get("schema") != "ald.run-analysis" or type(analysis.get("version")) is not int or analysis["version"] != 1:
        raise BundleError("analysis metadata schema or version is unsupported")
    mode = analysis.get("mode")
    if not isinstance(mode, str):
        raise BundleError("analysis mode is unsupported")
    if mode == "train":
        if "evaluation.json" in inner or "winners/fitness.evolution" not in inner:
            raise BundleError("training analysis is missing its fitness winner or includes evaluation data")
    elif mode == "evaluate":
        if "evaluation.json" not in inner or any(name.startswith("winners/") for name in inner):
            raise BundleError("evaluation analysis must include evaluation data and no selected winners")
    else:
        raise BundleError("analysis mode is unsupported")
    observations = analysis.get("observations")
    descriptors = analysis.get("descriptors")
    if not isinstance(observations, dict) or not isinstance(descriptors, dict):
        raise BundleError("analysis observation or descriptor metadata is missing")
    if (type(observations.get("cars")) is not int or observations["cars"] != rows
            or type(observations.get("generations")) is not int or not 1 <= observations["generations"] <= 2000
            or type(observations.get("raw_metric_count")) is not int or observations["raw_metric_count"] != 14
            or type(observations.get("reward_channel_count")) is not int or observations["reward_channel_count"] != 18):
        raise BundleError("analysis observation counts do not match the descriptor rows")
    if rows % observations["generations"]:
        raise BundleError("analysis descriptor rows are not a whole number of generations")
    expected_generation_cars = rows // observations["generations"]
    if not 1 <= expected_generation_cars <= 1024:
        raise BundleError("analysis car population is outside its supported bounds")
    if (descriptors.get("name") != "descriptors.jsonl"
            or descriptors.get("bytes") != len(inner["descriptors.jsonl"])
            or descriptors.get("sha256") != hashlib.sha256(inner["descriptors.jsonl"]).hexdigest()
            or descriptors.get("rows") != rows):
        raise BundleError("descriptor metadata does not match the complete descriptor file")
    winners = analysis.get("winners")
    if not isinstance(winners, dict) or set(winners) != {"fitness", "fastest_lap", "clean_laps"}:
        raise BundleError("analysis winner roles are invalid")
    expected_semantics = {"fitness", "fastest_lap", "clean_laps", "channels", "collision_count", "evaluation", "training"}
    semantics = analysis.get("semantics")
    if (not isinstance(semantics, dict) or set(semantics) != expected_semantics
            or any(not isinstance(value, str) or not value or len(value) > 512 for value in semantics.values())):
        raise BundleError("analysis semantics are invalid")
    conditions = analysis.get("conditions")
    if (not isinstance(conditions, dict)
            or set(conditions) != {"track_sha256", "network_sha256", "vehicle_type", "requested_ticks", "control_hz", "collision", "idle", "math_profile", "clean_min_laps"}
            or any(not isinstance(conditions[k], str) or not HEX64.fullmatch(conditions[k]) for k in ("track_sha256", "network_sha256"))
            or type(conditions["vehicle_type"]) is not int or not 0 <= conditions["vehicle_type"] <= 3
            or type(conditions["requested_ticks"]) is not int or not 1 <= conditions["requested_ticks"] <= 18_000
            or type(conditions["control_hz"]) is not int or conditions["control_hz"] not in {15, 30, 60}
            or type(conditions["collision"]) is not bool or type(conditions["idle"]) is not bool
            or conditions["math_profile"] != "proton"
            or type(conditions["clean_min_laps"]) is not int or not 1 <= conditions["clean_min_laps"] <= 100):
        raise BundleError("analysis conditions are invalid")
    metric_names = analysis.get("metric_names")
    reward_channels = analysis.get("reward_channels")
    if (not isinstance(metric_names, list) or tuple(metric_names) != METRIC_ORDER
            or not isinstance(reward_channels, list) or len(reward_channels) != 18
            or any(not isinstance(item, dict) or set(item) != {"metric", "type"}
                   or not isinstance(item["metric"], str) or item["metric"] not in METRICS
                   or not isinstance(item["type"], str) or item["type"] not in {"default", "average"}
                   for item in reward_channels)
            or reward_channels != [{"metric": metric, "type": kind} for metric in metric_names for kind in ("default", "average")
                if not (kind == "default" and metric in AVERAGE_ONLY_METRICS)
                and not (kind == "average" and metric not in AVERAGE_METRICS)]):
        raise BundleError("analysis metric or reward channel definitions are invalid")
    settings = analysis.get("settings")
    if (not isinstance(settings, dict)
            or set(settings) not in (RECIPE_KEYS, RECIPE_KEYS - {"freeze"})):
        raise BundleError("analysis validated settings are missing")
    validate_settings(settings)
    if (settings.get("mode") != mode or settings.get("ticks") != conditions["requested_ticks"]
            or settings.get("control_hz") != conditions["control_hz"]
            or settings.get("collision") != conditions["collision"]
            or settings.get("idle") != conditions["idle"]
            or settings.get("clean_min_laps") != conditions["clean_min_laps"]):
        raise BundleError("analysis settings do not match its conditions")
    if (type(settings.get("population")) is not int or not 1 <= settings["population"] <= 1024
            or type(settings.get("generations")) is not int or not 1 <= settings["generations"] <= 2000
            or observations["generations"] != (1 if mode == "evaluate" else settings["generations"])
            or expected_generation_cars != (1 if mode == "evaluate" else settings["population"])):
        raise BundleError("analysis observation dimensions do not match its validated settings")
    for role in ("fitness", "fastest_lap", "clean_laps"):
        winner = winners[role]
        winner_keys = {"status", "reason", "candidate_id", "generation", "car", "selection_fitness",
                       "best_lap_seconds", "forward_laps", "physical_contacts", "collision_updates",
                       "total_actual_distance", "artifact"}
        if (not isinstance(winner, dict) or set(winner) != winner_keys
                or not isinstance(winner.get("status"), str) or winner["status"] not in {"available", "unavailable"}):
            raise BundleError("analysis winner status is invalid")
        artifact = winner.get("artifact")
        expected_name = f"winners/{role}.evolution"
        if winner["status"] == "available":
            if (not isinstance(winner["candidate_id"], str)
                    or not re.fullmatch(r"g[0-9]{6}-c[0-9]{6}", winner["candidate_id"])
                    or type(winner["generation"]) is not int or not 1 <= winner["generation"] <= observations["generations"]
                    or type(winner["car"]) is not int or not 0 <= winner["car"] < expected_generation_cars
                    or not _is_number(winner["selection_fitness"], -1e12, 1e12)
                    or (winner["best_lap_seconds"] is not None and not _is_number(winner["best_lap_seconds"], 0, 1e12))
                    or any(type(winner[k]) is not int or not 0 <= winner[k] <= 8_000_000
                           for k in ("forward_laps", "physical_contacts", "collision_updates"))
                    or (winner["total_actual_distance"] is not None and not _is_number(winner["total_actual_distance"], 0, 1e12))
                    or winner["reason"] is not None):
                raise BundleError("available winner observations are invalid")
            if not isinstance(artifact, dict) or set(artifact) != {"name", "bytes", "sha256"}:
                raise BundleError("available winner artifact metadata is invalid")
            content = inner.get(expected_name)
            if (artifact["name"] != expected_name or content is None
                    or artifact["bytes"] != len(content)
                    or artifact["sha256"] != hashlib.sha256(content).hexdigest()):
                raise BundleError("winner file does not match its analysis manifest")
            if _game_network_input(content)["Type"] != conditions["vehicle_type"]:
                raise BundleError("winner network vehicle does not match the analysis conditions")
        else:
            if (artifact is not None or expected_name in inner or not isinstance(winner["reason"], str)
                    or any(winner[k] is not None for k in ("candidate_id", "generation", "car", "selection_fitness",
                        "best_lap_seconds", "forward_laps", "physical_contacts", "collision_updates", "total_actual_distance"))):
                raise BundleError("unavailable winner metadata is invalid")
    if mode == "train" and winners["fitness"]["status"] != "available":
        raise BundleError("training analysis requires its fitness winner")
    if mode == "evaluate" and any(winners[role]["status"] != "unavailable" for role in winners):
        raise BundleError("evaluation analysis cannot select winners")
    expected_files = {"analysis.json", "descriptors.jsonl"}
    if "stars.json" in inner:
        from star_check import validate_star_check
        star_check = _parse_json(inner["stars.json"], limit=ANALYSIS_JSON_LIMIT, label="star check")
        primary_sha = (winners["fitness"]["artifact"]["sha256"] if mode == "train"
                       else conditions["network_sha256"])
        try:
            validate_star_check(star_check, network_sha256=primary_sha,
                                track_sha256=conditions["track_sha256"],
                                vehicle_type=conditions["vehicle_type"], backend=analysis["execution_backend"])
            if star_check["collision_elimination"] != conditions["collision"]:
                raise ValueError("Star check elimination setting mismatch")
        except (KeyError, TypeError, ValueError) as exc:
            raise BundleError("Star check does not match this result") from exc
        expected_files.add("stars.json")
    if mode == "train":
        expected_files |= {f"winners/{role}.evolution" for role in winners if winners[role]["status"] == "available"}
    else:
        expected_files.add("evaluation.json")
    if set(inner) != expected_files:
        raise BundleError("analysis archive file set does not match its mode and winner manifest")
    if mode == "evaluate":
        evaluation = _parse_json(inner["evaluation.json"], limit=ANALYSIS_JSON_LIMIT, label="evaluation metadata")
        if (not isinstance(evaluation, dict)
                or set(evaluation) != {"schema", "version", "conditions", "input_sha256", "weights_unchanged", "measurements"}
                or evaluation.get("schema") != "ald.frozen-evaluation"
                or type(evaluation.get("version")) is not int or evaluation["version"] != 1
                or evaluation.get("conditions") != conditions
                or evaluation.get("weights_unchanged") is not True
                or evaluation.get("input_sha256") != conditions["network_sha256"]):
            raise BundleError("frozen evaluation metadata is invalid")
        rows = list(io.BytesIO(inner["descriptors.jsonl"]))
        if len(rows) != 1 or _parse_json(rows[0].rstrip(b"\n"), limit=64 * 1024, label="evaluation descriptor") != evaluation.get("measurements"):
            raise BundleError("frozen evaluation measurement does not match its descriptor")
    selected_ids = {winner["candidate_id"]: (role, winner) for role, winner in winners.items()
                    if winner["status"] == "available"}
    selected_rows = {}
    population = expected_generation_cars
    expected_role_rows: dict[str, dict[str, Any] | None] = {"fitness": None, "fastest_lap": None, "clean_laps": None}
    for index, line in enumerate(io.BytesIO(inner["descriptors.jsonl"])):
        line = line[:-1] if line.endswith(b"\n") else line
        row = _parse_json(line, limit=64 * 1024, label="analysis descriptor row")
        expected_generation = index // population + 1
        expected_car = index % population
        if row["generation"] != expected_generation or row["car"] != expected_car:
            raise BundleError("analysis descriptor ordering is invalid")
        if mode == "train":
            if row["generation"] == observations["generations"]:
                current = expected_role_rows["fitness"]
                if current is None or row["selection_fitness"] > current["selection_fitness"]:
                    expected_role_rows["fitness"] = row
            lap = row["objectives"]["best_lap_seconds"]
            forward_laps = row["objectives"]["forward_laps"]
            if lap is not None and lap > 0 and forward_laps >= 1:
                current = expected_role_rows["fastest_lap"]
                if current is None or lap < current["objectives"]["best_lap_seconds"]:
                    expected_role_rows["fastest_lap"] = row
                if (forward_laps >= conditions["clean_min_laps"]
                        and row["objectives"]["physical_contacts"] == 0):
                    current = expected_role_rows["clean_laps"]
                    if current is None or lap < current["objectives"]["best_lap_seconds"]:
                        expected_role_rows["clean_laps"] = row
        if row["candidate_id"] in selected_ids:
            selected_rows[row["candidate_id"]] = row
    if set(selected_rows) != set(selected_ids):
        raise BundleError("winner metadata does not identify observed descriptor rows")
    for role, expected in expected_role_rows.items():
        winner = winners[role]
        if expected is None:
            expected_reason = "no_completed_lap" if role == "fastest_lap" else "no_eligible_clean_laps"
            if mode == "evaluate":
                expected_reason = "frozen_evaluation_does_not_select_winners"
            if winner["status"] != "unavailable" or winner["reason"] != expected_reason:
                raise BundleError("winner availability does not match the complete descriptor stream")
        elif winner["status"] != "available" or winner["candidate_id"] != expected["candidate_id"]:
            raise BundleError("winner selection does not match the complete descriptor stream")
    for candidate_id, (role, winner) in selected_ids.items():
        row = selected_rows[candidate_id]
        objective = row["objectives"]
        if (winner["generation"] != row["generation"] or winner["car"] != row["car"]
                or winner["selection_fitness"] != row["selection_fitness"]
                or _network_weights_sha256(inner[f"winners/{role}.evolution"]) != row["weights_sha256"]
                or any(winner[key] != objective[key] for key in (
                    "best_lap_seconds", "forward_laps", "physical_contacts", "collision_updates", "total_actual_distance"))):
            raise BundleError("winner metadata does not match its observed descriptor")
    return analysis, inner


def make_analysis_archive(files: Any, *, primary: bytes, analysis_summary: Any = None) -> bytes:
    if (not isinstance(files, dict) or not files
            or any(not isinstance(name, str) for name in files)):
        raise BundleError("analysis files must be a nonempty mapping")
    if not isinstance(analysis_summary, dict):
        raise BundleError("public analysis summary is required")
    entries = []
    total = 0
    for name in sorted(files):
        limit = _analysis_member_limit(name) if isinstance(name, str) else 0
        content = files[name]
        if not isinstance(content, bytes) or not content or len(content) > limit:
            raise BundleError("analysis member is not bounded bytes")
        total += len(content)
        if total > MAX_ANALYSIS_FILE_BYTES:
            raise BundleError("analysis files exceed 192 MiB")
        entries.append({"name": name, "bytes": len(content),
                        "sha256": hashlib.sha256(content).hexdigest(),
                        "data_base64": base64.b64encode(content).decode("ascii")})
    envelope = {"schema": "ald.run-analysis-archive", "version": 1, "files": entries}
    expanded = _json_bytes(envelope)
    if len(expanded) > MAX_ANALYSIS_EXPANDED:
        raise BundleError("expanded analysis archive exceeds 256 MiB")
    raw = gzip.compress(expanded, mtime=0)
    if len(raw) > MAX_ANALYSIS_ARCHIVE:
        raise BundleError("compressed analysis archive exceeds 32 MiB")
    analysis, members = load_analysis_archive(raw)
    fitness = members.get("winners/fitness.evolution")
    if analysis.get("mode") == "train" and fitness != primary:
        raise BundleError("primary result is not the manifested final fitness winner")
    if (analysis.get("mode") == "evaluate"
            and hashlib.sha256(primary).hexdigest() != analysis.get("conditions", {}).get("network_sha256")):
        raise BundleError("frozen evaluation primary is not the original input network")
    projection = {key: analysis.get(key) for key in ANALYSIS_SUMMARY_KEYS}
    if analysis_summary != projection:
        raise BundleError("public analysis summary does not match the private analysis archive")
    return raw


def _no_constant(value: str) -> None:
    raise BundleError(f"Non-finite JSON number is not allowed: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise BundleError(f"Duplicate JSON key: {key}")
        out[key] = value
    return out


def _json_bytes(value: Any) -> bytes:
    try:
        return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as exc:
        raise BundleError("Value is not valid portable JSON") from exc


def _parse_json(raw: bytes, *, limit: int, label: str) -> Any:
    if len(raw) > limit:
        raise BundleError(f"{label} exceeds its byte limit")
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_no_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        raise BundleError(f"{label} must be valid UTF-8 JSON") from exc


def _strict_keys(value: Any, allowed: set[str], required: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise BundleError(f"{label} must be an object")
    keys = set(value)
    if not required <= keys or keys - allowed:
        raise BundleError(f"{label} has missing or unsupported fields")
    return value


def _is_int(value: Any, low: int, high: int) -> bool:
    return type(value) is int and low <= value <= high


def _is_number(value: Any, low: float, high: float) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def validate_freeze(value: Any) -> dict[str, list[int]]:
    """Validate the fixed-index network freeze mask used by hosted recipes and reports."""
    if not isinstance(value, dict) or set(value) != {"layers", "inputs", "outputs"}:
        raise BundleError("recipe freeze mask has unsupported fields")
    bounds = {"layers": (1, 10), "inputs": (0, 19), "outputs": (0, 4)}
    for key, (low, high) in bounds.items():
        indices = value[key]
        if (not isinstance(indices, list)
                or any(type(index) is not int or not low <= index <= high for index in indices)
                or indices != sorted(set(indices))):
            raise BundleError("recipe freeze mask indices are invalid")
    return value


def validate_settings(value: Any) -> dict[str, Any]:
    settings = _strict_keys(value, RECIPE_KEYS, LEGACY_RECIPE_KEYS, "recipe settings")
    settings.setdefault("mode", "train")
    settings.setdefault("clean_min_laps", 2)
    if "freeze" in settings:
        validate_freeze(settings["freeze"])
    bounds = {
        "population": (1, 1024), "generations": (1, 2000), "ticks": (1, 18000),
        "seed": (0, 2147483647), "parents": (1, 1024), "elite": (0, 1024), "workers": (1, 4),
        "clean_min_laps": (1, 100),
    }
    if any(not _is_int(settings[k], *bounds[k]) for k in bounds):
        raise BundleError("recipe settings contain an out-of-range integer")
    for key in ("mutation", "mutation_end"):
        if not _is_number(settings[key], 0, 4.2):
            raise BundleError("recipe mutation rates must be finite and between 0 and 4.2")
    if not isinstance(settings["mode"], str) or settings["mode"] not in {"train", "evaluate"}:
        raise BundleError("recipe mode is unsupported")
    if settings["mode"] == "train" and (settings["mutation"] <= 0 or (settings["schedule"] != "fixed" and settings["mutation_end"] <= 0)):
        raise BundleError("recipe mutation rates must be positive for the selected schedule")
    if settings["mode"] == "evaluate" and (settings["population"] != 1 or settings["generations"] != 1
            or settings["mutation"] != 0 or settings["mutation_end"] != 0 or settings["decay"] != 0
            or settings["adaptive_mutation"] is not False or settings["parents"] != 1 or settings["elite"] != 0):
        raise BundleError("frozen evaluation settings are not canonical")
    if not _is_number(settings["decay"], 0, 1):
        raise BundleError("recipe decay must be between 0 and 1")
    choices = {
        "schedule": {"fixed", "linear", "geometric"},
        "selection": {"best", "tournament", "roulette"},
        "crossover": {"none", "single_point", "uniform"},
        "control_hz": {15, 30, 60},
    }
    if any(type(settings[k]) is not str for k in ("schedule", "selection", "crossover")):
        raise BundleError("recipe contains an unsupported option")
    if any(settings[k] not in values for k, values in choices.items()):
        raise BundleError("recipe contains an unsupported option")
    if type(settings["control_hz"]) is not int:
        raise BundleError("recipe control_hz must be an integer")
    if any(type(settings[k]) is not bool for k in ("adaptive_mutation", "collision", "idle")):
        raise BundleError("recipe boolean setting is invalid")
    if settings["parents"] > settings["population"] or settings["elite"] > settings["population"]:
        raise BundleError("recipe parents or elite exceeds population")
    rewards = settings["rewards"]
    if not isinstance(rewards, list) or not 1 <= len(rewards) <= len(METRICS):
        raise BundleError("recipe must have between one and fourteen distinct rewards")
    seen: set[str] = set()
    for reward in rewards:
        _strict_keys(reward, {"metric", "type", "weight"}, {"metric", "type", "weight"}, "reward")
        if (not isinstance(reward["metric"], str) or not isinstance(reward["type"], str)
                or reward["metric"] not in METRICS or reward["type"] not in {"default", "average"}
                or reward["metric"] in seen or not _is_int(reward["weight"], -100, 100)):
            raise BundleError("recipe reward is invalid or duplicated")
        seen.add(reward["metric"])
    if all(reward["weight"] == 0 for reward in rewards):
        raise BundleError("recipe rewards must include a nonzero weight")
    return settings


def validate_recipe(value: Any) -> dict[str, Any]:
    recipe = _strict_keys(value, {"version", "slot", "name", "settings"}, {"version", "slot", "name", "settings"}, "selected recipe")
    if recipe["version"] != 1 or type(recipe["version"]) is not int:
        raise BundleError("selected recipe version is unsupported")
    if not isinstance(recipe["slot"], str) or not re.fullmatch(r"[A-J]", recipe["slot"]):
        raise BundleError("selected recipe slot must be A through J")
    if not isinstance(recipe["name"], str) or not recipe["name"].strip() or len(recipe["name"]) > 80:
        raise BundleError("selected recipe name must contain 1 to 80 characters")
    validate_settings(recipe["settings"])
    return recipe


def validate_receipt(value: Any, *, allow_analysis_summary: bool = False) -> dict[str, Any]:
    receipt = _strict_keys(value, RECEIPT_KEYS, RECEIPT_KEYS, "run receipt")
    if type(receipt["version"]) is not int or receipt["version"] != 1 or receipt["kind"] != "run":
        raise BundleError("run receipt version or kind is unsupported")
    if (not isinstance(receipt["state"], str) or receipt["state"] != "completed"
            or not isinstance(receipt["backend"], str) or receipt["backend"] not in {"cpu", "gpu"}):
        raise BundleError("run receipt state or backend is unsupported")
    if not isinstance(receipt["build_id"], str) or len(receipt["build_id"]) > 128 or not re.fullmatch(r"[A-Za-z0-9._:+-]+", receipt["build_id"]):
        raise BundleError("run receipt build id is invalid")
    if not isinstance(receipt["output_sha256"], str) or not HEX64.fullmatch(receipt["output_sha256"]):
        raise BundleError("run receipt output hash is invalid")
    optional_report = {"history"}
    if allow_analysis_summary:
        optional_report.add("analysis_summary")
    report = _strict_keys(receipt["report"], REPORT_KEYS | optional_report, REPORT_KEYS, "run receipt report")
    if "analysis_summary" in report:
        if not allow_analysis_summary:
            raise BundleError("legacy run receipt contains unsupported analysis summary")
        summary = _strict_keys(report["analysis_summary"], ANALYSIS_SUMMARY_KEYS,
                               ANALYSIS_SUMMARY_KEYS, "analysis summary")
        if (summary["schema"] != "ald.run-analysis" or type(summary["version"]) is not int
                or summary["version"] != 1 or not isinstance(summary["mode"], str)
                or summary["mode"] not in {"train", "evaluate"}
                or not isinstance(summary["execution_backend"], str)
                or summary["execution_backend"] not in {"cpu", "cuda"}
                or not isinstance(summary["conditions"], dict)
                or not isinstance(summary["observations"], dict)
                or not isinstance(summary["winners"], dict)):
            raise BundleError("analysis summary is invalid")
    if not _is_int(report["vehicle_type"], 0, 3) or report["vehicle_name"] != ("Formula", "Rally", "Snowmobile", "Truck")[report["vehicle_type"]]:
        raise BundleError("run receipt vehicle is invalid")
    for key in ("generations_completed", "generations_requested", "population", "simulated_ticks", "requested_ticks"):
        if not _is_int(report[key], 0, 8_000_000):
            raise BundleError("run receipt count is invalid")
    if report["generations_requested"] < 1 or report["population"] < 1 or report["requested_ticks"] < 1:
        raise BundleError("run receipt requested counts and population must be positive")
    for key in ("best_score", "mean_score"):
        if not _is_number(report[key], -1e12, 1e12):
            raise BundleError("run receipt metric is non-finite or out of range")
    if not _is_number(report["elapsed_seconds"], 0, 1e12):
        raise BundleError("run receipt elapsed time is invalid")
    if report["best_lap_seconds"] is not None and not _is_number(report["best_lap_seconds"], 0, 1e12):
        raise BundleError("run receipt best lap is invalid")
    if report["best_lap_seconds"] == 0:
        raise BundleError("run receipt best lap must be positive")
    if report["lapped_cars"] is not None and not _is_int(report["lapped_cars"], 0, 1024):
        raise BundleError("run receipt lapped car count is invalid")
    if (report["candidate_validated"] is not True or not isinstance(report["execution_backend"], str)
            or report["execution_backend"] not in {"cpu", "cuda"}):
        raise BundleError("run receipt execution status is invalid")
    hashes = _strict_keys(report["inputs"], INPUT_HASH_KEYS, INPUT_HASH_KEYS, "run receipt inputs")
    if any(not isinstance(hashes[k], str) or not HEX64.fullmatch(hashes[k]) for k in INPUT_HASH_KEYS):
        raise BundleError("run receipt input hash is invalid")
    settings = validate_settings(report["settings"])
    if (report["population"] != settings["population"]
            or report["generations_requested"] != settings["generations"]
            or report["requested_ticks"] != settings["ticks"]):
        raise BundleError("run receipt summary does not match its validated settings")
    if "history" in report:
        history = report["history"]
        if not isinstance(history, list) or len(history) > 2000:
            raise BundleError("run receipt history must contain at most 2000 rows")
        if len(history) != report["generations_completed"]:
            raise BundleError("run receipt history length does not match completed generations")
        for index, row in enumerate(history, 1):
            row = _strict_keys(row, HISTORY_ROW_KEYS, HISTORY_ROW_KEYS, "run receipt history row")
            if not _is_int(row["generation"], 1, 2000) or row["generation"] != index:
                raise BundleError("run receipt history generations must be ordered from one")
            if not _is_number(row["mutation"], 0, 4.2):
                raise BundleError("run receipt history mutation is invalid")
            for key in ("best_score", "mean_score"):
                if not _is_number(row[key], -1e12, 1e12):
                    raise BundleError("run receipt history score is invalid")
            if row["best_lap_seconds"] is not None and not _is_number(row["best_lap_seconds"], 0, 1e12):
                raise BundleError("run receipt history lap is invalid")
            if row["best_lap_seconds"] == 0:
                raise BundleError("run receipt history lap must be positive")
            if row["lapped_cars"] is not None and not _is_int(row["lapped_cars"], 0, 1024):
                raise BundleError("run receipt history lapped-car count is invalid")
            if not _is_int(row["simulated_ticks"], 0, 8_000_000):
                raise BundleError("run receipt history tick count is invalid")
    return receipt


def _bounded_json_payload(raw: bytes, label: str) -> Any:
    """Validate payload JSON with bounded gzip expansion, preserving bytes elsewhere."""
    expanded = raw
    if raw.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                expanded = stream.read(MAX_EXPANDED_JSON + 1)
        except (OSError, EOFError) as exc:
            raise BundleError(f"{label} is not a valid gzip JSON payload") from exc
        if len(expanded) > MAX_EXPANDED_JSON:
            raise BundleError(f"{label} expands beyond 4 MiB")
    value = _parse_json(expanded, limit=MAX_EXPANDED_JSON, label=label)
    if not isinstance(value, dict):
        raise BundleError(f"{label} must contain a JSON object")
    return value


def _validate_game_payload(raw: bytes, label: str, validator: Any) -> None:
    try:
        validator(raw)
    except (ValueError, KeyError, TypeError, OSError, EOFError) as exc:
        raise BundleError(f"{label} does not pass the current game input validator") from exc


def _read_regular_file(path_value: str | Path, *, limit: int, label: str) -> bytes:
    path = Path(path_value).expanduser()
    if not path.is_absolute():
        path = Path.cwd() / path
    # Reject every symlinked component, not only a final symlink.
    absolute = Path(os.path.abspath(path))
    cursor = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        cursor = cursor / part
        if cursor.is_symlink():
            raise BundleError(f"{label} path includes a symlink")
    try:
        st = absolute.stat()
    except OSError as exc:
        raise BundleError(f"{label} file cannot be read") from exc
    if not absolute.is_file() or st.st_size > limit:
        raise BundleError(f"{label} must be a regular file no larger than its limit")
    try:
        raw = absolute.read_bytes()
    except OSError as exc:
        raise BundleError(f"{label} file cannot be read") from exc
    if len(raw) > limit:
        raise BundleError(f"{label} exceeds its byte limit")
    return raw


def _slot(role: str, raw: bytes, *, fmt: str) -> dict[str, Any]:
    return {
        "format": fmt,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "data_base64": base64.b64encode(raw).decode("ascii"),
    }


def _decode_slot(value: Any, *, role: str, limit: int, fmt: str, allowed_extra: set[str], required_extra: set[str]) -> bytes:
    allowed = {"format", "bytes", "sha256", "data_base64"} | allowed_extra
    required = {"format", "bytes", "sha256", "data_base64"} | required_extra
    item = _strict_keys(value, allowed, required, role)
    if item["format"] != fmt:
        raise BundleError(f"{role} format is unsupported")
    if type(item["bytes"]) is not int or item["bytes"] < 0 or item["bytes"] > limit:
        raise BundleError(f"{role} byte count exceeds its limit")
    if not isinstance(item["sha256"], str) or not HEX64.fullmatch(item["sha256"]):
        raise BundleError(f"{role} SHA-256 is invalid")
    encoded = item["data_base64"]
    if not isinstance(encoded, str) or len(encoded) > 4 * ((limit + 2) // 3):
        raise BundleError(f"{role} base64 content exceeds its limit")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise BundleError(f"{role} base64 content is invalid") from exc
    if len(raw) != item["bytes"] or len(raw) > limit:
        raise BundleError(f"{role} byte count does not match its data")
    if hashlib.sha256(raw).hexdigest() != item["sha256"]:
        raise BundleError(f"{role} SHA-256 does not match its data")
    return raw


def _decode_analysis_slot(value: Any) -> bytes:
    slot = _strict_keys(value, {"format", "bytes", "sha256", "data_base64"},
                        {"format", "bytes", "sha256", "data_base64"}, "analysis archive slot")
    return _decode_slot(slot, role="analysis archive", limit=MAX_ANALYSIS_ARCHIVE,
                        fmt=ANALYSIS_ARCHIVE_FORMAT, allowed_extra=set(), required_extra=set())


def load_bundle(raw: bytes, *, catalog_path: Path | None = None) -> tuple[dict[str, Any], dict[str, bytes]]:
    value = _parse_json(raw, limit=MAX_BUNDLE, label="bundle")
    bundle = _strict_keys(value, {"schema", "version", "artifacts"}, {"schema", "version", "artifacts"}, "bundle")
    version = bundle["version"]
    if bundle["schema"] != SCHEMA or type(version) is not int or version not in {1, 2}:
        raise BundleError("bundle schema or version is unsupported")
    if version == 1 and len(raw) > MAX_BUNDLE_V1:
        raise BundleError("legacy bundle exceeds its 8 MiB limit")
    artifacts = bundle["artifacts"]
    allowed_artifacts = {"selected_network", "selected_track", "selected_recipe", "run_receipt"}
    if version == 2:
        allowed_artifacts.add("analysis_archive")
    if (not isinstance(artifacts, dict) or not {"selected_network"} <= set(artifacts)
            or set(artifacts) - allowed_artifacts
            or (version == 2 and "analysis_archive" not in artifacts)):
        raise BundleError("bundle must contain a selected network and only supported optional artifacts")
    files: dict[str, bytes] = {}
    net = _strict_keys(artifacts["selected_network"], {"format", "kind", "bytes", "sha256", "data_base64"}, {"format", "kind", "bytes", "sha256", "data_base64"}, "selected network")
    if not isinstance(net["kind"], str) or net["kind"] not in {"input", "result"}:
        raise BundleError("selected network kind is unsupported")
    files["selected_network.evolution"] = _decode_slot(net, role="selected network", limit=MAX_NETWORK, fmt="evolution", allowed_extra={"kind"}, required_extra={"kind"})
    _bounded_json_payload(files["selected_network.evolution"], "selected network")
    _validate_game_payload(files["selected_network.evolution"], "selected network", _game_network_input)

    if "selected_track" in artifacts:
        track = artifacts["selected_track"]
        if not isinstance(track, dict):
            raise BundleError("selected track must be an object")
        source = track.get("source")
        base_extra = {"source"}
        req_extra = {"source"}
        if source == "builtin":
            base_extra |= {"track_id", "display_name"}
            req_extra |= {"track_id", "display_name"}
            if not isinstance(track.get("track_id"), str) or not isinstance(track.get("display_name"), str):
                raise BundleError("built-in track metadata is invalid")
            catalog_path = catalog_path or PACKAGE_ROOT / "builtin_tracks/catalog.json"
            catalog = _parse_json(catalog_path.read_bytes(), limit=2 * 1024 * 1024, label="built-in track catalog")
            matched = [x for x in catalog.get("tracks", []) if x.get("id") == track["track_id"] and x.get("display_name") == track["display_name"]]
            if len(matched) != 1:
                raise BundleError("built-in track id and label must match the local catalog")
        elif source == "upload":
            if "track_id" in track or "display_name" in track:
                raise BundleError("uploaded track must not include built-in catalog metadata")
        else:
            raise BundleError("selected track source is unsupported")
        files["selected_track.track"] = _decode_slot(track, role="selected track", limit=MAX_TRACK, fmt="track", allowed_extra=base_extra, required_extra=req_extra)
        if source == "builtin" and (len(files["selected_track.track"]) != matched[0].get("bytes")
                                    or hashlib.sha256(files["selected_track.track"]).hexdigest() != matched[0].get("sha256")):
            raise BundleError("built-in track bytes do not match the selected catalog entry")
        _bounded_json_payload(files["selected_track.track"], "selected track")
        _validate_game_payload(files["selected_track.track"], "selected track", _game_track_input)

    if "selected_recipe" in artifacts:
        recipe = validate_recipe(artifacts["selected_recipe"])
        recipe_bytes = _json_bytes(recipe)
        if len(recipe_bytes) > MAX_RECIPE:
            raise BundleError("selected recipe exceeds 32 KiB")
        files["selected_recipe.json"] = recipe_bytes

    analysis = None
    analysis_members: dict[str, bytes] = {}
    if version == 2:
        archive_bytes = _decode_analysis_slot(artifacts["analysis_archive"])
        analysis, analysis_members = load_analysis_archive(archive_bytes)
        files["analysis_archive.gz"] = archive_bytes
        files.update({f"analysis/{name}": content for name, content in analysis_members.items()})
        if net["kind"] != "result" or "run_receipt" not in artifacts or "selected_track" not in artifacts:
            raise BundleError("analysis bundles must contain a result network and run receipt")

    if "run_receipt" in artifacts:
        receipt = validate_receipt(artifacts["run_receipt"], allow_analysis_summary=version == 2)
        report = receipt["report"]
        network_sha = net["sha256"]
        if version == 2:
            if not isinstance(report.get("analysis_summary"), dict):
                raise BundleError("v2 run receipt is missing its analysis summary")
            projection = {key: analysis.get(key) for key in ANALYSIS_SUMMARY_KEYS}
            if report["analysis_summary"] != projection:
                raise BundleError("run receipt analysis summary does not match its archive")
            conditions = analysis.get("conditions")
            if (not isinstance(conditions, dict)
                    or conditions.get("track_sha256") != report["inputs"]["track_sha256"]
                    or conditions.get("network_sha256") != report["inputs"]["network_sha256"]
                    or conditions.get("vehicle_type") != report["vehicle_type"]
                    or conditions.get("requested_ticks") != report["requested_ticks"]
                    or analysis.get("execution_backend") != report["execution_backend"]):
                raise BundleError("analysis archive conditions do not match the run receipt")
            if analysis.get("mode") == "evaluate":
                evaluation = _parse_json(analysis_members["evaluation.json"], limit=ANALYSIS_JSON_LIMIT,
                                         label="evaluation metadata")
                if (evaluation.get("schema") != "ald.frozen-evaluation"
                        or evaluation.get("version") != 1
                        or evaluation.get("weights_unchanged") is not True
                        or evaluation.get("input_sha256") != report["inputs"]["network_sha256"]
                        or network_sha != report["inputs"]["network_sha256"]):
                    raise BundleError("frozen evaluation does not preserve the input network")
                if _network_weights_sha256(files["selected_network.evolution"]) != evaluation["measurements"]["weights_sha256"]:
                    raise BundleError("frozen evaluation descriptor does not match the input weights")
            else:
                fitness = analysis["winners"]["fitness"]
                fitness_bytes = analysis_members["winners/fitness.evolution"]
                if (fitness.get("artifact", {}).get("sha256") != receipt["output_sha256"]
                        or hashlib.sha256(fitness_bytes).hexdigest() != receipt["output_sha256"]):
                    raise BundleError("run output hash does not match its final fitness winner")
                selected_is_winner = any(
                    analysis["winners"][role]["status"] == "available"
                    and analysis_members.get(f"winners/{role}.evolution") == files["selected_network.evolution"]
                    for role in ("fitness", "fastest_lap", "clean_laps")
                )
                if not selected_is_winner:
                    raise BundleError("selected network is not byte-identical to an archived winner")
        elif net["kind"] == "input":
            network_matches = report["inputs"]["network_sha256"] == network_sha
        else:
            network_matches = receipt["output_sha256"] == network_sha
        if version == 1 and not network_matches:
            raise BundleError("run receipt does not describe the bundled network")
        if "selected_track" in artifacts and report["inputs"]["track_sha256"] != artifacts["selected_track"]["sha256"]:
            raise BundleError("run receipt does not describe the bundled track")
        if receipt["backend"] == "cpu" and report["execution_backend"] != "cpu":
            raise BundleError("run receipt backend does not match its execution backend")
        if receipt["backend"] == "gpu" and report["execution_backend"] != "cuda":
            raise BundleError("run receipt backend does not match its execution backend")
        receipt_bytes = _json_bytes(receipt)
        if len(receipt_bytes) > MAX_RECEIPT:
            raise BundleError("run receipt exceeds 512 KiB")
        files["run_receipt.json"] = receipt_bytes
    return bundle, files

