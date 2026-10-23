"""Shared CPU routes and delivery API for hosted ALD training."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import threading
from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, Response, HTMLResponse, JSONResponse
from starlette.concurrency import run_in_threadpool
from delivery import create_api, CapacityExceeded, InvalidAnalysisOutput, publish_worker_result
from worker import run_reported
from build_info import build_identity
from training_config import validate_config
from hf_identity import oauth_config
from builtin_tracks import TrackLibrary
from steam_leaderboard import compare_public_best_lap, milliseconds, SteamUnavailable
from bucket_storage import (BucketStorageError, MAX_REQUEST as BUCKET_MAX_REQUEST,
    MAX_RECIPE_LIBRARY, run_bucket_operation, valid_bucket_id, valid_bundle_key,
    valid_recipe_key, validate_recipe_library, AUTOSAVE_APP_KEY, winner_sidecar_filename)
from portable_bundle import (BundleError, load_bundle, MAX_BUNDLE, MAX_NETWORK,
    MAX_ANALYSIS_ARCHIVE, MAX_ANALYSIS_FILE_BYTES)

ROOT=Path(__file__).resolve().parent
EVOLUTION_SIDECAR=re.compile(r'^[a-z0-9][a-z0-9-]{0,63}-(formula|rally|snowmobile|truck)-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}(?:-(fitness-winner|fastest-lap-winner|clean-laps-winner))?\.evolution$')

def create_app(worker=run_reported,store=None,gpu_worker=None,track_library=None,require_analysis=False,replay_tools=None):
    app=create_api(store)
    admission=threading.BoundedSemaphore(1)
    leaderboard_admission=threading.BoundedSemaphore(1)
    bucket_admission=threading.BoundedSemaphore(1)
    library=track_library if track_library is not None else TrackLibrary(ROOT/'builtin_tracks')
    # Trusted application configuration only; request bodies never select tools.
    replay_tools = dict(replay_tools) if replay_tools is not None else dict(
        binary=ROOT/'bin/altd-sim', importer=ROOT/'bin/extract_saved_track',
        scene_template=ROOT/'assets/formula_template.json')

    @app.middleware('http')
    async def bucket_no_store(request:Request, call_next):
        response=await call_next(request)
        if request.url.path.startswith('/api/bucket/'):
            response.headers['Cache-Control']='no-store'
        return response

    def bucket_token(request:Request):
        authorization=request.headers.get('authorization','')
        if not authorization.startswith('Bearer '):
            raise HTTPException(401,'Storage credential required')
        token=authorization[7:]
        if not token or len(token)>4096 or any(ch.isspace() or ord(ch)<33 for ch in token):
            raise HTTPException(401,'Storage credential required')
        return token

    async def bucket_body(request:Request, token:str, *, limit:int, fields:set[str]):
        chunks=bytearray()
        try:
            async for chunk in request.stream():
                if len(chunks)+len(chunk)>limit: raise HTTPException(413,'Storage request too large')
                chunks.extend(chunk)
            def unique_object(pairs):
                result={}
                for key,value in pairs:
                    if key in result: raise ValueError('duplicate key')
                    result[key]=value
                return result
            value=json.loads(chunks.decode('utf-8'),object_pairs_hook=unique_object)
            if not isinstance(value,dict) or set(value)!=fields:
                raise ValueError('invalid body')
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400,'Invalid storage request') from None
        finally:
            chunks.clear()
        if not valid_bucket_id(value.get('bucket_id')):
            raise HTTPException(400,'Invalid storage request')
        return value

    def bucket_http_error(exc:BucketStorageError):
        status={'unauthorized':401,'forbidden':403,'not_found':404,'invalid_request':400,
                'invalid_bundle':400,'storage_unavailable':502,'timeout':504}.get(exc.category,502)
        detail=('Storage credential is invalid' if status==401 else
                'Storage access is unavailable' if status==403 else
                'Invalid portable bundle' if exc.category=='invalid_bundle' else
                'Storage operation timed out' if status==504 else
                'Storage operation failed')
        return HTTPException(status,detail)

    async def bucket_operation(request:Request, operation:str, *, fields:set[str], limit:int=4096):
        token=bucket_token(request)
        if not bucket_admission.acquire(blocking=False):
            raise HTTPException(429,'Storage operation busy')
        try:
            body=await bucket_body(request,token,limit=limit,fields=fields)
            bundle_raw=None
            bundle_obj=None
            bundle_files=None
            if operation=='save':
                bundle=body.get('bundle')
                if not isinstance(bundle,str) or len(bundle.encode('utf-8'))>MAX_BUNDLE:
                    raise HTTPException(400,'Invalid portable bundle')
                try: bundle_obj,bundle_files=load_bundle(bundle.encode('utf-8'))
                except BundleError: raise HTTPException(400,'Invalid portable bundle') from None
                bundle_raw=bundle.encode('utf-8')
                call_args={'bundle_base64':base64.b64encode(bundle_raw).decode('ascii')}
            elif operation=='recipes_save':
                library=body.get('library')
                if not isinstance(library,str): raise HTTPException(400,'Invalid recipe library')
                try: library_raw=library.encode('utf-8')
                except UnicodeEncodeError: raise HTTPException(400,'Invalid recipe library') from None
                if len(library_raw)>MAX_RECIPE_LIBRARY:
                    raise HTTPException(413,'Recipe library too large')
                try: validate_recipe_library(library_raw)
                except Exception: raise HTTPException(400,'Invalid recipe library') from None
                call_args={'library_base64':base64.b64encode(library_raw).decode('ascii')}
            elif operation=='restore':
                if not valid_bundle_key(body.get('key')):
                    raise HTTPException(400,'Invalid storage request')
                call_args={'key':body['key']}
            elif operation=='recipes_restore':
                if not valid_recipe_key(body.get('key')):
                    raise HTTPException(400,'Invalid storage request')
                call_args={'key':body['key']}
            else:
                call_args={}
            try:
                result=await run_in_threadpool(run_bucket_operation,operation,token,body['bucket_id'],**call_args)
            except BucketStorageError as exc:
                raise bucket_http_error(exc) from None
            if operation=='save':
                result['_validated_bundle_bytes']=bundle_raw
                result['_validated_bundle_files']=bundle_files
                result['_validated_bundle_has_receipt']='run_receipt' in bundle_obj['artifacts']
            if operation=='recipes_save':
                result['_validated_library_bytes']=library_raw
                result['_validated_bucket_id']=body['bucket_id']
            return result
        finally:
            bucket_admission.release()

    @app.post('/api/bucket/connect')
    async def bucket_connect(request:Request):
        result=await bucket_operation(request,'connect',fields={'bucket_id'})
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    @app.post('/api/bucket/list')
    async def bucket_list(request:Request):
        result=await bucket_operation(request,'list',fields={'bucket_id'})
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    @app.post('/api/bucket/save')
    async def bucket_save(request:Request):
        result=await bucket_operation(request,'save',fields={'bucket_id','bundle'},limit=BUCKET_MAX_REQUEST)
        raw=result.pop('_validated_bundle_bytes',None)
        bundle_files=result.pop('_validated_bundle_files',None)
        has_receipt=result.pop('_validated_bundle_has_receipt',False)
        verified=result.get('verified_files')
        required={'bundle.json'}
        if has_receipt:
            required|={'report.md','generation-history.csv'}
        if isinstance(bundle_files,dict) and 'analysis_archive.gz' in bundle_files:
            required.add('analysis-archive.gz')
            required.update(name for name in bundle_files if name.startswith('analysis/'))
            if 'analysis/stars.json' in bundle_files:
                required.add('star-check.txt')
            key_match=AUTOSAVE_APP_KEY.fullmatch(result.get('key',''))
            if key_match is None:
                raise HTTPException(502,'Storage operation failed')
            for role in ('fitness','fastest_lap','clean_laps'):
                inner=f'analysis/winners/{role}.evolution'
                if inner in bundle_files:
                    required.add(winner_sidecar_filename(key_match.group('track'),key_match.group('vehicle'),
                        key_match.group('timestamp'),key_match.group('uuid')[:8],role))
        evolution=[name for name in verified if isinstance(name,str)
                   and (match:=EVOLUTION_SIDECAR.fullmatch(name)) and match.group(2) is None] if isinstance(verified,dict) else []
        if len(evolution)!=1 or not isinstance(verified,dict) or set(verified)!=(required|{evolution[0]}):
            raise HTTPException(502,'Storage operation failed')
        if not isinstance(raw,bytes) or not isinstance(bundle_files,dict):
            raise HTTPException(502,'Storage operation failed')
        network=bundle_files['selected_network.evolution']
        safe_verified={}
        total=0
        per_file_limit=MAX_ANALYSIS_FILE_BYTES
        for name,proof in verified.items():
            if (not isinstance(proof,dict) or set(proof)!={'bytes','sha256'}
                    or type(proof['bytes']) is not int or not 0<=proof['bytes']<=per_file_limit
                    or not isinstance(proof['sha256'],str) or not re.fullmatch(r'[0-9a-f]{64}',proof['sha256'])):
                raise HTTPException(502,'Storage operation failed')
            total+=proof['bytes']
            safe_verified[name]={'bytes':proof['bytes'],'sha256':proof['sha256']}
        if (total>MAX_BUNDLE+MAX_NETWORK+320*1024*1024
                or safe_verified['bundle.json']!={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
                or safe_verified[evolution[0]]!={'bytes':len(network),'sha256':hashlib.sha256(network).hexdigest()}):
            raise HTTPException(502,'Storage operation failed')
        analysis_archive=bundle_files.get('analysis_archive.gz')
        if analysis_archive is not None and safe_verified.get('analysis-archive.gz')!={
                'bytes':len(analysis_archive),'sha256':hashlib.sha256(analysis_archive).hexdigest()}:
            raise HTTPException(502,'Storage operation failed')
        for filename,content in bundle_files.items():
            if filename.startswith('analysis/') and safe_verified.get(filename)!={
                    'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()}:
                raise HTTPException(502,'Storage operation failed')
        for role in ('fitness','fastest_lap','clean_laps'):
            inner=f'analysis/winners/{role}.evolution'
            key_match=AUTOSAVE_APP_KEY.fullmatch(result.get('key',''))
            sidecar=(winner_sidecar_filename(key_match.group('track'),key_match.group('vehicle'),
                key_match.group('timestamp'),key_match.group('uuid')[:8],role) if key_match else '')
            if inner in bundle_files and safe_verified.get(sidecar)!={
                    'bytes':len(bundle_files[inner]),'sha256':hashlib.sha256(bundle_files[inner]).hexdigest()}:
                raise HTTPException(502,'Storage operation failed')
        return JSONResponse({key:result[key] for key in ('status','bucket_id','key','bytes','sha256')}|{'verified_files':safe_verified},headers={'Cache-Control':'no-store'})

    @app.post('/api/bucket/restore')
    async def bucket_restore(request:Request):
        result=await bucket_operation(request,'restore',fields={'bucket_id','key'})
        return Response(result['bundle_bytes'],media_type='application/json',headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

    @app.post('/api/bucket/recipes/list')
    async def bucket_recipes_list(request:Request):
        result=await bucket_operation(request,'recipes_list',fields={'bucket_id'})
        items=result.get('items')
        if (not isinstance(items,list) or type(result.get('truncated')) is not bool
                or type(result.get('scan_incomplete')) is not bool or len(items)>50):
            raise HTTPException(502,'Storage operation failed')
        clean=[]
        for item in items:
            if (not isinstance(item,dict) or set(item)!={'key','bytes','label','created_at'}
                    or not valid_recipe_key(item.get('key')) or type(item.get('bytes')) is not int
                    or not 0<=item['bytes']<=MAX_RECIPE_LIBRARY
                    or not isinstance(item.get('label'),str) or len(item['label'])>192
                    or (item.get('created_at') is not None and not isinstance(item.get('created_at'),str))):
                raise HTTPException(502,'Storage operation failed')
            clean.append(item)
        return JSONResponse({'items':clean,'truncated':result['truncated'],
                             'scan_incomplete':result['scan_incomplete']},headers={'Cache-Control':'no-store'})

    @app.post('/api/bucket/recipes/save')
    async def bucket_recipes_save(request:Request):
        result=await bucket_operation(request,'recipes_save',fields={'bucket_id','library'},
                                      limit=MAX_RECIPE_LIBRARY*6+4096)
        raw=result.pop('_validated_library_bytes',None)
        expected_bucket=result.pop('_validated_bucket_id',None)
        verified=result.pop('verified_bytes',None)
        if (not isinstance(raw,bytes) or verified!=raw or result.get('status')!='saved_verified'
                or result.get('bucket_id')!=expected_bucket or not valid_recipe_key(result.get('key'))
                or result.get('bytes')!=len(raw) or result.get('sha256')!=hashlib.sha256(raw).hexdigest()):
            raise HTTPException(502,'Storage operation failed')
        return JSONResponse({key:result[key] for key in ('status','bucket_id','key','bytes','sha256')},
                            headers={'Cache-Control':'no-store'})

    @app.post('/api/bucket/recipes/restore')
    async def bucket_recipes_restore(request:Request):
        result=await bucket_operation(request,'recipes_restore',fields={'bucket_id','key'})
        raw=result.get('recipe_bytes')
        if not isinstance(raw,bytes) or not valid_recipe_key(result.get('key')):
            raise HTTPException(502,'Storage operation failed')
        return Response(raw,media_type='application/json',headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    @app.get('/api/tracks')
    def track_catalog():
        return JSONResponse(library.catalog(),headers={'Cache-Control':'no-store'})
    @app.post('/api/leaderboard/compare')
    async def leaderboard_compare(request:Request):
        data=bytearray()
        async for chunk in request.stream():
            if len(data)+len(chunk)>4096: raise HTTPException(413,'Request too large')
            data.extend(chunk)
        try:
            body=json.loads(data)
            if not isinstance(body,dict) or set(body)!={'track_id','track_sha256','vehicle_type','lap_seconds'}:
                raise ValueError()
            if not isinstance(body['track_id'],str) or not isinstance(body['track_sha256'],str): raise ValueError()
            if type(body['vehicle_type']) is not int or not 0<=body['vehicle_type']<=3: raise ValueError()
            milliseconds(body['lap_seconds'])
        except Exception: raise HTTPException(400,'Invalid leaderboard comparison request') from None
        finally: data.clear()
        entry=next((track for track in library.catalog()['tracks'] if track['id']==body['track_id']),None)
        if entry is None:
            return {'status':'unsupported_track','message':'Steam comparison is available only for supported built-in tracks.'}
        if body['track_sha256']!=entry['sha256']:
            raise HTTPException(400,'Track identity did not match the built-in catalog')
        if not leaderboard_admission.acquire(blocking=False):
            return {'status':'busy','message':'Another Steam check is in progress. The completed result is unaffected.'}
        try:
            result=await run_in_threadpool(compare_public_best_lap,entry,body['lap_seconds'])
            if result.get('status')=='ok':result['vehicle_type']=body['vehicle_type']
            return result
        except SteamUnavailable as error:
            result={'status':'unavailable','failure_category':error.failure_category,
                'message':'Steam could not provide a complete public leaderboard. The completed result is unaffected.'}
            if error.failure_category == 'rate_limited':
                result['message']='Steam is limiting leaderboard requests. Checks pause for one minute; your completed result is unaffected.'
            if error.upstream_http_status is not None:
                result['upstream_http_status']=error.upstream_http_status
            return result
        finally:
            leaderboard_admission.release()
    @app.get('/api/tracks/{identifier}/file')
    def reference_track(identifier:str):
        try:payload=library.read(identifier)
        except KeyError:raise HTTPException(404,'Built-in track not found') from None
        except (ValueError,OSError):raise HTTPException(503,'Built-in track validation failed') from None
        return Response(payload,media_type='application/octet-stream',headers={'Cache-Control':'no-store'})
    @app.get('/track-library.js')
    def track_script():return FileResponse(ROOT/'track-library.js',media_type='text/javascript')
    @app.get('/track-map.js')
    def map_script():return FileResponse(ROOT/'track-map.js',media_type='text/javascript',headers={'Cache-Control':'no-store'})
    @app.get('/assets/track-atlas.json')
    def track_atlas():return FileResponse(ROOT/'assets/track-atlas.json',media_type='application/json')
    @app.get('/api/auth/config')
    def auth_config():
        return JSONResponse(oauth_config(),headers={'Cache-Control':'no-store'})
    @app.get('/hf-auth.js')
    def auth_script(): return FileResponse(ROOT/'hf-auth.js',media_type='text/javascript')
    @app.get('/hf-oauth.js')
    def oauth_script(): return FileResponse(ROOT/'vendor/hf-oauth/index.js',media_type='text/javascript')
    @app.get('/api/capabilities')
    def capabilities():
        return {'cpu':True,'gpu':gpu_worker is not None,'default':'cpu','configurable_training':True,'build':build_identity()}
    @app.get('/')
    def index():
        # Deliver the bootstrap with the authenticated document: private HF
        # iframe subresource access can fail before an external script runs.
        script=(ROOT/'client.js').read_text().replace('</script','<\\/script')
        map_js=(ROOT/'track-map.js').read_text().replace('</script','<\\/script')
        return HTMLResponse((ROOT/'index.html').read_text().replace(
            '<script src="/track-map.js"></script>','<script>'+map_js+'</script>').replace(
            '<script src="/client.js"></script>','<script>'+script+'</script>').replace(
            '<script src="/agent-tools.js"></script>','<script>'+(ROOT/'agent-tools.js').read_text().replace('</script','<\\/script')+'</script>'),
            headers={'Referrer-Policy':'no-referrer','Cache-Control':'no-store'})
    @app.get('/agent-tools.js')
    def agent_script():return FileResponse(ROOT/'agent-tools.js',media_type='text/javascript',headers={'Cache-Control':'no-store'})
    @app.get('/agent-manifest.json')
    def agent_manifest():return FileResponse(ROOT/'agent-manifest.json',media_type='application/json',headers={'Cache-Control':'no-store'})
    @app.get('/agents')
    def agent_guide():return FileResponse(ROOT/'agents.html',media_type='text/html')
    @app.get('/client.js')
    def script(): return FileResponse(ROOT/'client.js',media_type='text/javascript')
    @app.get('/feedback')
    def feedback(): return FileResponse(ROOT/'FEEDBACK.md',media_type='text/plain')
    @app.get('/policy')
    def policy(): return FileResponse(ROOT/'DATA_POLICY.md',media_type='text/plain')
    @app.get('/help')
    def help_page(): return FileResponse(ROOT/'help.html',media_type='text/html')
    @app.post('/api/process')
    async def process(request:Request):
        if not admission.acquire(blocking=False): raise HTTPException(429,'Worker busy; try later')
        try:
            data=bytearray()
            async for chunk in request.stream():
                if len(data)+len(chunk)>3*1024*1024: raise HTTPException(413,'Request too large')
                data.extend(chunk)
            try:
                body=json.loads(data)
                automatic=body.get('automatic',True)
                backend=body.get('backend','cpu')
                if backend not in ('cpu','gpu'): raise ValueError()
                if type(automatic) is not bool: raise ValueError()
                track=base64.b64decode(body['track'],validate=True)
                network=base64.b64decode(body['network'],validate=True)
                if not track or not network or max(len(track),len(network))>1024*1024: raise ValueError()
            except Exception: raise HTTPException(400,'Invalid input envelope') from None
            finally: data.clear()
            try:config=validate_config(body['settings']) if 'settings' in body else None
            except ValueError as error:raise HTTPException(400,str(error)) from None
            selected=worker if backend=='cpu' else gpu_worker
            if selected is None: raise HTTPException(503,'GPU is unavailable; select CPU to run without a GPU lease')
            try:
                result=await run_in_threadpool(selected,track,network,config) if config is not None else await run_in_threadpool(selected,track,network)
                payload,report=result if isinstance(result,tuple) else (result,None)
                published,public_report=publish_worker_result(
                    app.state.results,payload,report,automatic,require_analysis=require_analysis)
                return {**published,'backend':backend,'report':public_report}
            except CapacityExceeded: raise HTTPException(503,'Result capacity reached') from None
            except InvalidAnalysisOutput: raise HTTPException(422,'Processing failed; complete analysis could not be verified.') from None
            except Exception: raise HTTPException(422,'Processing failed; no result published. Cleanup status requires verification.') from None
        finally: admission.release()
    @app.post('/api/replay')
    async def recorded_replay(request:Request):
        # Share CPU admission with training; recordings never allocate a GPU.
        if not admission.acquire(blocking=False):
            raise HTTPException(429,'Worker busy; finish the current run before recording a drive')
        data=bytearray()
        try:
            async for chunk in request.stream():
                if len(data)+len(chunk)>3*1024*1024:
                    raise HTTPException(413,'Replay input exceeds the upload limit')
                data.extend(chunk)
            try:
                body=json.loads(data)
                if not isinstance(body,dict) or set(body)!={'track','network','ticks'}:
                    raise ValueError()
                if type(body['ticks']) is not int or not 1<=body['ticks']<=900:
                    raise ValueError()
                track=base64.b64decode(body['track'],validate=True)
                network=base64.b64decode(body['network'],validate=True)
                if not track or not network or max(len(track),len(network))>1024*1024:
                    raise ValueError()
            except Exception:
                raise HTTPException(400,'Invalid replay input; select a track, a network and up to 15 seconds') from None
            finally:
                data.clear()
            from replay import record_replay, ReplayError
            try:
                recording=await run_in_threadpool(record_replay,track,network,
                    **replay_tools,ticks=body['ticks'])
                recording['build']=build_identity()
                return JSONResponse(recording,headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
            except (TimeoutError,subprocess.TimeoutExpired):
                raise HTTPException(504,'Recording reached its time limit. Try a 5-second drive.') from None
            except (ReplayError,OSError,ValueError,KeyError,TypeError,subprocess.CalledProcessError):
                raise HTTPException(422,'The engine could not produce a complete recorded drive. No estimated playback was substituted.') from None
        finally:
            data.clear()
            admission.release()
    return app

app=create_app()

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=47831,access_log=False)
