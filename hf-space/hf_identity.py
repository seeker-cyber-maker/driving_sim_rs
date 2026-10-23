"""Read-only visitor identity check; never retain or log bearer credentials."""
import json
import os
from urllib.request import Request, urlopen


def oauth_config():
    client_id = os.environ.get('OAUTH_CLIENT_ID', '')
    configured_scopes = set(os.environ.get('OAUTH_SCOPES', '').split())
    storage_enabled = bool(client_id and 'write-repos' in configured_scopes)
    config = {'enabled': bool(client_id), 'client_id': client_id,
              'scopes': 'openid profile', 'storage_enabled': storage_enabled}
    if storage_enabled:
        config['storage_scopes'] = 'openid profile write-repos'
    return config


def visitor_identity(headers):
    authorization = headers.get('authorization', '')
    if not authorization:
        return {'authenticated': False, 'auth_path': 'anonymous'}
    if not authorization.startswith('Bearer ') or len(authorization) > 8192:
        raise ValueError('Visitor authentication is invalid; sign in again')
    # Fixed HF endpoint only: no caller-controlled network destinations.
    try:
        request = Request('https://huggingface.co/oauth/userinfo',
                          headers={'Authorization': authorization})
        with urlopen(request, timeout=8) as response:
            profile = json.loads(response.read(65536))
        username = profile['preferred_username']
        if not isinstance(username, str) or not username or len(username) > 200:
            raise ValueError()
        return {'authenticated': True, 'username': username,
                'auth_path': 'queue-bearer', 'is_pro': profile.get('isPro') is True}
    except Exception:
        # Never echo provider bodies, headers, credentials, or callback URLs.
        raise ValueError('Visitor identity could not be verified; sign in again') from None
