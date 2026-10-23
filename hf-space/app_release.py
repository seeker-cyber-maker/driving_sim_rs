"""HF CPU release entrypoint. One process owns all ephemeral results."""
import hashlib
import json
from pathlib import Path
from server import create_app
from worker import run_native

ROOT=Path(__file__).resolve().parent

def verify_package(root=ROOT):
    manifest=json.loads((root/'RELEASE_MANIFEST.json').read_text())
    for name,expected in manifest['files'].items():
        path=(root/name).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            raise RuntimeError('Invalid release member')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
            raise RuntimeError('Release integrity check failed: '+name)
    return manifest

def cpu_worker(track,network,config=None):
    return run_native(track,network,binary=ROOT/'bin/altd-sim',
        importer=ROOT/'bin/extract_saved_track',
        scene_template=ROOT/'assets/formula_template.json',with_report=True,config=config)

def main():
    verify_package()
    for name in ('altd-sim','extract_saved_track'):
        (ROOT/'bin'/name).chmod(0o755)
    import uvicorn
    uvicorn.run(create_app(worker=cpu_worker),host='0.0.0.0',port=7860,
        workers=1,access_log=False)

if __name__=='__main__': main()
