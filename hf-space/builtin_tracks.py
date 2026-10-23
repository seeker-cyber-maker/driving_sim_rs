"""Read-only, hash-checked reference tracks; separate from ephemeral job data."""
import hashlib
import json
from pathlib import Path
import re


class TrackLibrary:
    def __init__(self, root):
        self.root=Path(root).resolve()
        self._entries={}
        catalog=self.root/'catalog.json'
        if not catalog.exists():return  # Older/local upload-only installations.
        if catalog.stat().st_size>256*1024:raise ValueError('Track catalog too large')
        data=json.loads(catalog.read_text())
        if data.get('schema')!='ald-editor-format-replicas-v1':raise ValueError('Unknown track catalog')
        tracks=data['tracks']
        if not isinstance(tracks,list) or not 1<=len(tracks)<=128:raise ValueError('Track count')
        for entry in tracks:
            identifier=entry['id'];relative=Path(entry['file'])
            if not isinstance(identifier,str) or not re.fullmatch(r'[a-z0-9-]{1,80}',identifier):
                raise ValueError('Track ID')
            if identifier in self._entries:raise ValueError('Duplicate track ID')
            if len(relative.parts)!=2 or relative.parts[0]!='tracks' or relative.suffix!='.track':
                raise ValueError('Track path')
            path=self.root/relative
            if path.is_symlink() or path.resolve()!=path or not path.is_file():raise ValueError('Track path')
            size=entry['bytes'];digest=entry['sha256']
            if type(size)!=int or not 1<=size<=1024*1024 or not re.fullmatch(r'[a-f0-9]{64}',digest):
                raise ValueError('Track size/hash')
            for label in ('display_name','reference_label'):
                if not isinstance(entry[label],str) or not 1<=len(entry[label])<=100:raise ValueError('Track label')
            public={key:entry[key] for key in ('id','display_name','reference_label','bytes','sha256')}
            self._entries[identifier]=(path,public)
            self.read(identifier)

    def catalog(self):
        # Never expose private provenance source paths or arbitrary input fields.
        return {'schema':'ald-builtin-track-library-v1',
                'method':'programmatically reconstructed editor-format replicas',
                'editor_authored':False,'clean_room':False,
                'challenge_runtime_status':'per-run fixed-policy prediction; original opponent races not evaluated',
                'tracks':[dict(entry) for _,entry in self._entries.values()]}

    def read(self, identifier):
        if identifier not in self._entries:raise KeyError(identifier)
        path,entry=self._entries[identifier]
        if path.is_symlink() or path.resolve()!=path or path.stat().st_size!=entry['bytes']:
            raise ValueError('Track validation failed')
        payload=path.read_bytes()
        if hashlib.sha256(payload).hexdigest()!=entry['sha256']:raise ValueError('Track validation failed')
        return payload

    def members(self):
        return [(path.relative_to(self.root).as_posix(),path) for path,_ in self._entries.values()]
