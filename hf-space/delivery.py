"""Process-local result delivery. No disk cache, public URLs, or background service.

Run one ASGI worker. Restarts discard results. This does not promise physical
memory erasure or control provider logs, swap, snapshots, or response buffers.
"""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import hmac
import secrets
import threading
import time
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

class Unavailable(Exception): pass
class CapacityExceeded(Exception): pass
class InvalidAnalysisOutput(Exception): pass

MAX_PRIMARY_BYTES = 4 * 1024 * 1024
MAX_ANALYSIS_BYTES = 32 * 1024 * 1024


def publish_worker_result(store, data, report, automatic=True, *, require_analysis=False):
    """Remove private worker artifacts before returning the public run report."""
    if not isinstance(report, dict):
        if require_analysis:
            raise InvalidAnalysisOutput()
        return store.publish(data, automatic), report
    missing = object()
    private_files = report.pop('_analysis_files', missing)
    archive = None
    if private_files is missing:
        if require_analysis:
            raise InvalidAnalysisOutput()
    else:
        try:
            from portable_bundle import BundleError, make_analysis_archive
            archive = make_analysis_archive(
                private_files, primary=data, analysis_summary=report.get('analysis_summary'))
        except BundleError:
            raise InvalidAnalysisOutput() from None
    return store.publish(data, automatic, analysis=archive), report

class ResultStore:
    def __init__(self, clock=time.monotonic, wall_clock=time.time, max_bytes=64*1024*1024):
        self.clock, self.wall_clock = clock, wall_clock
        self.max_bytes = max_bytes
        self.lock = threading.RLock()
        self.jobs = {}

    @property
    def retained_bytes(self):
        with self.lock:
            return sum(len(j['data']) + (len(j['analysis']) if j['analysis'] is not None else 0)
                       for j in self.jobs.values())

    def _delete(self, ident):
        record = self.jobs.pop(ident)
        for name in ('data', 'analysis'):
            payload = record[name]
            if payload is not None:
                payload[:] = b'\0' * len(payload)
                payload.clear()

    def expire(self):
        with self.lock:
            for ident in list(self.jobs):
                if self.clock() >= self.jobs[ident]['deadline']: self._delete(ident)

    def clear(self):
        with self.lock:
            for ident in list(self.jobs): self._delete(ident)

    def publish(self, data, automatic=True, analysis=None):
        if (not isinstance(data, bytes) or not data or len(data) > MAX_PRIMARY_BYTES
                or (analysis is not None and (not isinstance(analysis, bytes) or not analysis
                    or len(analysis) > MAX_ANALYSIS_BYTES))):
            raise CapacityExceeded()
        retained = len(data) + (len(analysis) if analysis is not None else 0)
        with self.lock:
            self.expire()
            if len(self.jobs) >= 16 or self.retained_bytes + retained > self.max_bytes:
                raise CapacityExceeded()
            ident, key = secrets.token_urlsafe(24), secrets.token_urlsafe(32)
            expires = self.wall_clock()+300
            self.jobs[ident] = dict(key=key, data=bytearray(data),
                analysis=bytearray(analysis) if analysis is not None else None,
                automatic=automatic, deadline=self.clock()+300, expires_at=expires,
                delivered=False, receipt=None, analysis_delivered=False,
                analysis_receipt=None)
            published = dict(id=ident,key=key,expires_at=expires,automatic=automatic,
                sha256=hashlib.sha256(data).hexdigest(),size=len(data))
            if analysis is not None:
                published['analysis'] = {'size': len(analysis), 'sha256': hashlib.sha256(analysis).hexdigest()}
            return published

    def _get(self, ident, key):
        self.expire()
        record = self.jobs.get(ident)
        if not record or not hmac.compare_digest(record['key'],key): raise Unavailable()
        return record

    def status(self, ident, key):
        with self.lock:
            r = self._get(ident,key)
            return dict(expires_at=r['expires_at'],automatic=r['automatic'],delivered=r['delivered'])

    def download(self, ident, key):
        with self.lock:
            r = self._get(ident,key)
            # Paired results are retryable as a pair until ACK or expiry. Legacy
            # primary-only automatic deliveries retain their one-attempt behavior.
            if r['automatic'] and r['delivered'] and r['analysis'] is None: raise Unavailable()
            r['delivered'] = True
            if r['receipt'] is None:
                r['receipt'] = secrets.token_urlsafe(32)
            return bytes(r['data']), r['receipt']

    def download_analysis(self, ident, key):
        with self.lock:
            r = self._get(ident,key)
            if r['analysis'] is None or not r['delivered'] or r['receipt'] is None:
                raise Unavailable()
            r['analysis_delivered'] = True
            if r['analysis_receipt'] is None:
                r['analysis_receipt'] = secrets.token_urlsafe(32)
            return bytes(r['analysis']), r['analysis_receipt']

    def acknowledge(self, ident, key, receipt, analysis_receipt=None):
        with self.lock:
            r = self._get(ident,key)
            if not r['receipt'] or not hmac.compare_digest(r['receipt'],receipt): raise Unavailable()
            if r['analysis'] is not None:
                if (not r['analysis_delivered'] or not r['analysis_receipt']
                        or not isinstance(analysis_receipt, str)
                        or not hmac.compare_digest(r['analysis_receipt'],analysis_receipt)):
                    raise Unavailable()
            elif analysis_receipt is not None:
                raise Unavailable()
            if r['automatic']:
                self._delete(ident)
                return dict(deleted=True)
            return dict(deleted=False,expires_at=r['expires_at'])

    def delete(self, ident, key):
        with self.lock:
            self._get(ident,key)
            self._delete(ident)
            return dict(deleted=True)

class Acknowledgment(BaseModel):
    receipt: str = Field(min_length=1,max_length=128)
    analysis_receipt: str | None = Field(default=None,min_length=1,max_length=128)

def create_api(store=None):
    store = store if store is not None else ResultStore()
    @asynccontextmanager
    async def lifespan(app):
        async def expiry():
            while True:
                await asyncio.sleep(1)
                store.expire()
        task = asyncio.create_task(expiry())
        try: yield
        finally:
            task.cancel()
            try: await task
            except asyncio.CancelledError: pass
            store.clear()

    app = FastAPI(lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
    app.state.results = store
    @app.middleware('http')
    async def headers(request,call_next):
        response = await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['Referrer-Policy']='no-referrer'
        response.headers['X-Content-Type-Options']='nosniff'
        return response

    def key(value):
        if not value:
            raise HTTPException(404,'Job unavailable')
        if not value.isascii() or len(value)>128: raise HTTPException(404,'Job unavailable')
        return value

    def call(fn,*args):
        try: return fn(*args)
        except Unavailable: raise HTTPException(404,'Job unavailable') from None

    @app.get('/api/jobs/{ident}')
    def status(ident:str,x_job_key:str|None=Header(default=None)):
        return call(store.status,ident,key(x_job_key))

    @app.post('/api/jobs/{ident}/download')
    def download(ident:str,x_job_key:str|None=Header(default=None)):
        data,receipt = call(store.download,ident,key(x_job_key))
        return Response(data,media_type='application/octet-stream',headers={
            'Content-Disposition':'attachment; filename="candidate.evolution"',
            'X-Delivery-Receipt':receipt})

    @app.post('/api/jobs/{ident}/analysis/download')
    def download_analysis(ident:str,x_job_key:str|None=Header(default=None)):
        data,receipt = call(store.download_analysis,ident,key(x_job_key))
        return Response(data,media_type='application/gzip',headers={
            'Content-Disposition':'attachment; filename="analysis.json.gz"',
            'X-Analysis-Delivery-Receipt':receipt})

    @app.post('/api/jobs/{ident}/ack')
    def ack(ident:str,body:Acknowledgment,x_job_key:str|None=Header(default=None)):
        return call(store.acknowledge,ident,key(x_job_key),body.receipt,body.analysis_receipt)

    @app.delete('/api/jobs/{ident}')
    def delete(ident:str,x_job_key:str|None=Header(default=None)):
        return call(store.delete,ident,key(x_job_key))
    return app
