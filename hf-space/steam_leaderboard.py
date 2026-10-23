"""Anonymous read-only Steam Community leaderboard comparison; never uploads scores."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html.parser import HTMLParser
import hashlib
import re
import socket
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

APP_ID = 3312030
INDEX_URL = f'https://steamcommunity.com/stats/{APP_ID}/leaderboards/'
MAX_BYTES = 8_000_000
TIMEOUT_SECONDS = 4
TOTAL_TIMEOUT_SECONDS = 10
INDEX_TTL_SECONDS = 300
BOARD_TTL_SECONDS = 60
RATE_LIMIT_COOLDOWN_SECONDS = 60
FAILURE_CATEGORIES = frozenset({
    'rate_limited', 'upstream_http_error', 'timeout', 'network_error', 'invalid_response',
})

_cache_lock = threading.Lock()
_rate_limit_lock = threading.Lock()
_index_cache = None
_board_cache = {}
_rate_limited_until = 0.0


class SteamUnavailable(Exception):
    """The public Community endpoint could not provide a validated board."""

    def __init__(self, message, *, failure_category='invalid_response', upstream_http_status=None):
        if failure_category not in FAILURE_CATEGORIES:
            raise ValueError('Unknown Steam failure category')
        self.failure_category = failure_category
        self.upstream_http_status = upstream_http_status
        super().__init__(message)


class BoardOptions(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.options = {}
        self.value = None
        self.parts = []
        self.duplicate = False

    def handle_starttag(self, tag, attrs):
        if tag == 'option':
            self.value = dict(attrs).get('value')
            self.parts = []

    def handle_data(self, data):
        if self.value is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'option' and self.value is not None:
            if self.value in self.options:
                self.duplicate = True
            self.options[self.value] = ''.join(self.parts).strip()
            self.value = None


def _read(url):
    # Callers pass only INDEX_URL or a URL assembled from a numeric ID in that
    # verified public index. No request data is placed in a Steam URL.
    global _rate_limited_until
    now = time.monotonic()
    with _rate_limit_lock:
        if now < _rate_limited_until:
            raise SteamUnavailable(
                'Steam public leaderboard is cooling down after rate limiting',
                failure_category='rate_limited', upstream_http_status=429,
            )
        if _rate_limited_until:
            _rate_limited_until = 0.0
    request = Request(url, headers={'User-Agent': 'ALD-hosted-public-board-check/1.0'})
    started = time.monotonic()
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            final = urlparse(response.geturl())
            if final.scheme != 'https' or final.hostname != 'steamcommunity.com':
                raise SteamUnavailable('Steam public leaderboard redirected outside its fixed host', failure_category='invalid_response')
            chunks, size = [], 0
            while True:
                if time.monotonic() - started >= TOTAL_TIMEOUT_SECONDS:
                    raise SteamUnavailable('Steam public leaderboard request exceeded its time limit', failure_category='timeout')
                chunk = response.read(min(65536, MAX_BYTES + 1 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                if size > MAX_BYTES:
                    raise SteamUnavailable('Steam public leaderboard response exceeded the size limit', failure_category='invalid_response')
            return b''.join(chunks)
    except SteamUnavailable:
        raise
    except HTTPError as error:
        if error.code == 429:
            with _rate_limit_lock:
                _rate_limited_until = max(_rate_limited_until, time.monotonic() + RATE_LIMIT_COOLDOWN_SECONDS)
            raise SteamUnavailable(
                'Steam public leaderboard is rate limited',
                failure_category='rate_limited', upstream_http_status=429,
            ) from error
        raise SteamUnavailable(
            'Steam public leaderboard returned an HTTP error',
            failure_category='upstream_http_error', upstream_http_status=error.code,
        ) from error
    except (socket.timeout, TimeoutError) as error:
        raise SteamUnavailable('Steam public leaderboard request timed out', failure_category='timeout') from error
    except URLError as error:
        if isinstance(error.reason, (socket.timeout, TimeoutError)):
            raise SteamUnavailable('Steam public leaderboard request timed out', failure_category='timeout') from error
        raise SteamUnavailable('Steam public leaderboard network request failed', failure_category='network_error') from error
    except Exception as error:
        raise SteamUnavailable('Steam public leaderboard network request failed', failure_category='network_error') from error


def _index():
    global _index_cache
    now = time.monotonic()
    with _cache_lock:
        if _index_cache and now - _index_cache[0] < INDEX_TTL_SECONDS:
            return _index_cache[1]
        raw = _read(INDEX_URL)
        parser = BoardOptions()
        try:
            parser.feed(raw.decode('utf-8'))
        except (UnicodeDecodeError, ValueError) as error:
            raise SteamUnavailable('Steam public leaderboard index was invalid', failure_category='invalid_response') from error
        if parser.duplicate:
            raise SteamUnavailable('Steam public leaderboard index had duplicate IDs', failure_category='invalid_response')
        boards = {}
        for identifier, label in parser.options.items():
            if identifier.isdecimal() and label:
                if label in boards:
                    raise SteamUnavailable('Steam public leaderboard index had ambiguous track labels', failure_category='invalid_response')
                boards[label] = (int(identifier), label)
        fetched = datetime.now(timezone.utc).isoformat()
        _index_cache = (now, {'boards': boards, 'sha256': hashlib.sha256(raw).hexdigest(), 'fetched_at_utc': fetched})
        return _index_cache[1]


def _parse_board(raw, board_id):
    try:
        root = ET.fromstring(raw)
        if root.tag != 'response' or root.findtext('appID') != str(APP_ID):
            raise ValueError()
        if root.findtext('leaderboardID') != str(board_id):
            raise ValueError()
        count = int(root.findtext('totalLeaderboardEntries'))
        received = int(root.findtext('resultCount'))
        entries = []
        prior_score = 0
        for row in root.findall('./entries/entry'):
            rank = int(row.findtext('rank'))
            score = int(row.findtext('score'))
            if rank != len(entries) + 1 or score <= 0 or score < prior_score:
                raise ValueError()
            entries.append({'rank': rank, 'score_ms': score})
            prior_score = score
        if count < 1 or received != count or len(entries) != count:
            raise ValueError()
    except (ET.ParseError, TypeError, ValueError, OverflowError) as error:
        raise SteamUnavailable('Steam returned an incomplete or mismatched leaderboard', failure_category='invalid_response') from error
    return entries


def _board(label, board_id):
    key = (label, board_id)
    now = time.monotonic()
    with _cache_lock:
        cached = _board_cache.get(key)
        if cached and now - cached[0] < BOARD_TTL_SECONDS:
            return cached[1]
        url = f'{INDEX_URL}{board_id}/?xml=1'
        raw = _read(url)
        entries = _parse_board(raw, board_id)
        value = {
            'entries': entries,
            'fetched_at_utc': datetime.now(timezone.utc).isoformat(),
            'source_sha256': hashlib.sha256(raw).hexdigest(),
        }
        _board_cache[key] = (now, value)
        return value


def milliseconds(seconds):
    if isinstance(seconds, bool):
        raise ValueError('Lap time must be a positive finite number')
    try:
        value = Decimal(str(seconds))
    except (InvalidOperation, ValueError) as error:
        raise ValueError('Lap time must be a positive finite number') from error
    if not value.is_finite() or value <= 0 or value > 3600:
        raise ValueError('Lap time must be positive and no more than one hour')
    score = int((value * 1000).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    if score < 1:
        raise ValueError('Lap time must be at least one millisecond')
    return score


def compare_public_best_lap(track, lap_seconds):
    """Compare to a public full board; caller has already verified car + track."""
    label = track['reference_label']
    # The original game only assigns campaign leaderboard IDs to A/B tracks.
    # Some R-series labels happen to appear in the public HTML index, but the
    # game source has no verified mapping from those tracks to Steam boards.
    if not isinstance(label, str) or not re.match(r'^[AB]\d{2} ', label):
        return {
            'status': 'unsupported_track',
            'track': {'reference_label': label if isinstance(label, str) else None},
            'source': 'Original game leaderboard mapping',
            'message': 'The original game has no verified Steam leaderboard mapping for this track.',
            'official_rank': False,
        }
    mapping = _index()
    item = mapping['boards'].get(label)
    if not item:
        return {
            'status': 'unsupported_track',
            'track': {'reference_label': label},
            'source': 'Steam Community public index',
            'fetched_at_utc': mapping['fetched_at_utc'],
            'message': 'Steam has no public leaderboard for this built-in track.',
            'official_rank': False,
        }
    board_id, label = item
    data = _board(label, board_id)
    score = milliseconds(lap_seconds)
    entries = data['entries']
    ties = [row['rank'] for row in entries if row['score_ms'] == score]
    if ties:
        lower, upper = min(ties), max(ties)
    else:
        lower = 1 + sum(row['score_ms'] < score for row in entries)
        upper = lower
    exact = lower == upper
    position = f'#{lower}' if exact else f'#{lower}–#{upper}'
    if ties:
        position += ' (displayed-time tie)'
    return {
        'status': 'ok',
        'board': {'app_id': APP_ID, 'leaderboard_id': board_id, 'track_label': label, 'scope': 'global'},
        'source': 'Steam Community public XML',
        'source_url': f'{INDEX_URL}{board_id}/?xml=1',
        'fetched_at_utc': data['fetched_at_utc'],
        'index_sha256': mapping['sha256'],
        'board_sha256': data['source_sha256'],
        'entries': len(entries),
        'lap_milliseconds': score,
        'estimated_position': {'lower': lower, 'upper': upper, 'exact_in_snapshot': exact, 'label': position},
        'ties': ties,
        'rank_basis': 'Insertion position in the complete raw global Steam board at fetch time; not filtered by vehicle metadata.',
        'official_rank': False,
        'message': 'Estimate only: the run was not submitted. This is a snapshot insertion position, not an official Steam rank or verification of game timing parity.',
    }


def _reset_cache_for_tests():
    global _index_cache, _rate_limited_until
    with _cache_lock:
        _index_cache = None
        _board_cache.clear()
    with _rate_limit_lock:
        _rate_limited_until = 0.0
