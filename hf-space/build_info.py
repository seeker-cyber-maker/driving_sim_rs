"""Content-addressed package identity with explicit native patch provenance."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def build_identity():
    manifest = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text())
    upstream = json.loads((ROOT / "UPSTREAM.json").read_text())
    members = json.dumps(manifest["files"], sort_keys=True, separators=(",", ":")).encode()
    native = upstream["native_build"]
    return {
        "schema_version": 1,
        "physics_revision": upstream.get("physics_revision"),
        "applied_upstream_delta": upstream.get("applied_upstream_delta"),
        "build_id": "ald-winners-" + hashlib.sha256(members).hexdigest(),
        "source_repository": upstream["repository"],
        "simulator_source_revision": upstream["commit"],
        "math_profile": upstream["math_profile"],
        "package_role": 'gpu',
        "binary_sha256": {name: digest for name, digest in manifest["files"].items() if name.startswith("bin/")},
        "native_source_revision": native["source_revision"],
        "native_source_snapshot_sha256": native["source_snapshot_sha256"],
        "native_build_receipt_sha256": native["build_receipt_sha256"],
    }
