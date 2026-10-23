"""Hosted ZeroGPU entrypoint for bounded Formula training.

Browser must invoke /gpu_train with @gradio/client for caller quota propagation.
The queue carries only an opaque ticket; result bytes stay in the existing store.
"""
import asyncio
import base64
from contextlib import asynccontextmanager
import json
import threading
import os
os.environ['GRADIO_ANALYTICS_ENABLED']='False'
import gradio as gr
import spaces
from fastapi import HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from app_release import ROOT,cpu_worker,verify_package
from gpu_tickets import InputTickets
from server import create_app
from delivery import CapacityExceeded, publish_worker_result
from worker import run_native,track_input,network_input
from training_config import validate_config
from build_info import build_identity
from hf_identity import visitor_identity

def build_app(cuda_call,require_analysis=False):
    base=create_app(worker=cpu_worker,require_analysis=require_analysis)
    tickets=InputTickets()
    admission=threading.BoundedSemaphore(1)

    @asynccontextmanager
    async def lifespan(app):
        async def expire():
            while True:
                await asyncio.sleep(1)
                tickets.expire()
        async with base.router.lifespan_context(base):
            task=asyncio.create_task(expire())
            try:yield
            finally:
                task.cancel()
                try:await task
                except asyncio.CancelledError:pass
                tickets.clear()

    app=gr.Server(lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)

    @app.middleware('http')
    async def no_framework_file_storage(request,call_next):
        # This UI sends bounded bytes through prepare, never Gradio file uploads.
        path=request.url.path
        if path.startswith(('/gradio_api/upload','/gradio_api/file=',
                            '/gradio_api/stream/','/gradio_api/run/','/gradio_api/runs')):
            return JSONResponse({'detail':'File storage and run history are disabled'},status_code=404)
        return await call_next(request)

    @app.get('/api/capabilities')
    def capabilities():
        return {'cpu':True,'gpu':True,'default':'cpu','gpu_transport':'gradio-ticket','configurable_training':True,'build':build_identity()}

    @app.get('/gradio-client.js')
    def javascript_client():
        return FileResponse(ROOT/'vendor/gradio-client/dist/index.min.js',media_type='text/javascript')

    @app.post('/api/gpu/prepare')
    async def prepare(request:Request):
        data=bytearray()
        async for chunk in request.stream():
            if len(data)+len(chunk)>3*1024*1024:raise HTTPException(413,'Request too large')
            data.extend(chunk)
        try:
            body=json.loads(data)
            track=base64.b64decode(body['track'],validate=True)
            network=base64.b64decode(body['network'],validate=True)
            track_input(track);network_input(network)
            config=validate_config(body['settings'], work_limit=8_000_000) if 'settings' in body else None
            ticket=tickets.put(track,network,body.get('automatic',True),config)
            return {'ticket':ticket,'expires_in_seconds':120}
        except RuntimeError:raise HTTPException(429,'GPU input capacity reached') from None
        except Exception:raise HTTPException(400,'Invalid GPU input') from None
        finally:data.clear()

    @app.delete('/api/gpu/prepare/{ticket}')
    def discard_prepared(ticket:str):
        # A quota rejection can happen after preparation but before dispatch.
        # The opaque ticket is the sole deletion capability for pending inputs.
        return {'deleted':tickets.discard(ticket)}

    @app.api(name='gpu_train',concurrency_limit=1,concurrency_id='gpu',api_visibility='undocumented')
    def gpu_train(ticket:str)->dict:
        if not admission.acquire(blocking=False):raise ValueError('GPU worker busy')
        try:
            track,network,automatic,*config=tickets.take(ticket)
            try:
                payload,report=cuda_call(track,network,*config)
                published,public_report=publish_worker_result(
                    base.state.results,payload,report,automatic,require_analysis=require_analysis)
                return {**published,'backend':'gpu','report':public_report}
            except CapacityExceeded:
                raise ValueError('Result capacity reached; no result was published.') from None
            except Exception:
                # Gradio logs callback exceptions. Keep native/provider details out
                # of both logs and the browser-facing error while preserving the
                # UI's separate pending-ticket cleanup check.
                raise ValueError('GPU processing failed; no result was published.') from None
        finally:admission.release()

    @app.api(name='visitor_identity',api_visibility='undocumented')
    def queue_identity(request:gr.Request)->dict:
        # Same queue/client credential path, but no GPU decorator or user files.
        return visitor_identity(request.headers or {})

    # Existing download/status/ACK/delete and CPU routes use the same result store.
    for route in base.router.routes:
        if getattr(route,'path',None)!='/api/capabilities':app.router.routes.append(route)
    for middleware in base.user_middleware:
        app.add_middleware(middleware.cls,*middleware.args,**middleware.kwargs)
    return app

def main():
    verify_package()
    for name in ('altd-sim','extract_saved_track'):(ROOT/'bin'/name).chmod(0o755)

    @spaces.GPU(duration=90)
    def cuda(track,network,config=None):
        return run_native(track,network,binary=ROOT/'bin/altd-sim',
            importer=ROOT/'bin/extract_saved_track',scene_template=ROOT/'assets/formula_template.json',
            gpu_library=ROOT/'bin/libaltd_gpu.so',with_report=True,config=config)

    build_app(cuda,require_analysis=True).launch(server_name='0.0.0.0',server_port=7860,run_history=False,
        enable_monitoring=False,show_error=False)

if __name__=='__main__':main()
