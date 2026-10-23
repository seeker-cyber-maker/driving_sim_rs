"""Isolated, user-token-only Hugging Face Bucket operations for the API."""
from __future__ import annotations

import base64
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import uuid

from portable_bundle import (
    BundleError, MAX_BUNDLE, MAX_NETWORK, MAX_ANALYSIS_ARCHIVE,
    MAX_ANALYSIS_FILE_BYTES, load_bundle, validate_freeze,
)
from worker import network_input

HF_ENDPOINT = "https://huggingface.co"
MAX_REQUEST = 2 * MAX_BUNDLE + 64 * 1024
MAX_RECIPE_LIBRARY = 32 * 1024
MAX_CHILD_INPUT = 4 * ((MAX_BUNDLE + 2) // 3) + 64 * 1024
MAX_CHILD_OUTPUT = 128 * 1024
CHILD_TIMEOUT_SECONDS = 55
MAX_LIST_SCAN = 10_000
MAX_LIST_RESULTS = 50
LEGACY_APP_KEY = re.compile(r"^ald-exports/([0-9a-f]{32}|[0-9a-f]{64})/bundle\.json$")
RECIPE_APP_KEY = re.compile(r"^ald-recipes/(?P<timestamp>[0-9]{8}T[0-9]{6}Z)-(?P<uuid>[0-9a-f]{32})/library\.json$")
AUTOSAVE_APP_KEY = re.compile(
    r"^ald-exports/(?P<timestamp>[0-9]{8}T[0-9]{6}Z)-"
    r"(?P<track>[a-z0-9][a-z0-9-]{0,63})-"
    r"(?P<vehicle>formula|rally|snowmobile|truck)-"
    r"g(?P<generations>0|[1-9][0-9]{0,3})-"
    r"lap(?P<lap>none|[0-9]{1,16}ms)-(?P<uuid>[0-9a-f]{32})/bundle\.json$"
)
VEHICLE_NAMES = ("Formula", "Rally", "Snowmobile", "Truck")
MAX_SIDECAR_TOTAL = 320 * 1024 * 1024
BUCKET_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class BucketStorageError(Exception):
    """Safe error category; never carries upstream text or credentials."""

    def __init__(self, category: str):
        self.category = category
        super().__init__(category)


def valid_bucket_id(value: object) -> bool:
    return isinstance(value, str) and bool(BUCKET_ID.fullmatch(value))


def valid_bundle_key(value: object) -> bool:
    return isinstance(value, str) and bool(LEGACY_APP_KEY.fullmatch(value) or AUTOSAVE_APP_KEY.fullmatch(value))


def valid_recipe_key(value: object) -> bool:
    if not isinstance(value, str):
        return False
    match = RECIPE_APP_KEY.fullmatch(value)
    if match is None:
        return False
    try:
        datetime.strptime(match.group("timestamp"), "%Y%m%dT%H%M%SZ")
    except ValueError:
        return False
    return True


RECIPE_DEFAULT_SETTINGS = {
    "population": 4, "generations": 1, "ticks": 60, "mutation": 0.01,
    "seed": 42, "mutation_end": 0.01, "schedule": "fixed", "selection": "best",
    "parents": 1, "elite": 1, "crossover": "none", "decay": 0,
    "adaptive_mutation": False, "control_hz": 60, "workers": 1,
    "collision": False, "idle": False,
    "rewards": [{"metric": "total_score", "type": "default", "weight": 100}],
}
RECIPE_METRICS = {
    "total_score", "total_speed", "total_abs_steering", "total_actual_distance",
    "total_drifting_amount", "total_momentum_change_frequency", "total_throttle_change_frequency",
    "total_braking_frequency", "total_distance_from_wall", "total_distance_from_center",
    "network_novelty", "collision_count", "best_lap_performance", "total_racing_line_efficiency",
}


def validate_recipe_library(raw: bytes) -> dict:
    """Validate the existing browser RecipeLibrary v1 format, without storing other app data."""
    if not isinstance(raw, bytes) or len(raw) > MAX_RECIPE_LIBRARY:
        raise ValueError("Invalid recipe library")

    def unique_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("Duplicate recipe field")
            value[key] = item
        return value

    try:
        book = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=lambda _value: (_ for _ in ()).throw(ValueError("Invalid number")))
    except Exception:
        raise ValueError("Invalid recipe library") from None
    if not isinstance(book, dict) or set(book) not in ({"version", "recipes"}, {"version", "recipes", "batches"}):
        raise ValueError("Invalid recipe library")
    if type(book.get("version")) is not int or book["version"] != 1:
        raise ValueError("Invalid recipe library")
    recipes = book.get("recipes")
    if not isinstance(recipes, list) or len(recipes) > 10:
        raise ValueError("Invalid recipe library")
    seen = set()
    for recipe in recipes:
        if not isinstance(recipe, dict) or set(recipe) != {"slot", "name", "settings"}:
            raise ValueError("Invalid recipe library")
        slot, name = recipe["slot"], recipe["name"]
        if not isinstance(slot, str) or not re.fullmatch(r"[A-J]", slot) or slot in seen:
            raise ValueError("Invalid recipe library")
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError("Invalid recipe library")
        seen.add(slot)
        settings = recipe["settings"]
        if (not isinstance(settings, dict)
                or set(settings) - (set(RECIPE_DEFAULT_SETTINGS) | {"freeze"})):
            raise ValueError("Invalid recipe library")
        if "freeze" in settings:
            validate_freeze(settings["freeze"])
        clean = {**RECIPE_DEFAULT_SETTINGS, **settings}
        numeric = {
            "population": (1, 1024, True), "generations": (1, 2000, True),
            "ticks": (1, 18000, True), "mutation": (0, 4.2, False),
            "mutation_end": (0, 4.2, False), "seed": (0, 2147483647, True),
            "parents": (1, 1024, True), "elite": (0, 1024, True),
            "decay": (0, 1, False), "workers": (1, 4, True),
        }
        for key, (low, high, integer) in numeric.items():
            value = clean[key]
            if (type(value) not in (int, float) or not low <= value <= high
                    or (integer and not float(value).is_integer())):
                raise ValueError("Invalid recipe library")
        enums = {"schedule": {"fixed", "linear", "geometric"},
                 "selection": {"best", "tournament", "roulette"},
                 "crossover": {"none", "single_point", "uniform"},
                 "control_hz": {60, 30, 15}}
        for key, choices in enums.items():
            if type(clean[key]) not in (str, int, float) or clean[key] not in choices:
                raise ValueError("Invalid recipe library")
        for key in ("adaptive_mutation", "collision", "idle"):
            if type(clean[key]) is not bool:
                raise ValueError("Invalid recipe library")
        if clean["parents"] > clean["population"] or clean["elite"] > clean["population"] or clean["mutation"] <= 0:
            raise ValueError("Invalid recipe library")
        if clean["schedule"] != "fixed" and clean["mutation_end"] <= 0:
            raise ValueError("Invalid recipe library")
        rewards = clean["rewards"]
        if not isinstance(rewards, list) or not 1 <= len(rewards) <= len(RECIPE_METRICS):
            raise ValueError("Invalid recipe library")
        reward_metrics = set()
        for reward in rewards:
            if not isinstance(reward, dict) or set(reward) != {"metric", "type", "weight"}:
                raise ValueError("Invalid recipe library")
            metric, reward_type, weight = reward["metric"], reward["type"], reward["weight"]
            if (not isinstance(metric, str) or metric not in RECIPE_METRICS
                    or not isinstance(reward_type, str) or reward_type not in {"default", "average"}
                    or metric in reward_metrics or type(weight) not in (int, float)
                    or not -100 <= weight <= 100 or not float(weight).is_integer()):
                raise ValueError("Invalid recipe library")
            reward_metrics.add(metric)
        if not any(reward["weight"] for reward in rewards):
            raise ValueError("Invalid recipe library")

    batches = book.get("batches", [])
    if not isinstance(batches, list) or len(batches) > 10:
        raise ValueError("Invalid recipe library")
    batch_slots = set()
    for batch in batches:
        if not isinstance(batch, dict) or set(batch) != {"slot", "name", "carry", "runs"}:
            raise ValueError("Invalid recipe library")
        slot, name, runs = batch["slot"], batch["name"], batch["runs"]
        if (not isinstance(slot, str) or not re.fullmatch(r"[A-J]", slot) or slot in batch_slots
                or not isinstance(name, str) or not name.strip() or len(name) > 80
                or type(batch["carry"]) is not bool or not isinstance(runs, list) or not 1 <= len(runs) <= 100
                or any(not isinstance(run, str) or run not in seen for run in runs)):
            raise ValueError("Invalid recipe library")
        batch_slots.add(slot)
    return book


def _recipe_list_metadata(key: str, uploaded: object) -> tuple[str, str | None]:
    match = RECIPE_APP_KEY.fullmatch(key)
    if match is None:
        raise BucketStorageError("invalid_request")
    try:
        path_when = datetime.strptime(match.group("timestamp"), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        path_when = None
    when = _valid_utc_datetime(uploaded) or path_when
    if when is None:
        return f"Saved recipe library · {match.group('uuid')[:8]}", None
    created_at = when.isoformat(timespec="microseconds").replace("+00:00", "Z")
    return f"Recipe library · {when.strftime('%Y-%m-%d %H:%M UTC')} · {match.group('uuid')[:8]}", created_at


def _autosave_prefix(bundle: dict, files: dict[str, bytes], now: datetime | None = None) -> tuple[str, str, str]:
    artifacts = bundle["artifacts"]
    receipt = artifacts.get("run_receipt")
    track = artifacts.get("selected_track")
    track_id = _track_path_slug(track)
    if receipt is not None:
        report = receipt["report"]
        vehicle_type = report["vehicle_type"]
        generations = report["generations_completed"]
        lap = report["best_lap_seconds"]
    else:
        try:
            vehicle_type = network_input(files["selected_network.evolution"])["Type"]
        except Exception:
            raise BucketStorageError("invalid_bundle") from None
        generations = 0
        lap = None
    vehicle = VEHICLE_NAMES[vehicle_type]
    timestamp = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lap_part = "none" if lap is None else f"{int(round(lap * 1000))}ms"
    segment = f"{timestamp}-{track_id}-{vehicle.lower()}-g{generations}-lap{lap_part}-{uuid.uuid4().hex}"
    return f"ald-exports/{segment}", track_id, timestamp


def _readable_track(track_id: str, track: dict | None) -> str:
    if isinstance(track, dict) and track.get("source") == "builtin":
        return _track_path_slug(track)
    if track_id == "custom":
        return "custom-track"
    return "custom-track"


def winner_sidecar_filename(track_slug: str, vehicle: str, timestamp: str, unique: str, role: str) -> str:
    role_label = {"fitness": "fitness-winner", "fastest_lap": "fastest-lap-winner",
                  "clean_laps": "clean-laps-winner"}.get(role)
    if (not role_label or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", track_slug)
            or vehicle not in {"formula", "rally", "snowmobile", "truck"}
            or not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z", timestamp)
            or not re.fullmatch(r"[0-9a-f]{8}", unique)):
        raise BucketStorageError("invalid_bundle")
    return f"{track_slug}-{vehicle}-{timestamp}-{unique}-{role_label}.evolution"


def _track_path_slug(track: dict | None) -> str:
    if isinstance(track, dict) and track.get("source") == "builtin":
        display_name = track.get("display_name")
        if isinstance(display_name, str):
            slug = re.sub(r"[^A-Za-z0-9]+", "-", display_name).strip("-").lower()[:64].strip("-")
            if slug and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", slug):
                return slug
        track_id = track.get("track_id")
        if isinstance(track_id, str):
            fragment = re.sub(r"[^A-Za-z0-9]+", "-", track_id).strip("-").lower()[:48].strip("-")
            if fragment:
                return "track-" + fragment
    return "custom-track"


def _render_history_csv(report: dict) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    fields = ("generation", "mutation", "best_score", "mean_score", "best_lap_seconds", "lapped_cars", "simulated_ticks")
    writer.writerow(fields)
    for row in report.get("history", []):
        writer.writerow(["" if row[field] is None else row[field] for field in fields])
    return stream.getvalue().encode("utf-8")


def _render_report(bundle: dict) -> bytes:
    artifacts = bundle["artifacts"]
    receipt = artifacts["run_receipt"]
    report = receipt["report"]
    track = artifacts.get("selected_track")
    summary = report.get("analysis_summary")
    evaluation = isinstance(summary, dict) and summary.get("mode") == "evaluate"
    track_label = track.get("display_name", "Built-in track") if isinstance(track, dict) and track.get("source") == "builtin" else "Custom or uploaded track"
    lap = report["best_lap_seconds"]
    lap_label = "No completed lap" if lap is None else f"{lap:.3f} s"
    lines = [
        "# ALD frozen evaluation" if evaluation else "# ALD training run",
        "",
        f"- Track: {track_label}",
        f"- Vehicle: {report['vehicle_name']}",
        f"- Backend: {receipt['backend']} ({report['execution_backend']})",
        f"- Build: {receipt['build_id']}",
        f"- Generations: {report['generations_completed']} completed of {report['generations_requested']} requested",
        f"- Population: {report['population']}",
        f"- Final-generation best score: {report['best_score']}",
        f"- Final-generation mean score: {report['mean_score']}",
        f"- Best completed lap observed during this run: {lap_label}",
        f"- Lapped cars in the final generation: {report['lapped_cars']}",
        f"- Simulated ticks: {report['simulated_ticks']} of {report['requested_ticks']} requested per car",
        f"- Elapsed seconds: {report['elapsed_seconds']:.3f}",
        f"- Exported network SHA-256: {receipt['output_sha256']}",
        "",
        "## Validated run settings",
        "",
    ]
    for key in sorted(report["settings"]):
        lines.append(f"- {key}: `{json.dumps(report['settings'][key], ensure_ascii=True, allow_nan=False, separators=(',', ':'))}`")
    if isinstance(summary, dict):
        lines.extend(["", "## Candidate analysis", "", f"- Mode: {summary['mode']}"])
        if evaluation:
            lines.append("- This is a frozen evaluation; the input network bytes and weights were preserved.")
        else:
            for role in ("fitness", "fastest_lap", "clean_laps"):
                winner = summary["winners"][role]
                if winner["status"] == "available":
                    lines.append(f"- {role.replace('_', ' ').title()}: generation {winner['generation']}, car {winner['car']}, candidate `{winner['candidate_id']}`")
                else:
                    lines.append(f"- {role.replace('_', ' ').title()}: unavailable ({winner['reason']})")
            lines.append("- A run-wide lap winner may be a different car from the exported fitness candidate.")
    elif not evaluation:
        lines.append("- The best completed lap may belong to a different car than the exported candidate.")
    return ("\n".join(lines) + "\n").encode("utf-8")


def _save_files(bundle_bytes: bytes, bundle: dict, files: dict[str, bytes], *, now: datetime | None = None) -> tuple[str, dict[str, bytes]]:
    prefix, track, timestamp = _autosave_prefix(bundle, files, now)
    artifacts = bundle["artifacts"]
    receipt = artifacts.get("run_receipt")
    if receipt is not None:
        report = receipt["report"]
        vehicle = report["vehicle_name"].lower()
    else:
        vehicle = VEHICLE_NAMES[network_input(files["selected_network.evolution"])["Type"]].lower()
    uploads = {"bundle.json": bundle_bytes}
    network_suffix = prefix.rsplit("-", 1)[-1][:8]
    readable_track = _readable_track(track, artifacts.get('selected_track'))
    uploads[f"{readable_track}-{vehicle}-{timestamp}-{network_suffix}.evolution"] = files["selected_network.evolution"]
    if receipt is not None:
        uploads["report.md"] = _render_report(bundle)
        uploads["generation-history.csv"] = _render_history_csv(receipt["report"])
    if bundle.get("version") == 2:
        if "analysis_archive.gz" not in files:
            raise BucketStorageError("invalid_bundle")
        uploads["analysis-archive.gz"] = files["analysis_archive.gz"]
        for name, content in files.items():
            if name.startswith("analysis/"):
                uploads[name] = content
        if "analysis/stars.json" in files:
            stars=json.loads(files["analysis/stars.json"])
            # Plain text avoids interpreting user-provided track labels as markup.
            lines=["Star challenge check for the run's primary network", stars['basis'],
                   "This check grants no game stars and keeps no campaign progression.",
                   "Policy: "+stars['network_sha256'],
                   "Check duration: "+str(stars['horizon_seconds'])+" seconds", ""]
            for challenge in stars['challenges']:
                lines.extend([challenge['text'], "Result: "+challenge['status'].replace('_',' '),
                              "Reason: "+(challenge['reason'] or 'Condition observed.'), ""])
            uploads['star-check.txt']=("\n".join(lines)+"\n").encode('utf-8')
        for role in ("fitness", "fastest_lap", "clean_laps"):
            name = f"analysis/winners/{role}.evolution"
            if name in files:
                uploads[winner_sidecar_filename(readable_track, vehicle, timestamp, network_suffix, role)] = files[name]
    if sum(map(len, uploads.values())) > MAX_BUNDLE + MAX_NETWORK + MAX_SIDECAR_TOTAL:
        raise BucketStorageError("invalid_bundle")
    return prefix, uploads


def _list_metadata(key: str, uploaded: datetime | None) -> tuple[str, str | None]:
    match = AUTOSAVE_APP_KEY.fullmatch(key)
    if match:
        try:
            path_when = datetime.strptime(match.group("timestamp"), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        except ValueError:
            path_when = None
        when = _valid_utc_datetime(uploaded) or path_when
        if when is None:
            created_at = None
            date_label = "Saved bundle"
        else:
            # Fixed fractional precision keeps lexicographic ordering chronological
            # when multiple uploads occur within the same generated-key second.
            created_at = when.isoformat(timespec="microseconds").replace("+00:00", "Z")
            date_label = when.strftime("%Y-%m-%d %H:%M UTC")
        lap = match.group("lap")
        lap_label = "no completed lap" if lap == "none" else f"best run lap {int(lap[:-2])} ms"
        track = "Custom track" if match.group("track") == "custom" else match.group("track").replace("-", " ").title()
        label = f"{date_label} · {track} · {match.group('vehicle').title()} · {match.group('generations')} generations · {lap_label}"
        return label[:192], created_at
    date_label = "Saved bundle"
    created_at = None
    uploaded = _valid_utc_datetime(uploaded)
    if uploaded is not None:
        date_label = uploaded.strftime("%Y-%m-%d %H:%M UTC")
        created_at = uploaded.isoformat(timespec="microseconds").replace("+00:00", "Z")
    legacy = LEGACY_APP_KEY.fullmatch(key)
    label = f"{date_label} · imported portable network {legacy.group(1)[:8] if legacy else ''}".strip()
    return label[:192], created_at


def _valid_utc_datetime(value: object) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    try:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    except (OverflowError, ValueError):
        return None


def _child_environment(cache_root: Path) -> dict[str, str]:
    # Do not inherit host HF tokens, endpoints, cache locations, or login state.
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TMPDIR": str(cache_root),
        "HF_HOME": str(cache_root / "hf"),
        "HF_HUB_CACHE": str(cache_root / "hub-cache"),
        "HF_XET_CACHE": str(cache_root / "xet-cache"),
        "HF_XET_LOG_DEST": str(cache_root / "xet.log"),
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "HF_HUB_DISABLE_IMPLICIT_TOKEN": "1",
        "HF_HUB_DISABLE_PROGRESS_BARS": "1",
        "PYTHONNOUSERSITE": "1",
        "ALD_BUCKET_CHILD": "1",
        "ALD_BUCKET_TEMP": str(cache_root),
    }
    return env


def run_bucket_operation(operation: str, token: str, bucket_id: str, **args):
    """Run one HF operation in an isolated process with a temporary Xet cache."""
    if operation not in {"connect", "list", "save", "restore", "recipes_list", "recipes_save", "recipes_restore"}:
        raise BucketStorageError("invalid_request")
    if not isinstance(token, str) or not token or len(token) > 4096 or any(ch.isspace() or ord(ch) < 33 for ch in token):
        raise BucketStorageError("unauthorized")
    if not valid_bucket_id(bucket_id):
        raise BucketStorageError("invalid_request")

    try:
        with tempfile.TemporaryDirectory(prefix="ald-bucket-") as temp_name:
            temp = Path(temp_name)
            payload = {"operation": operation, "token": token, "bucket_id": bucket_id, **args}
            raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            if len(raw) > MAX_CHILD_INPUT:
                raise BucketStorageError("invalid_request")
            proc = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), "--child"],
                input=raw,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=CHILD_TIMEOUT_SECONDS,
                check=False,
                shell=False,
                env=_child_environment(temp),
            )
            if len(proc.stdout) > MAX_CHILD_OUTPUT:
                raise BucketStorageError("storage_unavailable")
            try:
                result = json.loads(proc.stdout.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise BucketStorageError("storage_unavailable") from None
            if proc.returncode != 0 or not isinstance(result, dict):
                category = result.get("error") if isinstance(result, dict) else None
                if category in {"unauthorized", "forbidden", "not_found", "invalid_request", "storage_unavailable"}:
                    raise BucketStorageError(category)
                raise BucketStorageError("storage_unavailable")
            if operation in {"save", "restore", "recipes_save", "recipes_restore"}:
                is_recipe = operation.startswith("recipes_")
                is_save = operation in {"save", "recipes_save"}
                expected_name = "recipe-readback.json" if operation == "recipes_save" else (
                    "recipe-restore.json" if operation == "recipes_restore" else (
                        "readback.json" if is_save else "restore.json"))
                file_path = temp / expected_name
                if not file_path.is_file() or file_path.is_symlink():
                    raise BucketStorageError("storage_unavailable")
                max_bytes = MAX_RECIPE_LIBRARY if is_recipe else MAX_BUNDLE
                if file_path.stat().st_size > max_bytes:
                    raise BucketStorageError("invalid_request")
                content = file_path.read_bytes()
                if is_save:
                    if (hashlib.sha256(content).hexdigest() != result.get("sha256")
                            or len(content) != result.get("bytes")):
                        raise BucketStorageError("storage_unavailable")
                    result["verified_bytes"] = content
                else:
                    if is_recipe:
                        try:
                            validate_recipe_library(content)
                        except Exception:
                            raise BucketStorageError("invalid_request") from None
                        result["recipe_bytes"] = content
                    else:
                        try:
                            load_bundle(content)
                        except BundleError:
                            raise BucketStorageError("invalid_bundle") from None
                        result["bundle_bytes"] = content
            return result
    except subprocess.TimeoutExpired:
        raise BucketStorageError("timeout") from None
    except BucketStorageError:
        raise
    except Exception:
        raise BucketStorageError("storage_unavailable") from None


def _verify_bucket(api, token: str, bucket_id: str):
    try:
        user = api.whoami(token=token, cache=False)
    except Exception:
        raise BucketStorageError("unauthorized") from None
    username = user.get("name") if isinstance(user, dict) else None
    if not isinstance(username, str) or not username or bucket_id.split("/", 1)[0] != username:
        raise BucketStorageError("forbidden")
    try:
        info = api.bucket_info(bucket_id, token=token)
    except Exception:
        # Inaccessible and nonexistent buckets deliberately share one response.
        raise BucketStorageError("forbidden") from None
    if getattr(info, "id", None) != bucket_id or getattr(info, "private", None) is not True:
        raise BucketStorageError("forbidden")
    return username


def _download_descriptor(api, token: str, bucket_id: str, key: str, destination: Path, *, max_bytes: int = MAX_BUNDLE):
    from huggingface_hub._buckets import BucketFile

    metadata = api.get_bucket_file_metadata(bucket_id, key, token=token)
    size = getattr(metadata, "size", None)
    xet_data = getattr(metadata, "xet_file_data", None)
    xet_hash = getattr(xet_data, "file_hash", None)
    if type(size) is not int or size < 0 or size > max_bytes or not isinstance(xet_hash, str) or not xet_hash:
        raise BucketStorageError("invalid_request")
    descriptor = BucketFile(
        type="file",
        path=key,
        size=size,
        xetHash=xet_hash,
        mtime=None,
        uploadedAt=None,
    )
    try:
        api.download_bucket_files(
            bucket_id,
            [(descriptor, destination)],
            raise_on_missing_files=True,
            token=token,
        )
    except Exception:
        raise BucketStorageError("storage_unavailable") from None
    if not destination.is_file() or destination.is_symlink() or destination.stat().st_size != size:
        raise BucketStorageError("storage_unavailable")
    return size, xet_hash


def _perform_operation(request: dict, api, temp: Path) -> dict:
    operation = request["operation"]
    token = request["token"]
    bucket_id = request["bucket_id"]
    username = _verify_bucket(api, token, bucket_id)
    if operation == "connect":
        return {"status": "connected", "bucket_id": bucket_id, "username": username, "private": True}
    if operation == "recipes_list":
        items = []
        scan_incomplete = False
        for index, item in enumerate(api.list_bucket_tree(bucket_id, prefix="ald-recipes", recursive=True, token=token)):
            if index >= MAX_LIST_SCAN:
                scan_incomplete = True
                break
            key = getattr(item, "path", None)
            size = getattr(item, "size", None)
            if valid_recipe_key(key) and type(size) is int and 0 <= size <= MAX_RECIPE_LIBRARY:
                uploaded = getattr(item, "uploaded_at", None) or getattr(item, "mtime", None)
                label, created_at = _recipe_list_metadata(key, uploaded)
                items.append({"key": key, "bytes": size, "label": label, "created_at": created_at})
        items.sort(key=lambda item: item["created_at"] or "", reverse=True)
        truncated = len(items) > MAX_LIST_RESULTS
        return {"items": items[:MAX_LIST_RESULTS], "truncated": truncated,
                "scan_incomplete": scan_incomplete}
    if operation == "recipes_save":
        encoded = request.get("library_base64")
        if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_RECIPE_LIBRARY + 2) // 3):
            raise BucketStorageError("invalid_request")
        try:
            library = base64.b64decode(encoded, validate=True)
            validate_recipe_library(library)
        except Exception:
            raise BucketStorageError("invalid_request") from None
        digest = hashlib.sha256(library).hexdigest()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        prefix = f"ald-recipes/{timestamp}-{uuid.uuid4().hex}"
        source = temp / "recipe-upload"
        source.mkdir(mode=0o700)
        (source / "library.json").write_bytes(library)
        try:
            api.sync_bucket(str(source), f"hf://buckets/{bucket_id}/{prefix}",
                            delete=False, ignore_existing=True, quiet=True, token=token)
        except Exception:
            raise BucketStorageError("storage_unavailable") from None
        key = f"{prefix}/library.json"
        readback = temp / "recipe-readback.json"
        size, _ = _download_descriptor(api, token, bucket_id, key, readback,
                                       max_bytes=MAX_RECIPE_LIBRARY)
        content = readback.read_bytes()
        if size != len(library) or content != library or hashlib.sha256(content).hexdigest() != digest:
            raise BucketStorageError("storage_unavailable")
        return {"status": "saved_verified", "bucket_id": bucket_id, "key": key,
                "bytes": len(library), "sha256": digest}
    if operation == "recipes_restore":
        key = request.get("key")
        if not valid_recipe_key(key):
            raise BucketStorageError("invalid_request")
        restore = temp / "recipe-restore.json"
        size, _ = _download_descriptor(api, token, bucket_id, key, restore,
                                       max_bytes=MAX_RECIPE_LIBRARY)
        content = restore.read_bytes()
        try:
            validate_recipe_library(content)
        except Exception:
            raise BucketStorageError("invalid_request") from None
        return {"status": "restored", "key": key, "bytes": size,
                "sha256": hashlib.sha256(content).hexdigest()}
    if operation == "list":
        items = []
        scan_incomplete = False
        for index, item in enumerate(api.list_bucket_tree(bucket_id, prefix="ald-exports", recursive=True, token=token)):
            if index >= MAX_LIST_SCAN:
                scan_incomplete = True
                break
            key = getattr(item, "path", None)
            size = getattr(item, "size", None)
            match = (LEGACY_APP_KEY.fullmatch(key) or AUTOSAVE_APP_KEY.fullmatch(key)) if isinstance(key, str) else None
            if match and type(size) is int and 0 <= size <= MAX_BUNDLE:
                uploaded = getattr(item, "uploaded_at", None) or getattr(item, "mtime", None)
                label, created_at = _list_metadata(key, uploaded)
                items.append({"key": key, "bytes": size, "label": label, "created_at": created_at})
        # The primary ordering is newest first; unknown legacy timestamps remain at the end.
        items.sort(key=lambda item: item["created_at"] or "", reverse=True)
        truncated = len(items) > MAX_LIST_RESULTS
        if len(items) > MAX_LIST_RESULTS:
            items = items[:MAX_LIST_RESULTS]
        return {"items": items, "truncated": truncated, "scan_incomplete": scan_incomplete}
    if operation == "save":
        encoded = request.get("bundle_base64")
        if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_BUNDLE + 2) // 3):
            raise BucketStorageError("invalid_request")
        try:
            bundle = base64.b64decode(encoded, validate=True)
            bundle_obj, bundle_files = load_bundle(bundle)
        except Exception:
            raise BucketStorageError("invalid_bundle") from None
        digest = hashlib.sha256(bundle).hexdigest()
        prefix, uploads = _save_files(bundle, bundle_obj, bundle_files)
        key = f"{prefix}/bundle.json"
        source = temp / "upload"
        source.mkdir(mode=0o700)
        for filename, content in uploads.items():
            if (not isinstance(filename, str) or filename.startswith("/")
                    or any(part in {"", ".", ".."} for part in filename.split("/"))):
                raise BucketStorageError("invalid_bundle")
            path = source.joinpath(*filename.split("/"))
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            path.write_bytes(content)
        try:
            api.sync_bucket(
                str(source), f"hf://buckets/{bucket_id}/{prefix}",
                delete=False, ignore_existing=True, quiet=True, token=token,
            )
        except Exception:
            raise BucketStorageError("storage_unavailable") from None
        verified_files = {}
        for index, (filename, expected) in enumerate(uploads.items()):
            remote_path = f"{prefix}/{filename}"
            readback = temp / f"readback-{index}.bin"
            size, _ = _download_descriptor(api, token, bucket_id, remote_path, readback, max_bytes=len(expected))
            content = readback.read_bytes()
            expected_sha = hashlib.sha256(expected).hexdigest()
            if size != len(expected) or hashlib.sha256(content).hexdigest() != expected_sha:
                raise BucketStorageError("storage_unavailable")
            verified_files[filename] = {"bytes": size, "sha256": expected_sha}
        if verified_files.get("bundle.json", {}).get("sha256") != digest:
            raise BucketStorageError("storage_unavailable")
        (temp / "readback.json").write_bytes(bundle)
        return {"status": "saved_verified", "bucket_id": bucket_id, "key": key, "bytes": len(bundle), "sha256": digest,
                "verified_files": verified_files}
    key = request.get("key")
    if not valid_bundle_key(key):
        raise BucketStorageError("invalid_request")
    restore = temp / "restore.json"
    size, _ = _download_descriptor(api, token, bucket_id, key, restore)
    try:
        bundle = restore.read_bytes()
        load_bundle(bundle)
    except Exception:
        raise BucketStorageError("invalid_bundle") from None
    return {"status": "restored", "key": key, "bytes": size}


def _child_main() -> int:
    if os.environ.get("ALD_BUCKET_CHILD") != "1":
        return 2
    raw = sys.stdin.buffer.read(MAX_CHILD_INPUT + 1)
    if len(raw) > MAX_CHILD_INPUT:
        print(json.dumps({"error": "invalid_request"}))
        return 2
    try:
        request = json.loads(raw.decode("utf-8"))
        if not isinstance(request, dict) or request.get("operation") not in {
                "connect", "list", "save", "restore", "recipes_list", "recipes_save", "recipes_restore"}:
            raise BucketStorageError("invalid_request")
        operation = request["operation"]
        token = request.get("token")
        bucket_id = request.get("bucket_id")
        if not isinstance(token, str) or not token or len(token) > 4096 or any(c.isspace() or ord(c) < 33 for c in token):
            raise BucketStorageError("unauthorized")
        if not valid_bucket_id(bucket_id):
            raise BucketStorageError("invalid_request")
        from huggingface_hub import HfApi

        api = HfApi(endpoint=HF_ENDPOINT, token=False)
        temp = Path(os.environ["ALD_BUCKET_TEMP"])
        result = _perform_operation(request, api, temp)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except BucketStorageError as exc:
        print(json.dumps({"error": exc.category}, separators=(",", ":")))
        return 1
    except Exception:
        print(json.dumps({"error": "storage_unavailable"}, separators=(",", ":")))
        return 1


if __name__ == "__main__" and len(sys.argv) == 2 and sys.argv[1] == "--child":
    raise SystemExit(_child_main())
