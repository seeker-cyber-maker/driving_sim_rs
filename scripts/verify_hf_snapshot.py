#!/usr/bin/env python3
"""Verify the published ALD HF snapshot without third-party modules or network."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def member(root, name):
    path = root / name
    if Path(name).is_absolute() or '..' in Path(name).parts or path.is_symlink():
        raise ValueError('Unsafe source member: ' + name)
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Missing source member: ' + name)
    return path


def verify(snapshot, record):
    source = json.loads(record.read_text(encoding='utf-8'))
    if source['schema'] != 'ald-hf-source-snapshot/1':
        raise ValueError('Unsupported snapshot record')
    files = source['files']
    if len(files) != source['file_count']:
        raise ValueError('Source member count differs')
    for name, expected in files.items():
        if digest(member(snapshot, name)) != expected:
            raise ValueError('Source hash differs: ' + name)
    actual = {p.relative_to(snapshot).as_posix() for p in snapshot.rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and '.cache' not in p.parts}
    if actual != set(files):
        raise ValueError('Unexpected or missing product files')
    manifest = json.loads(member(snapshot, 'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
    for name, expected in manifest['files'].items():
        if files.get(name) != expected:
            raise ValueError('Release/source manifests differ: ' + name)
    canonical = json.dumps(manifest['files'], sort_keys=True, separators=(',', ':')).encode()
    build = 'ald-winners-' + hashlib.sha256(canonical).hexdigest()
    if source['build']['build_id'] != build:
        raise ValueError('Build identity differs')
    for name, expected in source['build']['binary_sha256'].items():
        if files.get(name) != expected:
            raise ValueError('Native artifact differs: ' + name)
    return {'status': 'pass', 'hf_revision': source['hf_revision'], 'files': len(files),
            'release_members': len(manifest['files']), 'build_id': build,
            'scope': 'Package byte identity only; no simulation or binary rebuild'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'hf-space')
    parser.add_argument('--record', type=Path,
                        default=ROOT / 'docs/releases/ald-lab-2026.10.23/SOURCE.json')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.snapshot, args.record), indent=2))
        return 0
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({'status': 'fail', 'error': str(error)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
