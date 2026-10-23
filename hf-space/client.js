'use strict';
const $ = id => document.getElementById(id);
let job = null;
let busy = false;
let replayBusy = false;
let localReplay = null;
let localReplayName = null;
let localReplayDriver = null;
let serverCopyStatus = 'no server result has been published.';
let runDisplayContext = null;
let replayRequestId = 0;
let localResult = null;
let localAnalysis = null;
let pairedAnalysisPending = false;
let selectedWinner = null;
let comparisonRows = [];
let comparisonPlan = null;
let capabilitiesReady = false;
let gpuTransport = null;
let gpuAvailable = false;
let gradioClient = null;
let stagedNetwork = null;
let batchActive = false;
let batchStopRequested = false;
let batchReceipt = null;
let runReceipt = null;
let runResultContext = null;
let appBuild = null;
let leaderboardRequest = null;
let leaderboardGeneration = 0;
let portableReceipt = null;
let bundleRestoring = false;
let bucketToken = null;
let bucketId = null;
let bucketUsername = null;
let bucketItems = [];
let bucketSelectedKey = null;
let bucketRecipeItems = [];
let bucketRecipeSelectedKey = null;
let bucketOperation = false;
let bucketOperationId = 0;
let bucketEpoch = 0;
let bundleRestoreId = 0;
// Display context affects quota guidance, never whether GPU can be selected.
const hostedStandalone = location.hostname.endsWith('.hf.space') && window.self === window.top;
const say = text => { $('status').textContent = text; };
const isGpuQuotaError = error => /ZeroGPU.*(?:limit|quota)|(?:limit|quota).*ZeroGPU/i.test(String(error?.message??error));
function displayError(error){
  return isGpuQuotaError(error)
    ? 'GPU allowance is exhausted for this request. Choose CPU, or sign in with HF above to use your account allowance. No personal token is needed in this app.'
    : String(error?.message??error);
}
const trackLibrary=window.TrackLibrary?.mount({document,fetch,digest:sha});
window.TrackMap?.mount({document,fetch,picker:trackLibrary});
const trackSource=()=>trackLibrary?trackLibrary.file():Promise.resolve($('track').files[0]);
async function runTrackSource(priorContext=null){
  const trackInfo=trackLibrary?.info()??{source:'upload'},file=await trackSource();
  if(file)return {file,trackInfo};
  if(trackInfo.source==='upload'&&selectedWinner&&priorContext?.trackBytes?.length){
    return {file:new Blob([priorContext.trackBytes],{type:'application/octet-stream'}),trackInfo:priorContext.trackInfo??trackInfo};
  }
  throw Error('Choose or select a track before starting this run.');
}
function batchRunContext(){
  const trackInfo=trackLibrary?.info()??{source:'upload'},trackFile=$('track').files[0],network=networkSource(),backend=$('backend').value;
  const hasTrack=trackInfo.source==='builtin'||!!trackFile;
  let reason='';
  if(busy||replayBusy||bundleRestoring||bucketOperation)reason='Finish the current operation before starting a batch.';
  else if(job)reason='Finish or delete the current result before starting a batch.';
  else if(!capabilitiesReady)reason='Connect to the training service before running a batch.';
  else if($('run_mode')?.value==='evaluate')reason='Under Action in Run & results, choose Train a population before running a batch.';
  else if(!network)reason='Choose or create a starting network in Run & results.';
  else if(!hasTrack)reason='Choose a track in Run & results.';
  else if(backend==='gpu'&&!gpuAvailable)reason='GPU is unavailable. Choose CPU in Run & results.';
  return {available:!reason,reason,
    track:trackInfo.source==='builtin'?trackInfo.display_name:trackFile?.name,
    network:network?.name||(network?'Selected network':null),backend:backend.toUpperCase()};
}
function buttons() {
  const settingsUnavailable=busy||replayBusy||bundleRestoring||bucketOperation;
  const unavailable=settingsUnavailable||!!job;
  trackLibrary?.setBusy(unavailable);
  window.HFAuth?.setBusy(unavailable);
  // A pending result blocks another run, but its receipt does not own the next recipe.
  window.setTrainingBusy?.(settingsUnavailable,unavailable);
  window.setEditorBusy?.(unavailable);
  $('run').disabled = unavailable || !capabilitiesReady || !networkSource() || ($('backend').value==='gpu'&&!gpuAvailable);
  $('backend').disabled = unavailable || !capabilitiesReady;
  $('download').disabled = busy || !job;
  $('erase').disabled = busy || !job;
  const autosaving=!!bucketToken&&!!$('bucket_autosave')?.checked;
  $('keepServer').disabled = busy || !!job || autosaving || !!comparisonPlan;
  $('saveLocal').disabled = busy || !localResult;
  $('forgetLocal').disabled = busy || !localResult;
  $('track').disabled=unavailable;
  $('network').disabled=unavailable;
  if($('replay_import'))$('replay_import').disabled=unavailable||batchActive||!replayNetworkSource();
  if($('replay_record'))$('replay_record').disabled=unavailable||batchActive||!capabilitiesReady||!replayNetworkSource();
  if($('replay_duration'))$('replay_duration').disabled=settingsUnavailable;
  if($('replay_download'))$('replay_download').disabled=replayBusy||!localReplay;
  if($('replay_policy')){
    const selected=networkSource();
    $('replay_policy').textContent=selected?'Policy: '+(selected.name||'Selected network'):localResult?'Policy: latest received result. Choose a winner below to record a different policy.':'Choose or create a network to record a drive.';
  }
  if($('batch_start')){
    const context=batchRunContext();
    window.setBatchRunContext?.(context);
    $('batch_start').disabled=!context.available||!window.getBatchReadiness?.()?.ready;
  }
  if($('batch_stop'))$('batch_stop').disabled=!batchActive || batchStopRequested;
  if($('run_export'))$('run_export').disabled=busy || !runReceipt || pairedAnalysisPending;
  const report=pairedAnalysisPending?null:(cleanRunReceipt(runReceipt)||cleanRunReceipt(portableReceipt));
  if($('player_report_download'))$('player_report_download').disabled=busy||!report;
  if($('history_csv_download'))$('history_csv_download').disabled=busy||!report?.report?.history?.length;
  if($('batch_export'))$('batch_export').disabled=busy || !batchReceipt;
  if($('run_mode'))$('run_mode').disabled=unavailable;
  if($('clean_min_laps'))$('clean_min_laps').disabled=unavailable;
  if($('analysis_download'))$('analysis_download').disabled=busy||!localAnalysis;
  if($('descriptor_show'))$('descriptor_show').disabled=busy||!localAnalysis||localAnalysis.mode!=='train';
  if($('compare_winners'))$('compare_winners').disabled=busy||!localAnalysis||!selectedWinnerRoles().length;
  if($('winner_continue_train'))$('winner_continue_train').disabled=unavailable||!localAnalysis?.winnerNetworks?.[$('winner_continue')?.value||'fitness'];
  if($('winner_use'))$('winner_use').disabled=unavailable||!localAnalysis?.winnerNetworks?.[$('winner_continue')?.value||'fitness'];
  if($('compare_add'))$('compare_add').disabled=busy||!localAnalysis||localAnalysis.mode!=='evaluate';
  if($('bundle_export'))$('bundle_export').disabled=unavailable||pairedAnalysisPending;
  if($('bundle_import'))$('bundle_import').disabled=unavailable;
  const storageToken=window.HFAuth?.getStorageToken?.()??null;
  if($('bucket_connect'))$('bucket_connect').disabled=unavailable||!storageToken||!!bucketToken;
  if($('bucket_id'))$('bucket_id').disabled=unavailable||!storageToken||!!bucketToken;
  if($('bucket_disconnect'))$('bucket_disconnect').disabled=unavailable||!bucketToken;
  if($('bucket_save'))$('bucket_save').disabled=unavailable||!bucketToken||(!networkSource()&&!localResult)||pairedAnalysisPending;
  if($('bucket_refresh'))$('bucket_refresh').disabled=unavailable||!bucketToken;
  if($('bucket_restore'))$('bucket_restore').disabled=unavailable||!bucketToken||!$('bucket_items')?.value;
  if($('bucket_items'))$('bucket_items').disabled=unavailable||!bucketToken;
  if($('bucket_recipe_save'))$('bucket_recipe_save').disabled=unavailable||!bucketToken;
  if($('bucket_recipe_refresh'))$('bucket_recipe_refresh').disabled=unavailable||!bucketToken;
  if($('bucket_recipe_items'))$('bucket_recipe_items').disabled=unavailable||!bucketToken;
  if($('bucket_recipe_import'))$('bucket_recipe_import').disabled=unavailable||!bucketToken||!$('bucket_recipe_items')?.value;
  if($('bucket_autosave'))$('bucket_autosave').disabled=unavailable||!bucketToken;
  syncRunModeUI(settingsUnavailable);
  renderResultSummary();
  renderRecordingIdentity();
}
// Presentation only: these summaries reuse the verified run/replay state and existing controls.
function selectedReplayDriverLabel(){
  const selected=networkSource();
  if(selected)return selected.name||'Selected driver';
  if(localResult){
    const winner=localAnalysis?.summary?.winners?.fitness;
    return winner?.status==='available'?'Final fitness leader · '+winner.candidate_id:'Latest received result';
  }
  return null;
}
function renderResultSummary(){
  const panel=$('resultSummary');if(!panel)return;
  const running=$('runState').textContent.startsWith('RUNNING')||$('runState').textContent.startsWith('BATCH RUNNING');
  panel.hidden=!runDisplayContext&&!runReceipt&&!portableReceipt&&!localResult&&!job&&!running;
  const receipt=runReceipt||portableReceipt,report=runDisplayContext?runDisplayContext.report:receipt?.report;
  const mode=report?.mode??report?.settings?.mode??report?.analysis_summary?.mode??runDisplayContext?.mode;
  $('result_backend').textContent=(runDisplayContext?.backend||receipt?.backend||job?.backend||$('backend').value).toUpperCase()+(running?' · running':'');
  $('result_outcome').textContent=running?'Completion is not yet confirmed.':report
    ?((mode==='evaluate'?'Frozen evaluation':'Training')+' · '+(report.generations_completed??'—')+' / '+(report.generations_requested??'—')+' generations · '+(report.best_lap_seconds==null?'No completed lap observed':Number(report.best_lap_seconds).toFixed(3)+' s best lap observed')+'. A completed run does not establish improved driving.')
    :'No verified run measurements are available.';
  const driver=selectedReplayDriverLabel();
  $('result_driver').textContent=networkSource()?'Selected for replay / next run: '+driver+'.':localResult?'Received driver for replay: '+driver+'. To use it for another run or batch, select a winner below or upload the downloaded driver.':'No driver selected for replay or the next run.';
  const serverState=running?'waiting for a published result.':!runDisplayContext&&portableReceipt&&!runReceipt?'not tracked for this restored bundle.':serverCopyStatus;
  $('result_server').textContent='Server copy: '+serverState+(localResult&&!running?' Verified browser driver remains available.':'');
  $('result_replay').disabled=busy||replayBusy||!!job||!driver;
  $('download').hidden=!job;
  $('saveLocal').hidden=!!job&&!localResult;
  $('saveLocal').textContent='Download received driver';
  if($('setup_next_step'))$('setup_next_step').textContent=running?'Run in progress. Its result will appear above when confirmed.':networkSource()
    ?'Selected driver is ready. Review Training & recipes, then start the next run.'
    :localResult?'Your received driver is available in Latest run above. Download it, replay it, or select a winner below to continue.'
    :job?'Receive the completed driver using Download driver in Latest run above. Its weights can then be replayed or inspected.'
    :'Choose or create a driver, then review Training & recipes and start a run.';
  if($('starter_network_status'))$('starter_network_status').textContent=networkSource()?'Selected driver: '+(networkSource().name||'Browser driver')+'. A new starter replaces this selection without starting a run.':localResult?'The latest trained or evaluated driver is received. Use Latest run above to download or replay it. Create a starter only to begin a new experiment.':job?'The run has finished. Receive the driver using Latest run above, or delete the server result before starting another experiment.':'Creates a small network in this page only. It does not start a run or change saved recipes.';
}
function renderRecordingIdentity(){
  const label=$('replay_loaded');if(!label)return;
  label.hidden=!localReplay;
  label.textContent=localReplay?'Recording loaded: '+localReplayName+' · '+(localReplay.requested_ticks/60).toFixed(2)+' seconds · '+localReplay.frames.length+' measured samples · Matching driver: '+localReplayDriver+'. Fresh CPU evaluation.':'';
}
function openReplayWorkspace({focusRecord=false}={}){
  $('drive').classList.add('replay-focused');
  $('replay_focus').textContent='Return to run setup';$('replay_focus').setAttribute('aria-pressed','true');
  const target=focusRecord?$('replayControls'):$('replay_workspace');
  target.tabIndex=-1;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});
}
if($('result_replay'))$('result_replay').onclick=()=>openReplayWorkspace({focusRecord:true});
const trainingOnlyControls=['population','generations','mutation','mutation_end','schedule','adaptive_mutation','selection','parents','elite','crossover','decay','preset','reward_preset','add','rewards'];
function syncRunModeUI(unavailable=busy||bundleRestoring||bucketOperation){
  const evaluation=$('run_mode')?.value==='evaluate';
  for(const id of trainingOnlyControls){const node=$(id);if(node)node.disabled=unavailable||evaluation;}
  if($('native_settings'))$('native_settings').hidden=evaluation;
  if($('reward_settings'))$('reward_settings').hidden=evaluation;
  if($('freeze_settings'))$('freeze_settings').hidden=evaluation;
  if($('run'))$('run').textContent=evaluation?'Evaluate policy (weights frozen)':'Run training';
  if($('run_mode_help'))$('run_mode_help').textContent=evaluation
    ?'Frozen evaluation uses the selected policy unchanged in a fresh car. Mutation, decay, crossover, reproduction and winner selection are disabled.'
    :'Training uses the current settings in Training & recipes and records winner policies and per-car measurements.';
}
if($('run_mode'))$('run_mode').addEventListener('change',()=>{
  syncRunModeUI();buttons();
  if(selectedWinner)say($('run_mode').value==='train'
    ?'Selected policy is staged as the starting network for training. The next Run click starts a training run with the current settings.'
    :'Selected policy is ready for frozen evaluation. Its weights stay unchanged; the next Run click starts it.');
});
function showFirstRunTab(tab,focusId){
  const section=document.querySelector('[data-tab="'+tab+'"]');section?.click();
  requestAnimationFrame(()=>{const target=$(focusId);(target&&!target.matches(':disabled')&&!target.closest('[hidden]')?target:section)?.focus();});
}
if($('first_run_track'))$('first_run_track').onclick=()=>showFirstRunTab('drive','trackPresetDrive');
if($('first_run_settings'))$('first_run_settings').onclick=()=>showFirstRunTab('training','population');
if($('starter_create'))$('starter_create').onclick=async()=>{
  try{
    if(busy||job||bundleRestoring||bucketOperation)throw Error('Wait for the current operation to finish before changing the selected network');
    if(networkSource()||localResult){
      if(!(await window.appConfirm('Replace the selected network with a new small starter? This does not start a run. The received result stays in this page until you discard it or close the page.',{heading:'Create starter network',confirmLabel:'Replace with starter'})))return;
    }
    const type=Number($('starter_vehicle').value),outputs=type===2?[0,1,3,4]:[0,1,2,3,4];
    const value=window.NetworkEditor.fresh({type,shape:[6,4],outputs,seed:42105,xavier:true,bias:false,name:'Fresh '+['Formula','Rally','Snowmobile','Truck'][type]+' starter'});
    const compressed=await new Response(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    if(compressed.size>1048576)throw Error('Starter network exceeds the supported file limit');
    if(busy||job||bundleRestoring||bucketOperation)throw Error('A run or storage action started before the starter was ready');
    window.TrainingClient.useNetwork(new File([compressed],'starter-'+['formula','rally','snowmobile','truck'][type]+'-6-4.evolution',{type:'application/octet-stream'}));
    selectedWinner=null;$('starter_network_status').textContent='Small '+['Formula','Rally','Snowmobile','Truck'][type]+' network created and selected in this page. No run started; choose a track and click Run when ready.';
    say('Starter network is ready. Choose a track, review settings if needed, then start the run yourself.');buttons();
  }catch(error){$('starter_network_status').textContent='Starter not created: '+displayError(error);}
};
function renderBucketConnection(){
  const connected=!!bucketToken&&!!bucketId;
  const authorized=!!window.HFAuth?.getStorageToken?.();
  if(connected&&$('bucket_autosave')?.checked&&$('keepServer')?.checked){$('keepServer').checked=false;$('bucket_status').textContent='Automatic bucket saving requires deletion after a verified download; the repeat-download option was turned off.';}
  $('bucketConnectForm')?.toggleAttribute('hidden',connected||!authorized);
  $('bucketConnected')?.toggleAttribute('hidden',!connected);
  if($('bucket_account'))$('bucket_account').textContent=connected?'Connected as '+bucketUsername+' · '+bucketId:'';
  const select=$('bucket_items');
  if(select){
    const options=[];
    if(!bucketItems.length){const option=document.createElement('option');option.value='';option.textContent='Refresh to list saved bundles';options.push(option);}
    for(const item of bucketItems){const option=document.createElement('option');option.value=item.key;option.textContent=item.label+' · '+item.bytes+' bytes';options.push(option);}
    select.replaceChildren(...options);
    if(options.length)select.value=bucketSelectedKey&&bucketItems.some(item=>item.key===bucketSelectedKey)?bucketSelectedKey:'';
  }
  const recipeSelect=$('bucket_recipe_items');
  if(recipeSelect){
    const options=[];
    if(!bucketRecipeItems.length){const option=document.createElement('option');option.value='';option.textContent='Refresh to list saved recipe libraries';options.push(option);}
    for(const item of bucketRecipeItems){const option=document.createElement('option');option.value=item.key;option.textContent=item.label+' · '+item.bytes+' bytes';options.push(option);}
    recipeSelect.replaceChildren(...options);
    if(options.length)recipeSelect.value=bucketRecipeSelectedKey&&bucketRecipeItems.some(item=>item.key===bucketRecipeSelectedKey)?bucketRecipeSelectedKey:'';
  }
  buttons();
}
const bucketKeyValid=key=>typeof key==='string'&&(
  /^ald-exports\/(?:[0-9a-f]{32}|[0-9a-f]{64})\/bundle\.json$/.test(key)||
  /^ald-exports\/\d{8}T\d{6}Z-[a-z0-9-]{1,64}-(?:formula|rally|snowmobile|truck)-g\d{1,4}-lap(?:\d{1,16}ms|none)-[0-9a-f]{32}\/bundle\.json$/.test(key));
const bucketRecipeKeyValid=key=>typeof key==='string'&&/^ald-recipes\/\d{8}T\d{6}Z-[0-9a-f]{32}\/library\.json$/.test(key);
function bucketSnapshot(){return {token:bucketToken,id:bucketId,epoch:bucketEpoch};}
function bucketSnapshotCurrent(snapshot){return !!snapshot?.token&&snapshot.epoch===bucketEpoch&&snapshot.token===bucketToken&&snapshot.id===bucketId;}
function clearBucketConnection(snapshot=null){
  if(snapshot&&!bucketSnapshotCurrent(snapshot))return false;
  bucketEpoch++;
  bucketOperationId++;bucketOperation=false;
  bundleRestoreId++;bundleRestoring=false;
  bucketToken=null;bucketId=null;bucketUsername=null;bucketItems=[];bucketSelectedKey=null;bucketRecipeItems=[];bucketRecipeSelectedKey=null;
  if($('bucket_id'))$('bucket_id').value='';
  if($('bucket_status'))$('bucket_status').textContent='Bucket connection cleared. Reconnect to continue.';
  if($('bucket_recipe_status'))$('bucket_recipe_status').textContent='Bucket connection cleared. Reconnect to continue.';
  renderBucketConnection();
  return true;
}
async function bucketRequest(endpoint,body,snapshot){
  if(!['connect','list','save','restore','recipes/save','recipes/list','recipes/restore'].includes(endpoint))throw Error('Unsupported bucket action');
  if(endpoint!=='connect'&&!bucketSnapshotCurrent(snapshot))throw Error('Bucket connection changed; no request was sent.');
  const current=()=>endpoint==='connect'
    ? snapshot.epoch===bucketEpoch&&bucketToken===null&&bucketId===null
    : bucketSnapshotCurrent(snapshot);
  const response=await fetch('/api/bucket/'+endpoint,{method:'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':'Bearer '+snapshot.token},body:JSON.stringify(body)});
  if(!current())throw Error('Bucket connection changed; the old response was ignored');
  if(response.status===401||response.status===403){if(endpoint!=='connect')clearBucketConnection(snapshot);window.HFAuth?.clearStorageAuthorization?.();throw Error('Bucket access expired or was denied. Authorize access again to reconnect.');}
  if(!response.ok)throw Error('Bucket action failed. Check the bucket settings and try again.');
  return response;
}
function beginBucketOperation(){bucketOperation=true;const id=++bucketOperationId;buttons();return id;}
function endBucketOperation(id){if(id!==bucketOperationId)return;bucketOperation=false;buttons();}
async function saveBucketBundleText(text,snapshot){
  if(!bucketSnapshotCurrent(snapshot))throw Error('Bucket connection changed; no save was attempted.');
  const bytes=new TextEncoder().encode(text);if(bytes.byteLength>window.PortableBundle.LIMITS.bundle)throw Error('Portable bundle exceeds 48 MiB');
  const sha256=await window.PortableBundle.sha(bytes);
  const response=await bucketRequest('save',{bucket_id:snapshot.id,bundle:text},snapshot),result=await response.json();
  if(!bucketSnapshotCurrent(snapshot))throw Error('Bucket connection changed; the old save response was ignored.');
  if(result?.status!=='saved_verified'||result.bucket_id!==snapshot.id||!bucketKeyValid(result.key)||result.bytes!==bytes.byteLength||result.sha256!==sha256)throw Error('The app could not verify the saved bundle. Refresh the list before trying again; the remote save may have completed.');
  return result;
}
if($('bucket_connect'))$('bucket_connect').onclick=async()=>{
  const id=$('bucket_id').value.trim(),token=window.HFAuth?.getStorageToken?.(),authUser=window.HFAuth?.getStorageUsername?.();
  if(!token){$('bucket_status').textContent='Authorize bucket access with HF before connecting.';return;}
  if(!id){$('bucket_status').textContent='Enter the ID of your existing private bucket.';return;}
  const epoch=++bucketEpoch,snapshot={token,id,epoch},operationId=beginBucketOperation();$('bucket_status').textContent='Checking private bucket access…';
  try{
    const response=await bucketRequest('connect',{bucket_id:id},snapshot),result=await response.json();
    if(epoch!==bucketEpoch||bucketToken!==null||bucketId!==null)return;
    if(result?.status!=='connected'||result.bucket_id!==id||result.private!==true||typeof result.username!=='string'||!result.username.trim()||result.username.length>200||result.username!==authUser)throw Error('Private bucket access could not be verified for the authorized HF account.');
    bucketToken=token;bucketId=id;bucketUsername=result.username;bucketItems=[];bucketSelectedKey=null;
    $('bucket_status').textContent='Connected. Checking saved bundles…';
    renderBucketConnection();
    try{await refreshBucketItems(snapshot,{autoRestore:true});}
    catch{$('bucket_status').textContent='Connected. Saved bundles could not be checked; refresh the list to retry.';}
  }catch(error){if(epoch===bucketEpoch){bucketToken=null;bucketId=null;bucketUsername=null;bucketItems=[];$('bucket_status').textContent=error.message||'Bucket connection failed.';renderBucketConnection();}}
  finally{if(epoch===bucketEpoch)endBucketOperation(operationId);}
};
if($('bucket_disconnect'))$('bucket_disconnect').onclick=()=>{
  if(bucketOperation)return;
  clearBucketConnection();window.HFAuth?.clearStorageAuthorization?.();$('bucket_status').textContent='Disconnected. HF bucket authorization was cleared from this page.';
};
function itemTime(item){
  if(typeof item.created_at==='string'){
    const created=item.created_at.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?Z$/);
    if(created){
      const parts=created.slice(1,7).map(Number),time=Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]),date=new Date(time);
      if(date.getUTCFullYear()===parts[0]&&date.getUTCMonth()===parts[1]-1&&date.getUTCDate()===parts[2]&&date.getUTCHours()===parts[3]&&date.getUTCMinutes()===parts[4]&&date.getUTCSeconds()===parts[5])return time+Number((created[7]||'').padEnd(6,'0')||0)/1000;
    }
  }
  const m=item.key.match(/^ald-exports\/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z-/);
  if(!m)return null;
  const parts=m.slice(1).map(Number),time=Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]),date=new Date(time);
  return date.getUTCFullYear()===parts[0]&&date.getUTCMonth()===parts[1]-1&&date.getUTCDate()===parts[2]&&date.getUTCHours()===parts[3]&&date.getUTCMinutes()===parts[4]&&date.getUTCSeconds()===parts[5]?time:null;
}
async function workspaceIsEmpty(){
  const trackInfo=trackLibrary?.info?.();
  return !busy&&!job&&!networkSource()&&!localResult&&!$('track').files.length&&trackInfo?.source!=='builtin'&&!window.hasUnsavedNetworkDraft?.();
}
async function refreshBucketItems(snapshot,{selectKey=null,autoRestore=false}={}){
  const response=await bucketRequest('list',{bucket_id:snapshot.id},snapshot),result=await response.json();
  if(!bucketSnapshotCurrent(snapshot))return;
  if(!Array.isArray(result?.items)||result.items.length>50||typeof result.truncated!=='boolean'||(result.scan_incomplete!==undefined&&typeof result.scan_incomplete!=='boolean'))throw Error('The saved bundle list was not valid.');
  const checked=result.items.map(item=>{
    if(!bucketKeyValid(item?.key)||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>window.PortableBundle.LIMITS.bundle||typeof item.label!=='string'||!item.label.trim()||item.label.length>160||!(item.created_at===undefined||item.created_at===null||(typeof item.created_at==='string'&&itemTime(item)!==null)))throw Error('The saved bundle list was not valid.');
    return {key:item.key,bytes:item.bytes,label:item.label,created_at:item.created_at??null};
  }).sort((a,b)=>(itemTime(b)??-1)-(itemTime(a)??-1));
  bucketItems=checked;bucketSelectedKey=selectKey&&checked.some(item=>item.key===selectKey)?selectKey:null;renderBucketConnection();
  if(!checked.length){$('bucket_status').textContent='No bundles saved by this app were found.'+(result.scan_incomplete?' The bounded scan was incomplete; additional bundles may exist.':'');return;}
  if(autoRestore){
    const empty=await workspaceIsEmpty();
    for(const item of checked){
      if(!bucketSnapshotCurrent(snapshot))return;
      try{
        const saved=await bucketRequest('restore',{bucket_id:snapshot.id,key:item.key},snapshot),text=await saved.text();
        if(!bucketSnapshotCurrent(snapshot))return;
        const prepared=await preparePortableText(text);
        if(!bucketSnapshotCurrent(snapshot))return;
        bucketSelectedKey=item.key;renderBucketConnection();
        if(empty&&await workspaceIsEmpty()){
          await applyPreparedPortable(prepared,{isCurrent:()=>bucketSnapshotCurrent(snapshot)});
          $('bucket_status').textContent='Selected and restored the newest compatible bundle among the listed entries in this page. No run started.';
        }else $('bucket_status').textContent='Selected the newest compatible bundle among the listed entries. Existing network, track, result or editor state was left untouched; choose Restore when ready.';
        if(result.scan_incomplete)$('bucket_status').textContent+=' The bounded scan was incomplete, so a newer bundle may exist.';
        else if(result.truncated)$('bucket_status').textContent+=' Only the 50 newest listed bundles are shown; an older compatible bundle may not be listed.';
        return;
      }catch(error){if(!bucketSnapshotCurrent(snapshot))return;}
    }
    bucketSelectedKey=null;renderBucketConnection();$('bucket_status').textContent='No compatible saved bundle was found in the listed entries.'+(result.scan_incomplete?' The bounded scan was incomplete, so additional bundles may exist.':result.truncated?' Only the 50 newest listed bundles were checked.':'');return;
  }
  const listingNote=result.scan_incomplete?' Bounded scan incomplete; a newer bundle may exist.':result.truncated?' Listing shows up to 50 bundles; additional, older bundles may not be shown.':'';
  if(selectKey&&bucketSelectedKey) $('bucket_status').textContent='Saved bundle verified and selected in the refreshed list.'+listingNote;
  else $('bucket_status').textContent=checked.length+' saved bundle'+(checked.length===1?'':'s')+' available.'+listingNote;
}
if($('bucket_refresh'))$('bucket_refresh').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),operationId=beginBucketOperation();$('bucket_status').textContent='Refreshing this app’s saved bundle list…';
  try{await refreshBucketItems(snapshot,{autoRestore:true});}
  catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_status').textContent=error.message||'Could not refresh saved bundles.';}
  finally{endBucketOperation(operationId);}
};
function bucketRecipeTime(item){
  if(typeof item.created_at==='string'){
    const m=item.created_at.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?Z$/);
    if(m){const p=m.slice(1,7).map(Number),t=Date.UTC(p[0],p[1]-1,p[2],p[3],p[4],p[5]),d=new Date(t);
      if(d.getUTCFullYear()===p[0]&&d.getUTCMonth()===p[1]-1&&d.getUTCDate()===p[2]&&d.getUTCHours()===p[3]&&d.getUTCMinutes()===p[4]&&d.getUTCSeconds()===p[5])return t+Number((m[7]||'').padEnd(6,'0')||0)/1000;}
  }
  const m=item.key.match(/^ald-recipes\/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z-/);if(!m)return null;
  const p=m.slice(1).map(Number),t=Date.UTC(p[0],p[1]-1,p[2],p[3],p[4],p[5]),d=new Date(t);
  return d.getUTCFullYear()===p[0]&&d.getUTCMonth()===p[1]-1&&d.getUTCDate()===p[2]&&d.getUTCHours()===p[3]&&d.getUTCMinutes()===p[4]&&d.getUTCSeconds()===p[5]?t:null;
}
async function refreshBucketRecipes(snapshot,{selectKey=null}={}){
  const response=await bucketRequest('recipes/list',{bucket_id:snapshot.id},snapshot),result=await response.json();
  if(!bucketSnapshotCurrent(snapshot))return;
  if(!Array.isArray(result?.items)||result.items.length>50||typeof result.truncated!=='boolean'||typeof result.scan_incomplete!=='boolean')throw Error('The saved recipe library list was not valid.');
  const checked=result.items.map(item=>{
    if(!bucketRecipeKeyValid(item?.key)||!Number.isSafeInteger(item.bytes)||item.bytes<2||item.bytes>32768||typeof item.label!=='string'||!item.label.trim()||item.label.length>160||!(item.created_at===undefined||item.created_at===null||(typeof item.created_at==='string'&&bucketRecipeTime(item)!==null)))throw Error('The saved recipe library list was not valid.');
    return {key:item.key,bytes:item.bytes,label:item.label,created_at:item.created_at??null};
  }).sort((a,b)=>(bucketRecipeTime(b)??-1)-(bucketRecipeTime(a)??-1));
  bucketRecipeItems=checked;
  bucketRecipeSelectedKey=selectKey&&checked.some(item=>item.key===selectKey)?selectKey:(checked[0]?.key??null);
  renderBucketConnection();
  const caveat=result.scan_incomplete?' The bounded scan was incomplete, so a newer saved library may exist.':result.truncated?' Showing up to 50 newest listed libraries; additional libraries may exist.':'';
  if($('bucket_recipe_status'))$('bucket_recipe_status').textContent=selectKey&&!bucketRecipeSelectedKey
    ?'Recipe library was saved and read back but is not in the returned list. Use Refresh saved recipe libraries.'+caveat
    :checked.length
      ?(selectKey?'Recipe library saved, read back and selected.':'Saved recipe libraries refreshed; the newest listed library is selected.')+caveat
      :'No saved recipe libraries were found.'+(result.scan_incomplete?' The bounded scan was incomplete; additional libraries may exist.':'');
}
if($('bucket_recipe_refresh'))$('bucket_recipe_refresh').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),operationId=beginBucketOperation();$('bucket_recipe_status').textContent='Refreshing saved recipe libraries…';
  try{await refreshBucketRecipes(snapshot);}
  catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_recipe_status').textContent=error.message||'Could not refresh saved recipe libraries.';}
  finally{endBucketOperation(operationId);}
};
if($('bucket_recipe_items'))$('bucket_recipe_items').addEventListener('change',()=>{bucketRecipeSelectedKey=$('bucket_recipe_items').value||null;buttons();});
if($('bucket_recipe_save'))$('bucket_recipe_save').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),operationId=beginBucketOperation();let readbackVerified=false;$('bucket_recipe_status').textContent='Saving and verifying the validated recipe library…';
  try{
    const text=window.recipeLibraryText?.();if(typeof text!=='string')throw Error('The local recipe library is unavailable.');
    window.RecipeLibrary?.parse(text);
    const bytes=new TextEncoder().encode(text);if(bytes.byteLength>32768)throw Error('Recipe library exceeds 32 KB');
    const sha256=await window.PortableBundle.sha(bytes);
    const response=await bucketRequest('recipes/save',{bucket_id:snapshot.id,library:text},snapshot),result=await response.json();
    if(!bucketSnapshotCurrent(snapshot))return;
    if(result?.status!=='saved_verified'||result.bucket_id!==snapshot.id||!bucketRecipeKeyValid(result.key)||result.bytes!==bytes.byteLength||result.sha256!==sha256)throw Error('Recipe library save could not be verified; the remote save may have completed.');
    const readback=await bucketRequest('recipes/restore',{bucket_id:snapshot.id,key:result.key},snapshot),restoredText=await readback.text();
    if(!bucketSnapshotCurrent(snapshot))return;
    const restoredBytes=new TextEncoder().encode(restoredText);
    if(restoredBytes.byteLength!==bytes.byteLength||await window.PortableBundle.sha(restoredBytes)!==sha256||restoredText!==text)throw Error('Recipe library readback did not match the saved bytes.');
    window.RecipeLibrary.parse(restoredText);
    readbackVerified=true;
    try{await refreshBucketRecipes(snapshot,{selectKey:result.key});}
    catch{$('bucket_recipe_status').textContent='Recipe library was saved and read back successfully, but the saved list could not refresh. Use Refresh saved recipe libraries.';}
  }catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_recipe_status').textContent=readbackVerified?'Recipe library was saved and read back successfully. The saved list could not refresh; use Refresh saved recipe libraries.':(error.message||'Recipe library save failed; the local library was unchanged.');}
  finally{endBucketOperation(operationId);}
};
if($('bucket_recipe_import'))$('bucket_recipe_import').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),key=$('bucket_recipe_items').value;
  if(!bucketRecipeKeyValid(key)||!bucketRecipeItems.some(item=>item.key===key)){$('bucket_recipe_status').textContent='Choose a listed recipe library to import.';return;}
  const operationId=beginBucketOperation();$('bucket_recipe_status').textContent='Downloading and validating the selected recipe library…';
  try{
    const response=await bucketRequest('recipes/restore',{bucket_id:snapshot.id,key},snapshot),text=await response.text();
    if(!bucketSnapshotCurrent(snapshot))return;
    if(new TextEncoder().encode(text).byteLength>32768)throw Error('Recipe library exceeds 32 KB');
    const book=window.RecipeLibrary?.parse(text);if(!book)throw Error('Recipe library validation is unavailable.');
    if(typeof window.importRecipeLibraryText!=='function')throw Error('Recipe library import is unavailable.');
    const imported=await window.importRecipeLibraryText(text,{source:'private bucket',isCurrent:()=>bucketSnapshotCurrent(snapshot)});
    if(!bucketSnapshotCurrent(snapshot))return;
    $('bucket_recipe_status').textContent=imported?'Recipe library imported locally after confirmation. No run was started.':'Import canceled. The local recipe library was unchanged.';
  }catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_recipe_status').textContent='Recipe library not imported: '+(error.message||'validation failed')+'. The existing local library was left unchanged.';}
  finally{endBucketOperation(operationId);}
};
if($('bucket_items'))$('bucket_items').addEventListener('change',()=>{bucketSelectedKey=$('bucket_items').value||null;buttons();});
if($('bucket_autosave'))$('bucket_autosave').addEventListener('change',()=>{
  if($('bucket_autosave').checked&&$('keepServer').checked){$('keepServer').checked=false;$('bucket_status').textContent='Automatic bucket saving requires deletion after a verified download; the repeat-download option was turned off.';}
  buttons();
});
if($('bucket_save'))$('bucket_save').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),operationId=beginBucketOperation();$('bucket_status').textContent='Building and verifying the selected bundle…';
  try{
    const useLatestResult=!!(localResult&&runReceipt&&runResultContext&&!networkSource()&&!$('track').files.length&&(()=>{const current=trackLibrary?.info?.()??{source:'upload'},prior=runResultContext.trackInfo??{source:'upload'};return current.source===prior.source&&(current.source!=='builtin'||current.id===prior.id);})());
    const {text}=useLatestResult?await buildRunResultBundle(localResult,runReceipt,runResultContext):await buildPortableBundle();
    const result=await saveBucketBundleText(text,snapshot);
    $('bucket_status').textContent='Bundle saved and read back successfully. Your current result remains available for download.';
    await refreshBucketItems(snapshot,{selectKey:result.key,preflight:false});
  }catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_status').textContent=error.message||'Bundle save failed. Your current result remains available for download.';}
  finally{endBucketOperation(operationId);}
};
if($('bucket_restore'))$('bucket_restore').onclick=async()=>{
  if(!bucketToken)return;
  const snapshot=bucketSnapshot(),key=$('bucket_items').value;
  if(!bucketKeyValid(key)||!bucketItems.some(item=>item.key===key)){ $('bucket_status').textContent='Choose a listed saved bundle to restore.';return; }
  const operationId=beginBucketOperation(),restoreId=++bundleRestoreId;bundleRestoring=true;buttons();$('bucket_status').textContent='Downloading and validating the selected bundle…';
  try{
    const response=await bucketRequest('restore',{bucket_id:snapshot.id,key},snapshot);
    const text=await response.text();
    if(!bucketSnapshotCurrent(snapshot))return;
    if(new TextEncoder().encode(text).byteLength>window.PortableBundle.LIMITS.bundle)throw Error('Portable bundle exceeds 48 MiB');
    await restorePortableText(text,{lockHeld:true,isCurrent:()=>bucketSnapshotCurrent(snapshot)});
    if(bucketSnapshotCurrent(snapshot))$('bucket_status').textContent='Bundle restored in this page only. No run started and the existing result remains available.';
  }catch(error){if(bucketSnapshotCurrent(snapshot))$('bucket_status').textContent='Bundle not restored: '+(error.message||'validation failed')+'. Existing selections and results were left unchanged.';}
  finally{if(restoreId===bundleRestoreId)bundleRestoring=false;endBucketOperation(operationId);}
};
$('backend').addEventListener('change',buttons);
$('leaderboard_opt_in')?.addEventListener('change',()=>{
  if(!$('leaderboard_opt_in').checked&&leaderboardRequest){
    cancelSteamLeaderboard();
    $('leaderboard_status').textContent='Steam check stopped. The completed run is unaffected.';
  }
});
const feedbackLink=$('feedbackLink');
feedbackLink?.addEventListener('click',()=>{
  const url=new URL('https://github.com/seeker-cyber-maker/driving_sim_rs/issues/new');
  const browser=navigator.userAgent||'Not reported';
  const body=['Build: '+(appBuild?.build_id??'Not reported'),'Browser and OS: '+browser,'Selected backend: '+$('backend').value.toUpperCase(),'','What happened?'].join('\n');
  url.searchParams.set('title','ALD beta problem report');url.searchParams.set('body',body);
  feedbackLink.href=url.href;
});
function saveLocal() {
  if(!localResult)return;
  const link=document.createElement('a'),url=URL.createObjectURL(localResult);
  link.href=url;link.download='candidate.evolution';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$('saveLocal').onclick=saveLocal;
$('forgetLocal').onclick=()=>{invalidateReplay();localResult=null;localAnalysis=null;pairedAnalysisPending=false;renderAnalysisPanel();buttons();say('Browser result discarded. Downloaded files are unaffected.');};
async function request(path, options = {}) {
  const response = await fetch(path, {...options, cache:'no-store', credentials:'same-origin'});
  if (!response.ok) {
    let detail;try{detail=(await response.json()).detail;}catch{}
    throw new Error(response.status===404?'Result unavailable or expired.':typeof detail==='string'?detail:'Request failed ('+response.status+').');
  }
  return response;
}
async function encoded(file) {
  if (!file || file.size > 1048576) throw new Error('Choose both files, no more than 1 MB each.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text=''; for (let i=0;i<bytes.length;i+=8192) text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
const headers = () => ({'X-Job-Key':job.key});
const networkSource=()=>stagedNetwork || $('network').files[0];
function replayNetworkSource(){return networkSource()||localResult;}
function invalidateReplay(reason){
  replayRequestId++;
  localReplay=null;localReplayName=null;localReplayDriver=null;
  renderRecordingIdentity();
  window.TrackReplay?.clearRecording?.(reason);
  if($('replay_download'))$('replay_download').disabled=true;
}
window.addEventListener('ald:batch-draft-change',buttons);
document.addEventListener('track-library-change',buttons);
document.addEventListener('track-library-change',()=>invalidateReplay('Track changed. Record a new drive for this track.'));
if($('replay_record'))$('replay_record').onclick=async()=>{
  if(busy||replayBusy||job||batchActive||bundleRestoring||bucketOperation)return;
  replayBusy=true;busy=true;
  invalidateReplay('Recording a fresh CPU drive…');
  const attempt=replayRequestId;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),40000);
  buttons();
  try{
    const track=await trackSource(),network=replayNetworkSource();
    if(!track||!network)throw Error('Choose a track and a network before recording.');
    const ticks=Number($('replay_duration').value);
    if(![300,900].includes(ticks))throw Error('Choose a 5-second or 15-second recording.');
    const [trackBytes,networkBytes]=await Promise.all([track.arrayBuffer(),network.arrayBuffer()]);
    await validateNetworkBytes(new Uint8Array(networkBytes));
    const [trackSha,networkSha,track64,network64]=await Promise.all([
      sha(trackBytes),sha(networkBytes),encoded(track),encoded(network)
    ]);
    const response=await request('/api/replay',{method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json'},body:JSON.stringify({track:track64,network:network64,ticks})});
    const raw=await response.text();
    if(raw.length>2*1024*1024)throw Error('Recording exceeds the browser limit.');
    const recording=JSON.parse(raw);
    const currentTrack=await trackSource(),currentNetwork=replayNetworkSource();
    if(attempt!==replayRequestId||!currentTrack||!currentNetwork)throw Error('Selection changed during recording. Record the current selection again.');
    const [currentTrackSha,currentNetworkSha]=await Promise.all([
      currentTrack.arrayBuffer().then(sha),currentNetwork.arrayBuffer().then(sha)
    ]);
    if(currentTrackSha!==trackSha||currentNetworkSha!==networkSha)throw Error('Selection changed during recording. Record the current selection again.');
    if(!window.TrackReplay?.setRecording)throw Error('The recorded-drive viewer is unavailable. Reload this page.');
    await window.TrackReplay.setRecording(recording,trackSha,networkSha);
    if(attempt!==replayRequestId){window.TrackReplay.clearRecording();throw Error('Selection changed during recording. Record the current selection again.');}
    localReplay=recording;localReplayName='ald-recorded-drive.json';localReplayDriver=selectedReplayDriverLabel();renderRecordingIdentity();openReplayWorkspace();
  }catch(error){
    if(attempt===replayRequestId&&$('replay_status'))$('replay_status').textContent=
      error?.name==='AbortError'?'Recording timed out. Try a 5-second drive.':'Recording unavailable: '+error.message;
  }finally{
    clearTimeout(timeout);replayBusy=false;busy=false;buttons();
  }
};
if($('replay_focus'))$('replay_focus').onclick=()=>{const focused=$('drive').classList.toggle('replay-focused');$('replay_focus').textContent=focused?'Return to run setup':'Expand replay workspace';$('replay_focus').setAttribute('aria-pressed',String(focused));};
// Returning from the black box keeps the map in view as well as keyboard focus on playback.
document.querySelectorAll('a[href="#replay_transport"]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  const viewer=$('trackMap').closest('.replay-viewer');
  viewer.scrollIntoView({block:'start'});
  $('replay_transport').focus({preventScroll:true});
}));
if($('replay_import'))$('replay_import').onchange=async()=>{
  const file=$('replay_import').files[0];$('replay_import').value='';
  if(!file||busy||job||batchActive||bucketOperation||bundleRestoring)return;
  busy=true;replayBusy=true;invalidateReplay('Opening recorded drive…');const attempt=replayRequestId;buttons();
  try{
    if(file.size<1||file.size>2*1024*1024)throw Error('Choose a recording under 2 MiB.');
    const track=await trackSource(),network=replayNetworkSource();if(!track||!network)throw Error('Select the matching track and policy first.');
    const [trackSha,networkSha]=await Promise.all([track.arrayBuffer().then(sha),network.arrayBuffer().then(sha)]);
    const recording=JSON.parse(await file.text());
    if(attempt!==replayRequestId)throw Error('Selection changed while opening recording.');
    window.TrackReplay.setRecording(recording,trackSha,networkSha);localReplay=recording;localReplayName=file.name;localReplayDriver=selectedReplayDriverLabel();renderRecordingIdentity();openReplayWorkspace();
  }catch(error){if(attempt===replayRequestId)window.TrackReplay?.clearRecording?.('Recording unavailable: '+error.message);}
  finally{busy=false;replayBusy=false;buttons();}
};
if($('replay_download'))$('replay_download').onclick=()=>{
  if(localReplay)downloadTextFile(JSON.stringify(localReplay),'ald-recorded-drive.json','application/json');
};
async function refreshFreezeNetwork(file){
  invalidateReplay('Network changed. Record a new drive for this policy.');
  if(!file){window.setFreezeNetwork?.(null);window.TrackReplay?.setStagedNetwork?.(null);return;}
  try{const network=await validateNetworkBytes(new Uint8Array(await file.arrayBuffer()));if(networkSource()===file){window.setFreezeNetwork?.(network);window.TrackReplay?.setStagedNetwork?.(network);}}
  catch(error){if(networkSource()===file){window.setFreezeNetwork?.(null);window.TrackReplay?.setStagedNetwork?.(null);if($('freeze_status'))$('freeze_status').textContent='Network metadata unavailable: '+error.message;}}
}
$('network').onchange=()=>{stagedNetwork=null;selectedWinner=null;if($('networkChoice'))$('networkChoice').textContent='Uploaded file selected.';refreshFreezeNetwork(networkSource());buttons();};
window.TrainingClient={
  getSelectedNetwork:()=>replayNetworkSource(),
  createStarter:()=>$('starter_create').onclick(),
  isBusy:()=>busy||replayBusy||!!job||bundleRestoring,
  hasUnsavedState:()=>!!(networkSource()||localResult||$('track').files.length||trackLibrary?.info?.()?.source==='builtin'||$('editor_file')?.files.length||window.hasUnsavedNetworkDraft?.()),
  useNetwork(file){
    if(busy||replayBusy||job)throw Error('Finish the current operation before changing the network');
    stagedNetwork=file;$('network').value='';
    if($('networkChoice'))$('networkChoice').textContent='Browser editor input: '+file.name+'. Not uploaded yet.';
    refreshFreezeNetwork(file);
    buttons();
  }
};
async function checkSteamLeaderboard(trackInfo,report){
  const status=$('leaderboard_status'),optIn=$('leaderboard_opt_in');
  if(!optIn?.checked)return;
  const lap=report?.best_lap_seconds;
  const vehicleType=report?.vehicle_type;
  if(typeof lap!=='number'||!Number.isFinite(lap)||lap<=0){status.textContent='Steam check not run: no completed best lap was reported.';return;}
  if(!Number.isInteger(vehicleType)||vehicleType<0||vehicleType>3){status.textContent='Steam check not run: the completed report did not identify a supported vehicle.';return;}
  if(trackInfo?.source!=='builtin'||typeof trackInfo.id!=='string'||typeof trackInfo.sha256!=='string'){
    status.textContent='Steam check unavailable for custom or unidentified tracks. Your run result is unaffected.';return;
  }
  cancelSteamLeaderboard();
  const generation=leaderboardGeneration,controller=new AbortController();
  leaderboardRequest=controller;
  status.textContent='Checking the public Steam board in the background…';
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch('/api/leaderboard/compare',{method:'POST',cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({track_id:trackInfo.id,track_sha256:trackInfo.sha256,vehicle_type:vehicleType,lap_seconds:lap})});
    const result=await response.json();
    if(generation!==leaderboardGeneration)return;
    if(!response.ok)throw Error('Steam check unavailable');
    if(result.status==='ok'){
      const rank=result.estimated_position?.label||'position unavailable';
      status.textContent='Estimated '+rank+' of '+result.entries+' entries on '+result.board.track_label+' (snapshot '+result.fetched_at_utc+'). '+result.message;
    }else status.textContent=result.message||'Steam check unavailable. Your run result is unaffected.';
  }catch(error){
    if(generation!==leaderboardGeneration)return;
    status.textContent=error?.name==='AbortError'?'Steam check timed out; the completed result is ready to download.':'Steam check unavailable; the completed result is ready to download.';
  }finally{clearTimeout(timer);if(generation===leaderboardGeneration)leaderboardRequest=null;}
}
function cancelSteamLeaderboard(){
  leaderboardGeneration++;
  const active=leaderboardRequest;leaderboardRequest=null;
  active?.abort();
}
async function submit(body){
  if(body.backend==='gpu' && gpuTransport==='gradio-ticket'){
    await verifyGpuIdentity();
    const prepared=await (await request('/api/gpu/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
    try {
      const result=await gradioClient.predict('/gpu_train',[prepared.ticket]);
      return result.data[0];
    } catch(error) {
      let cleanup='Pending inputs expire within two minutes. A connection error does not confirm whether training started.';
      try {
        const response=await request('/api/gpu/prepare/'+encodeURIComponent(prepared.ticket),{method:'DELETE'});
        cleanup=(await response.json()).deleted===true
          ? 'Pending inputs were deleted before dispatch.'
          : 'No pending inputs remain. This does not confirm that a dispatched run stopped.';
      } catch {}
      throw Error(displayError(error)+' '+cleanup);
    }
  }
  return (await request('/api/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
}
async function verifyGpuIdentity(){
  const credentials=window.HFAuth?.credentials()??{};
  if(!gradioClient){
    const {Client}=await import('/gradio-client.js');
    gradioClient=await Client.connect(location.origin,credentials);
  }
  const result=await gradioClient.predict('/visitor_identity',[]);
  window.HFAuth?.verify(result.data[0]);
  return result.data[0];
}
window.addEventListener('hf-auth-change',()=>{
  const previous=gradioClient;gradioClient=null;
  if(previous)Promise.resolve(previous.close()).catch(()=>{});
  if(bucketToken||bucketId)clearBucketConnection();
  renderBucketConnection();
});
window.TrainingClient.verifyIdentity=async()=>{
  if(busy||job)throw Error('Finish the current result before checking identity');
  busy=true;buttons();
  try{return await verifyGpuIdentity();}
  finally{busy=false;buttons();}
};
async function receive(current){
  const response=await request('/api/jobs/'+current.id+'/download',{method:'POST',headers:{'X-Job-Key':current.key}});
  const bytes=await response.arrayBuffer();
  const digest=await sha(bytes);
  if(bytes.byteLength!==current.size || digest!==current.sha256)throw Error('Result validation failed; no deletion acknowledgment sent. Use Delete now or await expiry.');
  const receipt=response.headers.get('x-delivery-receipt');if(typeof receipt!=='string'||!receipt)throw Error('Primary delivery receipt is missing; no deletion acknowledgment sent.');
  if(current.analysis===undefined||current.analysis===null)return {bytes,receipt,analysisBytes:null,analysisReceipt:null,analysis:null};
  const verifiedPrimary={bytes,receipt,digest};
  try{
    const descriptor=current.analysis;
    if(!descriptor||!Number.isInteger(descriptor.size)||descriptor.size<1||descriptor.size>ANALYSIS_ARCHIVE_MAX||!hex64(descriptor.sha256))throw Error('Analysis archive metadata is invalid; no deletion acknowledgment sent.');
    const analysisResponse=await request('/api/jobs/'+current.id+'/analysis/download',{method:'POST',headers:{'X-Job-Key':current.key}}),analysisBytes=await analysisResponse.arrayBuffer();
    if(analysisBytes.byteLength!==descriptor.size||await sha(analysisBytes)!==descriptor.sha256)throw Error('Analysis archive validation failed; no deletion acknowledgment sent.');
    const analysisReceipt=analysisResponse.headers.get('x-analysis-delivery-receipt');if(typeof analysisReceipt!=='string'||!analysisReceipt)throw Error('Analysis delivery receipt is missing; no deletion acknowledgment sent.');
    const parsed=await parseRunAnalysisArchive(new Uint8Array(analysisBytes),descriptor,current.report?.analysis_summary);
    try{validatePrimaryAnalysisMatch(digest,parsed);}catch(error){throw Error(error.message+'; no deletion acknowledgment sent.');}
    if(comparisonPlan){const expected=comparisonPlan.conditions,actual=parsed.summary.conditions;
      for(const key of ['track_sha256','vehicle_type','requested_ticks','control_hz','collision','idle','math_profile','clean_min_laps'])if(actual[key]!==expected[key])throw Error('Frozen comparison conditions changed at '+key+'; this result was not added to the comparison');
      if(parsed.mode!=='evaluate'||parsed.summary.execution_backend!==(comparisonPlan.backend==='gpu'?'cuda':'cpu'))throw Error('Frozen comparison result does not match the requested mode or backend');
      const buildId=current.report?.build?.build_id??current.report?.build_id;
      if(comparisonPlan.build_id&&buildId!==comparisonPlan.build_id)throw Error('Frozen comparison engine build changed; this result was not added');
      const role=comparisonPlan.roles[comparisonPlan.index],expectedNetwork=comparisonPlan.winnerNetworks?.[role]?.sha256;
      if(expectedNetwork&&parsed.summary.conditions.network_sha256!==expectedNetwork)throw Error('Frozen evaluation used a different policy than the selected comparison candidate');
    }
    return {bytes,receipt,analysisBytes,analysisReceipt,analysis:parsed};
  }catch(error){if(error&&typeof error==='object')error.verifiedPrimary=verifiedPrimary;throw error;}
}
function retainVerifiedPrimary(error){
  if(!error?.verifiedPrimary)return false;
  localResult=new Blob([error.verifiedPrimary.bytes]);localAnalysis=null;pairedAnalysisPending=true;
  renderAnalysisPanel();buttons();
  return true;
}
async function acknowledge(current,received){
  const body={receipt:received.receipt};if(received.analysisReceipt)body.analysis_receipt=received.analysisReceipt;
  const acknowledgment=await (await request('/api/jobs/'+current.id+'/ack',{method:'POST',headers:{'X-Job-Key':current.key,'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
  serverCopyStatus=acknowledgment.deleted===true?'deleted after verified receipt.':'retained for repeat download until its five-minute deadline. Use Delete server-side job data now to remove it sooner.';
  return acknowledgment;
}
async function sha(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
const ANALYSIS_ARCHIVE_MAX=32*1024*1024,ANALYSIS_EXPANDED_MAX=256*1024*1024,ANALYSIS_ROWS_MAX=128000;
const STAR_CHECK_MAX=512*1024;
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function exactAnalysisKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...keys].sort().join())throw Error('Analysis archive contains unexpected fields');}
function stableJson(value){if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';return JSON.stringify(value);}
function finiteOrNull(value,min=-1e12,max=1e12){return value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max);}
function b64Bytes(text,limit){
  if(typeof text!=='string'||text.length>Math.ceil(limit/3)*4+8)throw Error('Analysis file exceeds its size limit');
  let binary;try{binary=atob(text);}catch{throw Error('Analysis archive contains invalid base64');}
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  if(bytes.byteLength>limit||btoa(binary)!==text)throw Error('Analysis archive contains noncanonical or oversized bytes');
  return bytes;
}
async function expandAnalysisGzip(bytes){
  if(typeof DecompressionStream!=='function')throw Error('This browser cannot expand the verified analysis archive');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let total=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>ANALYSIS_EXPANDED_MAX)throw Error('Expanded analysis exceeds 256 MiB');parts.push(value);}}
  finally{reader.releaseLock();}
  const out=new Uint8Array(total);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.byteLength;}return out;
}
function validateAnalysisSummary(summary){
  exactAnalysisKeys(summary,['schema','version','mode','execution_backend','conditions','observations','winners','semantics']);
  if(summary.schema!=='ald.run-analysis'||summary.version!==1||!['train','evaluate'].includes(summary.mode)||!['cpu','cuda'].includes(summary.execution_backend))throw Error('Analysis summary identity is invalid');
  const c=summary.conditions;exactAnalysisKeys(c,['track_sha256','network_sha256','vehicle_type','requested_ticks','control_hz','collision','idle','math_profile','clean_min_laps']);
  if(!hex64(c.track_sha256)||!hex64(c.network_sha256)||!Number.isInteger(c.vehicle_type)||c.vehicle_type<0||c.vehicle_type>3||!Number.isInteger(c.requested_ticks)||c.requested_ticks<1||c.requested_ticks>18000||![15,30,60].includes(c.control_hz)||typeof c.collision!=='boolean'||typeof c.idle!=='boolean'||c.math_profile!=='proton'||!Number.isInteger(c.clean_min_laps)||c.clean_min_laps<1||c.clean_min_laps>100)throw Error('Analysis conditions are invalid');
  const o=summary.observations;exactAnalysisKeys(o,['generations','cars','raw_metric_count','reward_channel_count']);
  if(!Number.isInteger(o.generations)||o.generations<1||o.generations>2000||!Number.isInteger(o.cars)||o.cars<1||o.cars>ANALYSIS_ROWS_MAX||o.raw_metric_count!==14||o.reward_channel_count!==18)throw Error('Analysis observation counts are invalid');
  exactAnalysisKeys(summary.winners,['fitness','fastest_lap','clean_laps']);
  for(const role of ['fitness','fastest_lap','clean_laps']){
    const w=summary.winners[role];exactAnalysisKeys(w,['status','reason','candidate_id','generation','car','selection_fitness','best_lap_seconds','forward_laps','physical_contacts','collision_updates','total_actual_distance','artifact']);
    if(!['available','unavailable'].includes(w.status))throw Error('Winner status is invalid');
    if(w.status==='unavailable'){
      if(typeof w.reason!=='string'||!w.reason||w.reason.length>300||w.candidate_id!==null||w.artifact!==null)throw Error('Unavailable winner details are invalid');
    }else{
      if(w.reason!==null||typeof w.candidate_id!=='string'||!/^g\d{6}-c\d{6}$/.test(w.candidate_id)||!Number.isInteger(w.generation)||w.generation<1||w.generation>o.generations||!Number.isInteger(w.car)||w.car<0||w.car>=1024||!finiteOrNull(w.selection_fitness)||!finiteOrNull(w.best_lap_seconds,Number.MIN_VALUE,1e12)||!Number.isInteger(w.forward_laps)||w.forward_laps<0||!Number.isInteger(w.physical_contacts)||w.physical_contacts<0||!Number.isInteger(w.collision_updates)||w.collision_updates<0||!finiteOrNull(w.total_actual_distance,0,1e12))throw Error('Available winner details are invalid');
      exactAnalysisKeys(w.artifact,['name','bytes','sha256']);if(w.artifact.name!=='winners/'+role+'.evolution'||!Number.isInteger(w.artifact.bytes)||w.artifact.bytes<1||w.artifact.bytes>4*1024*1024||!hex64(w.artifact.sha256))throw Error('Winner artifact reference is invalid');
    }
  }
  if(typeof summary.semantics!=='object'||Array.isArray(summary.semantics))throw Error('Analysis semantics are invalid');
  exactAnalysisKeys(summary.semantics,['fitness','fastest_lap','clean_laps','channels','collision_count','training','evaluation']);
  if(Object.values(summary.semantics).some(x=>typeof x!=='string'||x.length>1000))throw Error('Analysis semantics are invalid');
  if(summary.mode==='evaluate'&&Object.values(summary.winners).some(w=>w.status!=='unavailable'||w.reason!=='frozen_evaluation_does_not_select_winners'))throw Error('Frozen evaluation must not select winners');
  return summary;
}
function validateDescriptorRow(row,metricNames,rewardChannels){
  exactAnalysisKeys(row,['schema','generation','car','candidate_id','ticks_elapsed','stats_update_count','raw_metrics','channels','selection_fitness','objectives','weights_sha256']);
  if(row.schema!==1||!Number.isInteger(row.generation)||row.generation<1||row.generation>2000||!Number.isInteger(row.car)||row.car<0||row.car>=1024||row.candidate_id!=='g'+String(row.generation).padStart(6,'0')+'-c'+String(row.car).padStart(6,'0')||!Number.isInteger(row.ticks_elapsed)||row.ticks_elapsed<0||row.ticks_elapsed>18012||!Number.isInteger(row.stats_update_count)||row.stats_update_count<0||row.stats_update_count>18012||!finiteOrNull(row.selection_fitness)||!hex64(row.weights_sha256))throw Error('Analysis descriptor identity is invalid');
  exactAnalysisKeys(row.raw_metrics,metricNames);if(Object.values(row.raw_metrics).some(value=>!finiteOrNull(value)))throw Error('Analysis raw metric is invalid');
  exactAnalysisKeys(row.channels,['values','population_relative','unavailable_reasons']);
  if(!Array.isArray(row.channels.values)||row.channels.values.length!==18||!Array.isArray(row.channels.population_relative)||row.channels.population_relative.length!==18||!Array.isArray(row.channels.unavailable_reasons)||row.channels.unavailable_reasons.length!==18)throw Error('Analysis reward channels are incomplete');
  row.channels.values.forEach((value,index)=>{const rank=row.channels.population_relative[index],reason=row.channels.unavailable_reasons[index];if(!finiteOrNull(value)||!finiteOrNull(rank,0,1)||!(reason===null||['no_completed_lap','no_statistics_updates','not_observed'].includes(reason))||(value===null&&(reason===null||rank!==null))||(value!==null&&reason!==null))throw Error('Analysis reward descriptor is invalid');});
  const obj=row.objectives;exactAnalysisKeys(obj,['best_lap_seconds','forward_laps','physical_contacts','collision_updates','total_actual_distance','active']);
  if(!finiteOrNull(obj.best_lap_seconds,Number.MIN_VALUE,1e12)||!Number.isInteger(obj.forward_laps)||obj.forward_laps<0||!Number.isInteger(obj.physical_contacts)||obj.physical_contacts<0||!Number.isInteger(obj.collision_updates)||obj.collision_updates<0||!finiteOrNull(obj.total_actual_distance,0,1e12)||typeof obj.active!=='boolean')throw Error('Analysis objective descriptor is invalid');
  return row;
}
function selectedWinnerRoles(){return [...document.querySelectorAll('[data-compare-role]:checked')].map(node=>node.dataset.compareRole).filter(role=>localAnalysis?.winnerNetworks?.[role]);}
function uniqueWinnerRoles(roles,winnerNetworks){const seen=new Set();return roles.filter(role=>{const item=winnerNetworks?.[role];if(!item)return false;const identity=item.candidate_id||item.sha256;if(seen.has(identity))return false;seen.add(identity);return true;});}
function conditionIdentity(summary,backend,buildId){const c=summary.conditions;return JSON.stringify({track_sha256:c.track_sha256,vehicle_type:c.vehicle_type,requested_ticks:c.requested_ticks,control_hz:c.control_hz,collision:c.collision,idle:c.idle,math_profile:c.math_profile,clean_min_laps:c.clean_min_laps,backend,build_id:buildId});}
function validateComparisonRequest(plan,actual){
  const expected=plan?.conditions,role=plan?.roles?.[plan.index],winner=plan?.winnerNetworks?.[role];
  if(!expected||!winner||actual.mode!=='evaluate'||winner.sha256!==actual.network_sha256||
     actual.track_sha256!==expected.track_sha256||actual.vehicle_type!==expected.vehicle_type||
     actual.requested_ticks!==expected.requested_ticks||actual.control_hz!==expected.control_hz||
     actual.collision!==expected.collision||actual.idle!==expected.idle||actual.clean_min_laps!==expected.clean_min_laps||
     actual.backend!==plan.backend||(plan.build_id&&actual.build_id&&actual.build_id!==plan.build_id))
    throw Error('The frozen comparison conditions or selected policy changed. The comparison was stopped before sending this run. Start a new comparison after restoring the matching settings.');
  return true;
}
function renderStarCheck(){
  const panel=$('starCheckPanel');if(!panel)return;
  const status=$('starCheckStatus'),details=$('starCheckDetails'),rows=$('starCheckRows');rows.replaceChildren();
  panel.hidden=!(localResult||localAnalysis);
  if(!localResult&&!localAnalysis){status.textContent='';details.hidden=true;return;}
  if(pairedAnalysisPending){status.textContent='Challenge check is pending until the result and its analysis are fully verified.';details.hidden=true;return;}
  const check=localAnalysis?.starCheck;
  if(!check){status.textContent='No challenge check was included in this result archive. Older results may not contain one.';details.hidden=true;return;}
  details.hidden=false;
  const summary=localAnalysis.summary,policyHash=check.network_sha256;
  const policy=summary.mode==='evaluate'?'Frozen evaluation input':`Final fitness leader from this run${summary.winners?.fitness?.candidate_id?' · '+summary.winners.fitness.candidate_id:''}`;
  $('starCheckPolicy').textContent=policy+' · '+policyHash.slice(0,12);
  $('starCheckPolicy').title=policyHash;
  status.textContent=check.status==='complete'?'Challenge check completed for the policy named below. It does not award or accumulate game stars.':check.status==='unavailable'?'Challenge check was unavailable for the policy named below.':'No star challenges are defined for this selected replica track.';
  $('starCheckBasis').textContent=check.basis;
  const vehicle=['Formula','Rally','Snowmobile','Truck'][check.vehicle_type]??'Unknown vehicle';
  $('starCheckConditions').textContent=vehicle+' · '+(check.execution_backend==='cuda'?'CUDA':'CPU')+' · horizon '+check.horizon_seconds.toFixed(2)+' s · collision elimination '+(check.collision_elimination?'on':'off');
  const resultLabels={met:'Met',not_met:'Not met',not_checked:'Not checked'};
  for(const challenge of check.challenges){
    const tr=document.createElement('tr'),name=document.createElement('td'),result=document.createElement('td'),reason=document.createElement('td'),time=document.createElement('td');
    name.textContent=challenge.text||challenge.id;name.title=challenge.id+' · '+challenge.type;
    result.textContent=resultLabels[challenge.status];reason.textContent=challenge.reason??'No additional reason reported.';
    time.textContent=challenge.completion_seconds===null?'Not recorded':challenge.completion_seconds.toFixed(3)+' s';
    tr.append(name,result,reason,time);rows.append(tr);
  }
}
function renderAnalysisPanel(){
  const panel=$('analysisPanel');if(!panel)return;
  renderStarCheck();
  window.TrackReplay?.setRunAnalysis?.(localAnalysis,runReceipt||portableReceipt);
  panel.hidden=!localAnalysis;
  if(!localAnalysis){$('winnerTools').hidden=true;$('evaluationTools').hidden=true;$('winnerRows').replaceChildren();$('winner_continue').replaceChildren();$('evaluationRows').replaceChildren();return;}
  const {summary}=localAnalysis,train=summary.mode==='train';
  $('winnerTools').hidden=!train;$('evaluationTools').hidden=train;
  $('analysisStatus').textContent=train?'Per evaluated car and distinct winner policies from this completed training run. Fitness is only meaningful within its evaluated generation.':'One unchanged policy was measured in a fresh car. No winner was selected.';
  const tbody=$('winnerRows');tbody.replaceChildren();
  const select=$('winner_continue');select.replaceChildren();
  const primary=document.createElement('option');primary.value='';primary.textContent='Primary fitness result';select.append(primary);
  const roles=[['fitness','Final fitness leader'],['fastest_lap','Fastest completed lap'],['clean_laps','Clean laps']];
  for(const [role,label] of roles){const w=summary.winners[role],tr=document.createElement('tr');
    const checkCell=document.createElement('td');if(w.status==='available'){const check=document.createElement('input');check.type='checkbox';check.dataset.compareRole=role;check.setAttribute('aria-label','Compare '+label);check.addEventListener('change',buttons);checkCell.append(check);}else checkCell.textContent='—';
    const candidate=document.createElement('td');candidate.textContent=label;
    const id=document.createElement('td');id.textContent=w.status==='available'?w.candidate_id:'Unavailable: '+w.reason;
    const gen=document.createElement('td');gen.textContent=w.status==='available'?w.generation+' / '+w.car:'—';
    const fitness=document.createElement('td');fitness.textContent=w.status==='available'&&w.selection_fitness!==null?w.selection_fitness.toFixed(5):'Not available';
    const lap=document.createElement('td');lap.textContent=w.status==='available'&&w.best_lap_seconds!==null?w.best_lap_seconds.toFixed(3)+' s':'Not available';
    const laps=document.createElement('td');laps.textContent=w.status==='available'?String(w.forward_laps):'—';
    const contacts=document.createElement('td');contacts.textContent=w.status==='available'?String(w.physical_contacts):'—';
    const distance=document.createElement('td');distance.textContent=w.status==='available'&&w.total_actual_distance!==null?w.total_actual_distance.toFixed(3):'Not reported';
    const action=document.createElement('td');if(w.status==='available'){const option=document.createElement('option');option.value=role;option.textContent=label+' · '+w.candidate_id;select.append(option);const download=document.createElement('button');download.type='button';download.textContent='Download weights';download.onclick=()=>downloadBytes(localAnalysis.winnerNetworks[role].bytes,'ald-winner-'+role+'-'+w.candidate_id+'.evolution','application/octet-stream');action.append(download);}else action.textContent='—';
    for(const cell of [checkCell,candidate,id,gen,fitness,lap,laps,contacts,distance,action])tr.append(cell);tbody.append(tr);
  }
  if($('evaluationStatus'))$('evaluationStatus').textContent=summary.mode==='evaluate'?'Frozen evaluation complete. Scores are not shown as winner fitness; these physical measurements describe this policy and conditions.':'Choose policies to compare by selecting winner roles.';
  renderEvaluationRows();
}
async function useWinner(role,mode='evaluate'){
  if(mode!=='train'&&mode!=='evaluate')throw Error('Choose whether to continue training or evaluate unchanged weights');
  const item=localAnalysis?.winnerNetworks?.[role]??comparisonPlan?.winnerNetworks?.[role];if(!item)throw Error('That winner policy is unavailable');
  const file=new File([item.bytes],role+'-'+item.candidate_id+'.evolution',{type:'application/octet-stream'});
  window.TrainingClient.useNetwork(file);selectedWinner=role;
  window.TrackReplay?.focusCandidate?.(role);
  if($('winner_continue'))$('winner_continue').value=role;
  if($('run_mode'))$('run_mode').value=mode;syncRunModeUI();buttons();
  say(mode==='train'?'Selected '+role.replaceAll('_',' ')+' policy as the starting network for a new training run. The next Run click starts it with the selected recipe.':'Selected '+role.replaceAll('_',' ')+' policy for frozen evaluation. Its weights will stay unchanged; the next Run click starts it.');
}
function renderEvaluationRows(){
  const tbody=$('evaluationRows');if(!tbody)return;tbody.replaceChildren();
  for(const row of comparisonRows){
    const tr=document.createElement('tr');
    const policy=document.createElement('td');policy.textContent=(row.policy_label||'Selected policy')+' · '+row.network_sha256.slice(0,12);policy.title='Full policy SHA-256: '+row.network_sha256;
    const vehicle=document.createElement('td');vehicle.textContent=row.vehicle;
    const track=document.createElement('td');track.textContent=(row.track_label||'Selected track')+' · '+row.track_sha256.slice(0,12);track.title='Full track SHA-256: '+row.track_sha256;
    for(const cell of [policy,vehicle,track])tr.append(cell);
    for(const value of [String(row.requested_ticks),row.best_lap_seconds===null?'Not reported':row.best_lap_seconds.toFixed(3)+' s',String(row.forward_laps),String(row.physical_contacts),row.total_actual_distance===null?'Not reported':row.total_actual_distance.toFixed(3),row.compatible?'Same conditions':'Conditions differ']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    tbody.append(tr);
  }
}
function launchNextComparison(){
  if(!comparisonPlan||comparisonPlan.index===0||comparisonPlan.index>=comparisonPlan.roles.length)return;
  const expectedPlan=comparisonPlan,expectedIndex=comparisonPlan.index,role=comparisonPlan.roles[expectedIndex];
  setTimeout(async()=>{
    if(comparisonPlan!==expectedPlan||comparisonPlan.index!==expectedIndex||busy||job)return;
    try{
      await useWinner(role);
      if(comparisonPlan===expectedPlan&&comparisonPlan.index===expectedIndex&&!busy&&!job)$('run').click();
    }catch(error){
      if(comparisonPlan===expectedPlan){comparisonPlan=null;$('evaluationStatus').textContent='Comparison stopped before '+role.replaceAll('_',' ')+' could start: '+error.message+' Completed results remain in the table.';buttons();}
    }
  },0);
}
function showDescriptor(){
  if(!localAnalysis||localAnalysis.mode!=='train')return;
  const generation=Number($('descriptor_generation').value),car=Number($('descriptor_car').value);
  if(!Number.isInteger(generation)||!Number.isInteger(car)){ $('descriptor_status').textContent='Enter whole generation and car numbers.';return; }
  const row=localAnalysis.descriptorRows.find(item=>item.generation===generation&&item.car===car);
  if(!row){$('descriptor_status').textContent='No descriptor was recorded for that generation and car.';$('descriptor_tables').replaceChildren();return;}
  invalidateReplay('Descriptor selected. Record the selected policy again to inspect a drive.');
  const wrap=document.createElement('div');
  const summary=document.createElement('p');summary.textContent='Candidate '+row.candidate_id+' · ticks '+row.ticks_elapsed+' · stats updates '+row.stats_update_count+' · weights '+row.weights_sha256;wrap.append(summary);
  const table=(title,entries)=>{const h=document.createElement('h3');h.textContent=title;wrap.append(h);const t=document.createElement('table'),body=document.createElement('tbody');for(const [name,value] of entries){const tr=document.createElement('tr'),a=document.createElement('th'),b=document.createElement('td');a.textContent=name;b.textContent=value===null?'Not observed':typeof value==='number'?String(value):String(value);tr.append(a,b);body.append(tr);}t.append(body);wrap.append(t);};
  table('Physical objectives',Object.entries(row.objectives));table('Raw metrics',Object.entries(row.raw_metrics));
  table('Reward-channel measurements',row.channels.values.map((value,index)=>[localAnalysis.rewardChannels[index].metric+' · '+localAnalysis.rewardChannels[index].type,`${value===null?'Not observed':value} · population relative ${row.channels.population_relative[index]===null?'Not available':row.channels.population_relative[index]}${row.channels.unavailable_reasons[index]?' · '+row.channels.unavailable_reasons[index]:''}`]));
  $('descriptor_tables').replaceChildren(wrap);$('descriptor_status').textContent='All recorded values for this evaluated car are shown; unavailable fields remain explicitly unavailable.';
}
async function addFrozenEvaluation(){
  const receipt=runReceipt||portableReceipt;if(localAnalysis?.mode!=='evaluate'||!localAnalysis.evaluation||!receipt)return;
  const evaluation=localAnalysis.evaluation,summary=localAnalysis.summary,identity=conditionIdentity(summary,receipt.backend,receipt.build?.build_id??receipt.build_id??appBuild?.build_id??'');
  const m=evaluation.measurements,o=m.objectives;
  const policyLabels={fitness:'Final fitness leader',fastest_lap:'Fastest lap winner',clean_laps:'Clean laps winner'},trackInfo=runResultContext?.trackInfo??trackLibrary?.info?.();
  const policyRole=Object.entries(comparisonPlan?.winnerNetworks??localAnalysis?.winnerNetworks??{}).find(([,item])=>item.sha256===evaluation.input_sha256)?.[0]??selectedWinner;
  const record={policy_label:policyLabels[policyRole]??'Selected policy',network_sha256:evaluation.input_sha256,vehicle:['Formula','Rally','Snowmobile','Truck'][summary.conditions.vehicle_type],track_label:trackInfo?.display_name??(trackInfo?.source==='upload'?'Custom track':'Selected track'),track_sha256:summary.conditions.track_sha256,requested_ticks:summary.conditions.requested_ticks,best_lap_seconds:o.best_lap_seconds,forward_laps:o.forward_laps,physical_contacts:o.physical_contacts,total_actual_distance:o.total_actual_distance,identity};
  if(comparisonRows.some(row=>row.network_sha256===record.network_sha256&&row.identity===identity)){
    if($('evaluationStatus'))$('evaluationStatus').textContent='This policy and condition set is already in the comparison.';
    if(comparisonPlan){comparisonPlan.index++;if(comparisonPlan.index>=comparisonPlan.roles.length){$('evaluationStatus').textContent='All selected winner policies have been evaluated sequentially. Compare physical measurements; fitness is not shown as a cross-policy score.';comparisonPlan=null;}}
    return;
  }
  if(comparisonRows.length&&comparisonRows.some(row=>row.identity!==identity)){record.compatible=false;comparisonRows.push(record);renderEvaluationRows();$('evaluationStatus').textContent='Conditions differ from the comparison snapshot. This policy is shown separately and is not a like-for-like comparison.';return;}
  record.compatible=true;comparisonRows.push(record);renderEvaluationRows();$('evaluationStatus').textContent='Added unchanged policy measurements. Shared conditions match across '+comparisonRows.length+' evaluation(s); compare physical measures and retain each policy hash.';
  if(comparisonPlan){
    comparisonPlan.index++;
    if(comparisonPlan.index<comparisonPlan.roles.length){const next=comparisonPlan.roles[comparisonPlan.index];$('evaluationStatus').textContent+=' Next: run '+next.replaceAll('_',' ')+' under the same conditions.';}
    else{$('evaluationStatus').textContent='All selected winner policies have been evaluated sequentially. Compare physical measurements; fitness is not shown as a cross-policy score.';comparisonPlan=null;}
  }
}
if($('compare_winners'))$('compare_winners').onclick=async()=>{
  try{
    const roles=selectedWinnerRoles();if(!roles.length)throw Error('Select at least one available winner role');
    const uniqueRoles=uniqueWinnerRoles(roles,localAnalysis.winnerNetworks);roles.splice(0,roles.length,...uniqueRoles);const winners=roles.map(role=>localAnalysis.winnerNetworks[role]);
    const trackFile=await trackSource(),settings=window.getTrainingSettings?.();if(!trackFile||!settings)throw Error('Choose a track and valid evaluation conditions first');
    const trackBytes=new Uint8Array(await trackFile.arrayBuffer()),trackSha=await sha(trackBytes),trackInfo=trackLibrary?.info()??{source:'upload'},vehicleType=localAnalysis.summary.conditions.vehicle_type;
    if(winners.some(item=>item.vehicle_type!==vehicleType))throw Error('Selected winner policies do not share one vehicle type');
    const cleanMinText=$('clean_min_laps')?.value??'',cleanMinLaps=cleanMinText===''?2:Number(cleanMinText);
    if(!Number.isInteger(cleanMinLaps)||cleanMinLaps<1||cleanMinLaps>100)throw Error('Minimum clean laps must be a whole number from 1 to 100');
    const conditions={track_sha256:trackSha,network_sha256:'0'.repeat(64),vehicle_type:vehicleType,requested_ticks:settings.ticks,control_hz:settings.control_hz,collision:settings.collision,idle:settings.idle,math_profile:'proton',clean_min_laps:cleanMinLaps};
    comparisonPlan={roles,index:0,conditions,backend:$('backend').value,build_id:appBuild?.build_id??runReceipt?.build?.build_id,trackInfo,trackBytes,winnerNetworks:{...localAnalysis.winnerNetworks}};
    $('keepServer').checked=false;comparisonRows=[];renderEvaluationRows();$('run_mode').value='evaluate';syncRunModeUI();buttons();await useWinner(roles[0]);
    $('evaluationStatus').textContent='Starting a frozen comparison of '+roles.length+' distinct winner policies. This runs one unchanged policy at a time using the selected track, horizon and control settings. No candidate weights are changed.';
    $('run').click();
  }catch(error){$('analysisStatus').textContent='Comparison could not start: '+error.message;$('evaluationStatus').textContent=error.message;}
};
if($('winner_continue'))$('winner_continue').addEventListener('change',buttons);
if($('winner_continue_train'))$('winner_continue_train').onclick=()=>useWinner($('winner_continue').value||'fitness','train');
if($('winner_use'))$('winner_use').onclick=()=>useWinner($('winner_continue').value||'fitness','evaluate');
if($('descriptor_show'))$('descriptor_show').onclick=showDescriptor;
if($('compare_add'))$('compare_add').onclick=addFrozenEvaluation;
if($('compare_clear'))$('compare_clear').onclick=()=>{comparisonRows=[];comparisonPlan=null;renderEvaluationRows();if($('evaluationStatus'))$('evaluationStatus').textContent='Comparison cleared.';};
if($('analysis_download'))$('analysis_download').onclick=()=>{if(!localAnalysis)return;downloadTextFile(localAnalysis.archiveBytes,'ald-run-analysis.gz','application/gzip');};
async function parseRunAnalysisArchive(bytes,descriptor,reportedSummary){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>ANALYSIS_ARCHIVE_MAX||!descriptor||descriptor.size!==bytes.byteLength||descriptor.sha256!==await sha(bytes))throw Error('Analysis archive size or SHA-256 does not match the server report');
  if(descriptor.format!==undefined&&descriptor.format!=='ald.run-analysis-archive+gzip')throw Error('Unsupported analysis archive format');
  const raw=await expandAnalysisGzip(bytes);let envelope;
  try{envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw Error('Analysis archive is not valid UTF-8 JSON');}
  exactAnalysisKeys(envelope,['schema','version','files']);if(envelope.schema!=='ald.run-analysis-archive'||envelope.version!==1||!Array.isArray(envelope.files)||envelope.files.length>7)throw Error('Analysis archive envelope is invalid');
  const files=new Map(),allowed=new Set(['analysis.json','descriptors.jsonl','evaluation.json','stars.json','winners/fitness.evolution','winners/fastest_lap.evolution','winners/clean_laps.evolution']);
  for(const file of envelope.files){
    exactAnalysisKeys(file,['name','bytes','sha256','data_base64']);
    const fileMax=file.name==='stars.json'?STAR_CHECK_MAX:ANALYSIS_EXPANDED_MAX;
    if(typeof file.name!=='string'||!allowed.has(file.name)||files.has(file.name)||!Number.isInteger(file.bytes)||file.bytes<1||file.bytes>fileMax||!hex64(file.sha256))throw Error('Analysis archive file manifest is invalid');
    const content=b64Bytes(file.data_base64,fileMax);
    if(content.byteLength!==file.bytes||await sha(content)!==file.sha256)throw Error('Analysis archive inner file failed size or SHA-256 verification');
    files.set(file.name,{bytes:content,sha256:file.sha256});
  }
  if(!files.has('analysis.json')||!files.has('descriptors.jsonl'))throw Error('Analysis archive is missing required descriptors');
  let analysis;try{analysis=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files.get('analysis.json').bytes));}catch{throw Error('Analysis summary file is invalid JSON');}
  exactAnalysisKeys(analysis,['schema','version','mode','execution_backend','conditions','observations','winners','semantics','metric_names','reward_channels','settings','descriptors']);
  const summary=validateAnalysisSummary(reportedSummary);
  for(const key of ['schema','version','mode','execution_backend','conditions','observations','winners','semantics'])if(stableJson(analysis[key])!==stableJson(summary[key]))throw Error('Analysis archive does not match the public run summary');
  const metricNames=analysis.metric_names;
  if(!Array.isArray(metricNames)||metricNames.length!==14||metricNames.some(x=>typeof x!=='string'||x.length>80)||new Set(metricNames).size!==14)throw Error('Analysis metric catalog is invalid');
  const rewardChannels=analysis.reward_channels;
  if(!Array.isArray(rewardChannels)||rewardChannels.length!==18||rewardChannels.some(x=>!x||typeof x.metric!=='string'||!['default','average'].includes(x.type)))throw Error('Analysis reward catalog is invalid');
  if(!analysis.settings||typeof analysis.settings!=='object'||Array.isArray(analysis.settings))throw Error('Analysis settings are invalid');
  exactAnalysisKeys(analysis.descriptors,['name','bytes','sha256','rows']);
  const descriptorFile=files.get('descriptors.jsonl');if(analysis.descriptors.name!=='descriptors.jsonl'||analysis.descriptors.bytes!==descriptorFile.bytes.byteLength||analysis.descriptors.sha256!==descriptorFile.sha256||!Number.isInteger(analysis.descriptors.rows)||analysis.descriptors.rows<1||analysis.descriptors.rows>ANALYSIS_ROWS_MAX||analysis.descriptors.rows!==summary.observations.cars)throw Error('Descriptor file metadata is inconsistent');
  const descText=new TextDecoder('utf-8',{fatal:true}).decode(descriptorFile.bytes),offsets=[],descriptorRows=[],candidateIds=new Set();let cursor=0;
  while(cursor<descText.length){const end=descText.indexOf('\n',cursor),stop=end<0?descText.length:end;if(stop===cursor){cursor=stop+1;continue;}if(offsets.length>=ANALYSIS_ROWS_MAX)throw Error('Analysis descriptor row limit exceeded');let row;try{row=JSON.parse(descText.slice(cursor,stop));}catch{throw Error('Analysis descriptor row is invalid JSON');}validateDescriptorRow(row,metricNames,rewardChannels);if(candidateIds.has(row.candidate_id))throw Error('Analysis descriptor candidate identity is duplicated');candidateIds.add(row.candidate_id);descriptorRows.push(row);offsets.push([cursor,stop]);cursor=end<0?descText.length:stop+1;}
  if(offsets.length!==analysis.descriptors.rows)throw Error('Analysis descriptor count does not match its manifest');
  const winnerNetworks={};
  for(const role of ['fitness','fastest_lap','clean_laps']){
    const winner=summary.winners[role],name='winners/'+role+'.evolution',file=files.get(name);
    if(winner.status==='available'){
      if(!file||winner.artifact.bytes!==file.bytes.byteLength||winner.artifact.sha256!==file.sha256)throw Error('Winner network is missing or does not match its descriptor');
      const matched=descriptorRows.find(row=>row.generation===winner.generation&&row.car===winner.car&&row.candidate_id===winner.candidate_id);
      if(!matched)throw Error('Winner candidate is missing from the descriptor rows');
      const network=await validateNetworkBytes(file.bytes);if(network.Type!==summary.conditions.vehicle_type)throw Error('Winner network vehicle type does not match analysis conditions');
      winnerNetworks[role]={bytes:file.bytes,sha256:file.sha256,candidate_id:winner.candidate_id,vehicle_type:summary.conditions.vehicle_type};
      Object.defineProperty(winnerNetworks[role],'decoded',{value:network,enumerable:false});
    }else if(file)throw Error('Unavailable winner unexpectedly has a network artifact');
  }
  let evaluation=null;
  if(summary.mode==='evaluate'){
    const f=files.get('evaluation.json');if(!f)throw Error('Frozen evaluation archive is missing its result');
    try{evaluation=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(f.bytes));}catch{throw Error('Frozen evaluation result is invalid JSON');}
    exactAnalysisKeys(evaluation,['schema','version','conditions','input_sha256','weights_unchanged','measurements']);
    if(evaluation.schema!=='ald.frozen-evaluation'||evaluation.version!==1||stableJson(evaluation.conditions)!==stableJson(summary.conditions)||evaluation.input_sha256!==summary.conditions.network_sha256||evaluation.weights_unchanged!==true)throw Error('Frozen evaluation identity is invalid');
    validateDescriptorRow(evaluation.measurements,metricNames,rewardChannels);
  }else if(files.has('evaluation.json'))throw Error('Training archive unexpectedly contains frozen evaluation data');
  let starCheck=null;
  if(files.has('stars.json')){
    try{starCheck=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files.get('stars.json').bytes));}catch{throw Error('Star check file is invalid JSON');}
    validateStarCheck(starCheck,summary);
  }
  const expectedFiles=new Set(['analysis.json','descriptors.jsonl',...(summary.mode==='evaluate'?['evaluation.json']:[]),...(files.has('stars.json')?['stars.json']:[]),...Object.entries(summary.winners).filter(([,w])=>w.status==='available').map(([role])=>'winners/'+role+'.evolution')]);
  if(files.size!==expectedFiles.size||[...files.keys()].some(name=>!expectedFiles.has(name)))throw Error('Analysis archive contains missing or unexpected files');
  return {mode:summary.mode,summary,analysis,winnerNetworks,evaluation,starCheck,archiveBytes:bytes,descriptorText:descText,descriptorOffsets:offsets,descriptorRows,rawMetrics:metricNames,rewardChannels};
}
function validateStarCheck(value,summary){
  exactAnalysisKeys(value,['schema','version','network_sha256','track_sha256','vehicle_type','execution_backend','status','horizon_seconds','collision_elimination','scope','basis','challenges']);
  const expectedNetwork=summary.mode==='train'?summary.winners.fitness.artifact?.sha256:summary.conditions.network_sha256;
  if(value.schema!=='ald.star-check'||value.version!==1||!hex64(value.network_sha256)||value.network_sha256!==expectedNetwork||
     !hex64(value.track_sha256)||value.track_sha256!==summary.conditions.track_sha256||value.vehicle_type!==summary.conditions.vehicle_type||
     value.execution_backend!==summary.execution_backend||!['complete','unavailable','no_challenges'].includes(value.status)||
     !Number.isFinite(value.horizon_seconds)||value.horizon_seconds<0||value.horizon_seconds>300||
     typeof value.collision_elimination!=='boolean'||value.collision_elimination!==summary.conditions.collision||
     value.scope!=='current_network'||typeof value.basis!=='string'||!value.basis.length||value.basis.length>1000||
     !Array.isArray(value.challenges)||value.challenges.length>64)throw Error('Star check identity or metadata is invalid');
  if((value.status==='no_challenges')!==(value.challenges.length===0))throw Error('Star check status does not match its challenge list');
  const ids=new Set();
  for(const challenge of value.challenges){
    exactAnalysisKeys(challenge,['id','type','text','status','reason','completion_seconds']);
    if(typeof challenge.id!=='string'||!challenge.id.length||challenge.id.length>128||ids.has(challenge.id)||
       typeof challenge.type!=='string'||!challenge.type.length||challenge.type.length>96||
       typeof challenge.text!=='string'||challenge.text.length>256||
       !['met','not_met','not_checked'].includes(challenge.status)||
       !(challenge.reason===null||(typeof challenge.reason==='string'&&challenge.reason.length>0&&challenge.reason.length<=256))||
       !(challenge.completion_seconds===null||(Number.isFinite(challenge.completion_seconds)&&challenge.completion_seconds>=0&&challenge.completion_seconds<=300)))throw Error('Star check challenge entry is invalid');
    if(challenge.status==='met'){
      if(challenge.reason!==null||challenge.completion_seconds===null||challenge.completion_seconds>value.horizon_seconds)throw Error('Completed challenge evidence is inconsistent');
    }else if(challenge.reason===null||challenge.completion_seconds!==null)throw Error('Uncompleted challenge evidence is inconsistent');
    if(value.status==='unavailable'&&challenge.status!=='not_checked')throw Error('Unavailable star check cannot report a challenge result');
    ids.add(challenge.id);
  }
  return value;
}
function validatePrimaryAnalysisMatch(primarySha,parsed){
  if(!hex64(primarySha)||!parsed?.summary)throw Error('Primary result and analysis are not verifiable');
  if(parsed.mode==='train'){
    const fitness=parsed.winnerNetworks?.fitness;
    if(!fitness||fitness.sha256!==primarySha)throw Error('Primary result is not the archived final fitness winner');
  }else if(parsed.mode==='evaluate'){
    if(parsed.summary.conditions.network_sha256!==primarySha)throw Error('Frozen evaluation result does not preserve the submitted policy bytes');
  }else throw Error('Analysis mode is unsupported');
  return true;
}
window.RunAnalysis={parseArchive:parseRunAnalysisArchive,validatePrimaryMatch:validatePrimaryAnalysisMatch,validateComparisonRequest,uniqueWinnerRoles,validateStarCheck};
function renderHistoryChart(history){
  const wrap=$('historyChartWrap'),canvas=$('historyChartCanvas');
  if(!wrap||!canvas||typeof canvas.getContext!=='function')return;
  if(!Array.isArray(history)||history.length<1){wrap.hidden=true;return;}
  wrap.hidden=false;
  const ctx=canvas.getContext('2d');if(!ctx||typeof ctx.save!=='function')return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#09111b';ctx.fillRect(0,0,w,h);
  const padL=52,padR=52,padT=24,padB=28,pw=w-padL-padR,ph=h-padT-padB;
  const scores=history.flatMap(r=>[r.best_score,r.mean_score]).filter(v=>typeof v==='number'&&Number.isFinite(v));
  const minS=scores.length?Math.min(...scores):0,maxS=scores.length?Math.max(minS+1e-4,Math.max(...scores)):1;
  ctx.strokeStyle='#1e3044';ctx.lineWidth=1;
  for(let g=0;g<=3;g++){const y=padT+(g/3)*ph;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();}
  const xAt=i=>padL+(history.length===1?pw*0.5:(i/(history.length-1))*pw);
  const yScore=v=>padT+ph-((v-minS)/(maxS-minS))*ph;
  // Mean fitness curve (#58a6ff)
  ctx.strokeStyle='#58a6ff';ctx.lineWidth=2;ctx.beginPath();
  history.forEach((r,i)=>{const x=xAt(i),y=yScore(r.mean_score||0);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  // Best fitness curve (#62dfb1)
  ctx.strokeStyle='#62dfb1';ctx.lineWidth=2.5;ctx.beginPath();
  history.forEach((r,i)=>{const x=xAt(i),y=yScore(r.best_score||0);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  // Best lap dots (#ffd073)
  const laps=history.map(r=>r.best_lap_seconds).filter(v=>typeof v==='number'&&v>0);
  if(laps.length){
    const minL=Math.min(...laps)*0.95,maxL=Math.max(minL+0.1,Math.max(...laps)*1.05);
    ctx.fillStyle='#ffd073';
    history.forEach((r,i)=>{if(typeof r.best_lap_seconds==='number'&&r.best_lap_seconds>0){
      const x=xAt(i),y=padT+((r.best_lap_seconds-minL)/(maxL-minL))*ph;
      ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
    }});
  }
  if(typeof ctx.fillText==='function'){
    ctx.fillStyle='#62dfb1';ctx.font='700 11px system-ui,sans-serif';ctx.fillText('Best Fitness',padL,15);
    ctx.fillStyle='#58a6ff';ctx.fillText('Mean Fitness',padL+90,15);
    ctx.fillStyle='#ffd073';ctx.fillText('● Completed Lap',padL+185,15);
    ctx.fillStyle='#8fa6bc';ctx.font='600 10px ui-monospace,SFMono-Regular,monospace';
    ctx.fillText(maxS.toFixed(2),6,padT+6);ctx.fillText(minS.toFixed(2),6,padT+ph);
    ctx.fillText('Gen 1',padL,h-8);ctx.fillText('Gen '+history.length,w-padR-42,h-8);
  }
}
function showDetails(r){
  const metric=n=>typeof n==='number'?n.toFixed(3):'Not reported';
  if($('effectiveSettings'))$('effectiveSettings').textContent=JSON.stringify(r?.settings??{},null,2);
  if($('generationHistory'))$('generationHistory').textContent=(r?.history??[]).map(h=>
    'Generation '+h.generation+' · mutation '+metric(h.mutation)+' · best '+metric(h.best_score)+' · mean '+metric(h.mean_score)+' · lap '+(h.best_lap_seconds??'none')+' · cars lapped '+(h.lapped_cars??'not reported')+' · ticks '+metric(h.simulated_ticks)).join('\n');
  const kpi=$('runKpiStrip');
  if(kpi){
    if(!r){kpi.hidden=true;renderHistoryChart(null);}
    else{
      kpi.hidden=false;
      if($('kpi_best_score'))$('kpi_best_score').textContent=typeof r.best_score==='number'?r.best_score.toFixed(3):'—';
      if($('kpi_mean_score'))$('kpi_mean_score').textContent=typeof r.mean_score==='number'?r.mean_score.toFixed(3):'—';
      if($('kpi_best_lap'))$('kpi_best_lap').textContent=typeof r.best_lap_seconds==='number'?r.best_lap_seconds.toFixed(3)+' s':'No lap';
      if($('kpi_lapped_cars'))$('kpi_lapped_cars').textContent=r.lapped_cars!=null?`${r.lapped_cars} / ${r.population??'—'}`:'0';
      renderHistoryChart(r.history);
    }
  }
  window.TrackReplay?.setRunAnalysis?.(localAnalysis,runReceipt||portableReceipt||(r?{report:r}:null));
}
$('run').onclick = async () => {
  if(replayBusy)return;
  invalidateReplay();
  const comparisonAttempt=!!comparisonPlan,comparisonRole=comparisonAttempt?comparisonPlan.roles[comparisonPlan.index]:null;
  const previousRunResultContext=runResultContext;
  cancelSteamLeaderboard();
  if($('leaderboard_status'))$('leaderboard_status').textContent='';
  const started=performance.now();
  $('runState').textContent='RUNNING — waiting for server confirmation';
  $('runState').style.color='#ffd073';
  runReceipt=null;pairedAnalysisPending=false;serverCopyStatus='no new result is confirmed.';
  runDisplayContext={backend:$('backend').value,mode:$('run_mode')?.value??'train',report:null};
  runResultContext=null;
  showDetails(null);
  const tick=()=>{$('runSummary').textContent='Backend: '+$('backend').value.toUpperCase()+'\nElapsed: '+((performance.now()-started)/1000).toFixed(1)+' s\nCompletion is not yet confirmed.';};
  tick(); const progress=setInterval(tick,250);
  busy=true; buttons(); say(window.getTrainingSettings?'Processing the training run…':'Processing the bounded test…');
  try {
    const {file:trackFile,trackInfo}=await runTrackSource(previousRunResultContext),networkFile=networkSource();
    const trackBytes=new Uint8Array(await trackFile.arrayBuffer()),networkBytes=new Uint8Array(await networkFile.arrayBuffer());
    const networkValue=await validateNetworkBytes(networkBytes),settings=window.getTrainingSettings?.()??{};
    const cleanMinText=$('clean_min_laps')?.value??'',cleanMinLaps=cleanMinText===''?2:Number(cleanMinText);
    if(!Number.isInteger(cleanMinLaps)||cleanMinLaps<1||cleanMinLaps>100)throw Error('Minimum clean laps must be a whole number from 1 to 100.');
    if(comparisonPlan){
      try{validateComparisonRequest(comparisonPlan,{mode:$('run_mode')?.value==='evaluate'?'evaluate':'train',network_sha256:await sha(networkBytes),
        track_sha256:await sha(trackBytes),vehicle_type:networkValue?.Type,requested_ticks:settings.ticks,control_hz:settings.control_hz,
        collision:settings.collision,idle:settings.idle,clean_min_laps:cleanMinLaps,backend:$('backend').value,build_id:appBuild?.build_id});}
      catch(error){comparisonPlan=null;throw error;}
    }
    const autosaveSnapshot=bucketToken&&$('bucket_autosave')?.checked?bucketSnapshot():null;
    if(autosaveSnapshot)$('keepServer').checked=false;
    const context={trackInfo,trackBytes,inputNetworkSha256:await sha(networkBytes),autosaveSnapshot};
    const body={track:await encoded(trackFile),network:await encoded(networkFile),automatic:autosaveSnapshot?true:!$('keepServer').checked,backend:$('backend').value};
    if(window.getTrainingSettings){body.settings={...settings};body.settings.mode=$('run_mode')?.value==='evaluate'?'evaluate':'train';body.settings.clean_min_laps=cleanMinLaps;
      if(body.settings.mode==='evaluate')Object.assign(body.settings,{population:1,generations:1,mutation:0,mutation_end:0,schedule:'fixed',selection:'best',parents:1,elite:0,crossover:'none',decay:0,adaptive_mutation:false});}
    job=await submit(body);runDisplayContext={backend:job.backend,mode:body.settings?.mode??'train',report:job.report};serverCopyStatus='available until verified receipt, deletion or expiry. Receive and download the driver below.';localResult=null;localAnalysis=null;pairedAnalysisPending=false;selectedWinner=null;renderAnalysisPanel();
    clearInterval(progress);
    $('runState').textContent='COMPLETE — candidate ready to download';
    $('runState').style.color='#62dfb1';
    const r=job.report;
    runReceipt={version:1,state:'completed',build:r?.build??appBuild,backend:job.backend,output_sha256:job.sha256,report:r};
    runResultContext=context;
    const metric=n=>typeof n==='number'?n.toFixed(3):'Not reported';
    $('runSummary').textContent=r?[
      'Build: '+(r.build?.build_id??'Not reported'),
      'Backend: '+job.backend.toUpperCase(),
      'Vehicle: '+(Number.isInteger(r.vehicle_type)&&r.vehicle_type>=0&&r.vehicle_type<=3?['Formula','Rally','Snowmobile','Truck'][r.vehicle_type]+' (Type '+r.vehicle_type+')':'Not reported'),
      'Track: '+(trackInfo?.source==='builtin'?trackInfo.display_name:'Custom upload'),
      'Generations: '+r.generations_completed+' / '+r.generations_requested+' · Population: '+r.population,
      'Server processing: '+metric(r.elapsed_seconds)+' s',
      ...(r.mode==='evaluate'||r.analysis_summary?.mode==='evaluate'?['Mode: FROZEN EVALUATION · weights unchanged']:['Final-generation population scores — best: '+metric(r.best_score)+' · mean: '+metric(r.mean_score)]),
      'Best completed lap observed during this run (may be another car): '+(r.best_lap_seconds==null?'No completed lap':metric(r.best_lap_seconds)+' s'),
      'Cars completing a lap in the final generation: '+(r.lapped_cars??'Not reported'),
      'Actual frames (including stats cutoff): '+(r.simulated_ticks??'Not reported')+' · Configured time limit: '+r.requested_ticks+' ticks',
      'Candidate validated: '+(r.candidate_validated?'Yes':'No'),
      'A completed test does not establish improved driving.'
    ].join('\n'):'Server returned a candidate; detailed metrics unavailable.';
    showDetails(r);
    if($('leaderboard_opt_in')?.checked)void checkSteamLeaderboard(trackInfo,r);
    else if($('leaderboard_status'))$('leaderboard_status').textContent='';
    if(!comparisonPlan)$('track').value=''; $('network').value='';
    stagedNetwork=null;window.setFreezeNetwork?.(null);if($('networkChoice'))$('networkChoice').textContent='Run input released. The latest result and its download controls are above.';
    say('Result ready ('+job.backend.toUpperCase()+'). Inputs and intermediate worker files have been removed.');
    if(autosaveSnapshot){
      try{
        const outcome=await receiveAndAutosave(job,autosaveSnapshot,context);
        $('runState').textContent='COMPLETE — verified candidate saved to bucket';
        say('Result was hash-verified, the server copy was deleted, and the run bundle was read back from your bucket. A local browser copy remains available to download.');
        $('runSummary').textContent+='\nBucket save: verified read-back succeeded.';
        try{await refreshBucketItems(autosaveSnapshot,{selectKey:outcome.saved.key,preflight:false});}
        catch{$('bucket_status').textContent='Network and run log were saved and verified. The saved-bundle list could not refresh; use Refresh saved bundles.';}
      }catch(error){
        if(comparisonAttempt&&context.serverDeleted)comparisonPlan=null;
        if(retainVerifiedPrimary(error)){
          context.localPrimaryVerified=true;
          $('runSummary').textContent+='\nThe primary network was verified and is available locally, but its paired analysis did not verify. No acknowledgment or bucket save was attempted. Retry Download result while the server result remains available.';
          $('bucket_status').textContent='Primary network verified locally; paired analysis is pending. No bucket save was attempted.';
          $('runState').textContent='COMPLETE — primary network verified; analysis pending';$('runState').style.color='#ffd073';
          say('Primary network verified. Paired analysis is pending; retry Download result.');
        }else if(!context.localVerified){
          $('runSummary').textContent+='\nAutomatic receive failed: '+error.message+' No verified local copy is available. The server result may remain available until deletion or expiry; retry download or delete it.';
          $('bucket_status').textContent='Run completed, but the result was not verified in this browser. No bucket save was attempted.';
          $('runState').textContent='COMPLETE — result not received or verified';$('runState').style.color='#ffd073';
          say('The run completed, but no verified local copy was received. The server result may remain available until deletion or expiry.');
        }else if(!context.serverDeleted){
          $('runSummary').textContent+='\nThe candidate was verified locally, but deletion of the server copy was not confirmed. No bucket save was attempted. The local network remains available to download; the server result may remain available until deletion or expiry.';
          $('bucket_status').textContent='Verified network remains in this page; server deletion was not confirmed and bucket save was skipped.';
          say('A verified local network is available. Server deletion still needs attention.');
        }else{
          const saveDisposition=context.bucketSaveStarted?'Bucket save was not confirmed; the remote save may have completed.':'No bucket save was attempted.';
          $('runSummary').textContent+='\n'+saveDisposition+' '+error.message+' The verified candidate remains available in this page; use Download received result or Save selected bundle to retry.';
          $('bucket_status').textContent='Server copy deleted. '+saveDisposition+' '+error.message+' The received network remains available in this page.';
          say('Run completed. A verified candidate remains in this page; bucket save needs attention.');
        }
      }
    }else if(comparisonPlan){
      try{
        const received=await receive(job);
        localResult=new Blob([received.bytes]);localAnalysis=received.analysis;pairedAnalysisPending=false;context.localVerified=true;renderAnalysisPanel();buttons();
        runResultContext=context;
        const acknowledgment=await acknowledge(job,received);
        if(acknowledgment.deleted!==true)throw Error('Frozen comparison result was verified, but server deletion was not confirmed. No next comparison run was started.');
        if(runReceipt)runReceipt.delivery={received_and_hash_verified:true,server_copy_deleted:true};
        job=null;buttons();await addFrozenEvaluation();
      }catch(error){
        if(retainVerifiedPrimary(error)){
          $('runState').textContent='COMPLETE — primary network verified; analysis pending';$('runState').style.color='#ffd073';
          $('runSummary').textContent='The primary network was verified and remains available locally. Paired analysis is pending; no acknowledgment was sent and the comparison stopped. Retry Download result while the server result remains available.';
          say('Primary network verified. Paired analysis is pending; comparison stopped until the result pair is verified.');
        }else{
          comparisonPlan=null;
          $('evaluationStatus').textContent='Comparison stopped: '+error.message+' No later policy was run.';
          throw error;
        }
      }
    }
  } catch (error) {
    if(retainVerifiedPrimary(error)){
      $('runState').textContent='COMPLETE — primary network verified; analysis pending';$('runState').style.color='#ffd073';
      $('runSummary').textContent='The primary network was verified and is available to save locally. Its paired analysis is still pending, so no receipt, analysis, acknowledgment or bucket save is available. Retry Download result while the server result remains available.';
      say('Primary network verified. Analysis is pending; retry the paired download before using the run report or saving a bundle.');
      clearInterval(progress);return;
    }
    clearInterval(progress);
    if(comparisonAttempt&&comparisonRows.length){
      comparisonPlan=null;
      $('runState').textContent='COMPARISON STOPPED — completed results retained';
      $('runState').style.color='#ffd073';
      $('evaluationStatus').textContent='Comparison stopped before '+String(comparisonRole??'the next policy').replaceAll('_',' ')+' completed: '+displayError(error)+' Earlier verified results remain in the table.';
      $('runSummary').textContent='Completed evaluations retained: '+comparisonRows.length+'\nThe current policy did not produce a fully verified result. Earlier comparison rows remain valid and available.\n'+displayError(error);
      say('Comparison stopped. Earlier verified results remain in the table. '+displayError(error));
      return;
    }
    const workLimit=error?.code==='TRAINING_WORK_LIMIT';
    $('runState').textContent=workLimit?'SETTINGS NEED ADJUSTMENT — no run started':'ERROR — no successful result confirmed';
    $('runState').style.color='#ffb5a2';
    const quotaRejected=isGpuQuotaError(error)||String(error?.message??'').startsWith('GPU allowance is exhausted for this request.');
    $('runSummary').textContent=workLimit?'No run was submitted. Change population, generations, or ticks on Training & recipes, then try again.':
      'Elapsed: '+((performance.now()-started)/1000).toFixed(1)+' s\n'+(quotaRejected
      ? 'HF rejected this GPU request before a result was published.'
      : 'No downloadable result was received. A connection error does not prove the server stopped.');
    say(displayError(error));
  }
  finally {clearInterval(progress);busy=false;$('keepServer').checked=false;buttons();if(comparisonPlan)launchNextComparison();else if(!batchActive&&!$('resultSummary').hidden){const heading=$('result_summary_title');heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});}}
};
$('download').onclick = async () => {
  busy=true; buttons();
  try {
    const received=await receive(job);
    // The browser has the complete validated result. Disk-save success cannot be observed.
    localResult=new Blob([received.bytes]);localAnalysis=received.analysis;pairedAnalysisPending=false;renderAnalysisPanel();saveLocal();if(localAnalysis?.mode==='evaluate')await addFrozenEvaluation();
    const acknowledgment=await acknowledge(job,received);
    if(runReceipt)runReceipt.delivery={received_and_hash_verified:true,server_copy_deleted:acknowledgment.deleted===true};
    if (acknowledgment.deleted) { $('runState').textContent='COMPLETE — result received; server copy deleted'; job=null; say('Result received by browser. Server result deleted. Save your local download; server retrieval is no longer available.'); }
    else say('Result received by browser. The server copy is available for another download until its five-minute deadline; use Delete now to remove it sooner.');
  } catch (error) {
    if(retainVerifiedPrimary(error))say('Primary network verified and saved locally. The analysis did not verify, so the job remains available; retry Download result. No acknowledgment was sent.');
    else say(error.message+' If receipt acknowledgment failed, use Delete now; automatic expiry still applies.');
  }
  finally {busy=false; buttons();}
};
$('erase').onclick=async()=>{
  if(!await window.appConfirm('Delete remaining server-side result and revoke download access? Local files are unaffected.',{heading:'Delete server result',confirmLabel:'Delete result',danger:true}))return;
  busy=true; buttons();
  try {await request('/api/jobs/'+job.id,{method:'DELETE',headers:headers()}); job=null; serverCopyStatus='deleted by request. Local files are unaffected.';say('Server result deleted. Local files are unaffected.');}
  catch(error){say(error.message);}
  finally {busy=false; buttons();}
};
if($('batch_start')){
  $('batch_stop').onclick=()=>{batchStopRequested=true;buttons();$('batch_status').textContent='Stop requested — the current run will finish; no next run will start.';};
  $('batch_start').onclick=async()=>{
    const context=batchRunContext(),readiness=window.getBatchReadiness?.();
    if(!context.available||!readiness?.ready){
      $('batch_status').textContent=!readiness?.ready?(readiness?.message||'Save a valid batch before running it.'):context.reason;
      buttons();return;
    }
    let plan,failedCandidateStep=null;const history=[];const started=Date.now();
    try{
      plan=window.getBatchPlan();
      runDisplayContext={backend:$('backend').value,mode:'train',report:null};serverCopyStatus='no new result is confirmed.';
      busy=true;buttons(); // Freeze both selectors before an asynchronous track fetch.
      const trackFile=await trackSource();
      if(!trackFile)throw Error('Choose a track in Run & results before running a batch.');
      const trackBytes=new Uint8Array(await trackFile.arrayBuffer()),track=await encoded(trackFile),trackInfo=trackLibrary?.info()??{source:'upload'},original=networkSource();
      await encoded(original); // Reject missing/oversize inputs before dispatch.
      const backend=$('backend').value,autosaveSnapshot=bucketToken&&$('bucket_autosave')?.checked?bucketSnapshot():null;
      runDisplayContext={backend,mode:'train',report:null};serverCopyStatus='no new result is confirmed.';
      busy=true;batchActive=true;batchStopRequested=false;batchReceipt=null;buttons();
      localResult=null;localAnalysis=null;pairedAnalysisPending=false;
      $('batch_history').replaceChildren();
      $('batches_feedback').textContent='';
      $('runState').textContent='BATCH RUNNING — completion not yet confirmed';
      $('runState').style.color='#ffd073';
      showDetails(null);
      const result=await window.BatchTraining.execute(plan,original,async(source,settings,i)=>{
        $('batch_status').textContent='RUNNING · '+plan.name+' · step '+(i+1)+' / '+plan.runs.length+' · '+plan.runs[i].slot+' · '+plan.runs[i].name;
        runDisplayContext={backend,mode:settings.mode??'train',report:null};serverCopyStatus='no new result is confirmed.';
        const inputHash=await sha(await source.arrayBuffer());
        job=await submit({track,network:await encoded(source),settings,backend,automatic:true});
        runDisplayContext={backend:job.backend,mode:settings.mode??'train',report:job.report};serverCopyStatus='available until verified receipt, deletion or expiry. Receive and download the driver below.';
        const stepJob=job,report=stepJob.report,stepRunReceipt={version:1,state:'completed',build:report?.build??appBuild,backend,output_sha256:stepJob.sha256,report};
        let received;
        try{received=await receive(job);}catch(error){if(retainVerifiedPrimary(error)){runReceipt=stepRunReceipt;runResultContext={trackInfo,trackBytes,inputNetworkSha256:inputHash,autosaveSnapshot};}throw error;}
        localResult=new Blob([received.bytes]);localAnalysis=received.analysis;pairedAnalysisPending=false;renderAnalysisPanel();showDetails(job.report);
        const stepContext={trackInfo,trackBytes,inputNetworkSha256:inputHash,autosaveSnapshot,analysisArchiveBytes:received.analysisBytes};
        runReceipt=stepRunReceipt;runResultContext=stepContext;runReceipt.delivery={received_and_hash_verified:true,server_copy_deleted:false};
        const ack=await acknowledge(job,received);
        if(!ack.deleted)throw Error('Intermediate deletion was not confirmed; batch stopped');
        runReceipt.delivery.server_copy_deleted=true;
        const summary={backend,input_network_sha256:inputHash,output_sha256:stepJob.sha256,server_result_deleted:true,report};
        job=null;
        if(autosaveSnapshot){
          failedCandidateStep={step:i+1,slot:plan.runs[i].slot,name:plan.runs[i].name,...summary,autosave:'pending'};
          const outcome=await saveVerifiedRunToBucket(autosaveSnapshot,stepContext);
          failedCandidateStep.autosave='verified';failedCandidateStep.bucket_key=outcome.saved.key;
          try{await refreshBucketItems(autosaveSnapshot,{selectKey:outcome.saved.key,preflight:false});}catch{$('bucket_status').textContent='Run network and log saved and verified; saved-bundle list could not refresh.';}
          failedCandidateStep=null;
        }
        return {candidate:localResult,receipt:summary};
      },{stopped:()=>batchStopRequested,onStep:step=>{
        history.push(step);const line=document.createElement('p');
        line.textContent='Step '+step.step+' · '+step.slot+' · '+step.name+' · completed · '+step.report.generations_completed+' generations · server copy deleted';
        $('batch_history').append(line);
      }});
      batchReceipt={version:1,build:appBuild,state:result.state,plan,track:trackLibrary?.info()??{source:'upload'},history,elapsed_seconds:(Date.now()-started)/1000};
      $('batch_status').textContent=result.state.toUpperCase()+' · '+history.length+' / '+plan.runs.length+' runs. '+(localResult?'Last received candidate is available on Run & results.':'No candidate received.');
      $('runState').textContent='BATCH '+result.state.toUpperCase()+' — '+history.length+' / '+plan.runs.length+' runs; server copies deleted';
      $('runState').style.color=result.state==='completed'?'#62dfb1':'#ffd073';
      $('runSummary').textContent='Backend: '+backend.toUpperCase()+'\nCompleted steps: '+history.length+'\nUse Save received result again for the last candidate. A completed batch does not establish improved driving.';
      say('Batch results are in browser memory only; no server result remains for completed steps.');
    }catch(error){
      retainVerifiedPrimary(error);
      if(failedCandidateStep&&!history.some(step=>step.step===failedCandidateStep.step)){
        const failed={...failedCandidateStep,autosave:'failed'};history.push(failed);
        const line=document.createElement('p');line.textContent='Step '+failed.step+' · '+failed.slot+' · '+failed.name+' · result received and server copy deleted · bucket save not confirmed';$('batch_history').append(line);
      }
      batchReceipt={version:1,build:appBuild,state:'error',plan:plan??null,history,error:error.message,elapsed_seconds:(Date.now()-started)/1000};
      $('batch_status').textContent='ERROR · '+history.length+' confirmed steps. '+displayError(error);
      $('runState').textContent='BATCH ERROR — '+history.length+' completed steps';
      $('runState').style.color='#ffb5a2';
      $('runSummary').textContent='Confirmed completed steps: '+history.length+'\n'+(job?'A server result remains accessible; use Delete now or await expiry.':localResult?'A verified local candidate remains in this page.':'No current server result was received.')+'\n'+displayError(error);
      say(displayError(error)+(job?' Use Delete server-side job data now or await expiry.':''));
    }finally{
      if(batchActive){
        $('track').value='';$('network').value='';stagedNetwork=null;
        if($('networkChoice'))$('networkChoice').textContent='Network input released after the batch.';
      }
      busy=false;batchActive=false;buttons();
    }
  };
  $('batch_export').onclick=()=>{
    if(!batchReceipt)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(batchReceipt,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='ald-batch-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}
setInterval(()=>{
  if(!job){$('deadline').textContent='';return;}
  const remaining=Math.max(0,Math.ceil(job.expires_at-Date.now()/1000));
  $('deadline').textContent='Automatic expiry: '+new Date(job.expires_at*1000).toLocaleTimeString()+' · '+Math.floor(remaining/60)+'m '+remaining%60+'s remaining';
  if(!remaining && !busy){job=null; serverCopyStatus='access expired. Server cleanup runs independently of this browser.';buttons(); say('Result access has expired. Server cleanup runs independently of this browser.');}
},1000);
buttons();
async function connect(){
  $('connectionRecovery').hidden=true;
  $('retry').disabled=true;
  $('backendNote').textContent='Checking available backends…';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const capabilities=await (await request('/api/capabilities',{signal:controller.signal})).json();
    if(capabilities.cpu!==true)throw new Error('CPU unavailable');
    appBuild=capabilities.build??null;
    if($('buildLabel')){
      $('buildLabel').textContent='Build: '+(appBuild?.build_id?.slice(0,25)??'Unavailable — include the app URL in feedback');
      $('buildLabel').title=appBuild?.build_id??'';
    }
    gpuAvailable=capabilities.gpu===true;
    gpuTransport=capabilities.gpu_transport??null;
    $('gpuOption').disabled=!gpuAvailable;
    if(!gpuAvailable)$('backend').value='cpu';
    $('backendNote').textContent=capabilities.gpu?(hostedStandalone?'CPU is anonymous. GPU may use a limited anonymous allowance or your optional HF account allowance.':'CPU is anonymous. GPU requires an available HF allowance.'):'CPU training is ready; no sign-in or GPU allowance needed.';
    $('gpuAccount').hidden=!capabilities.gpu;
    $('computeBlock').hidden=!capabilities.gpu;
    capabilitiesReady=true; buttons();
    say('Connected. Choose your track and network, then run the test.');
  } catch(error) {
    $('connectionRecovery').hidden=false;
    capabilitiesReady=false;gpuAvailable=false;gpuTransport=null;$('backend').value='cpu';$('gpuOption').disabled=true;buttons();
    $('backendNote').textContent='Connection unavailable — training is disabled.';
    say('Could not reach this app. Retry the public beta app address: https://tiga-rce-ald-tao-gpu.hf.space/. The HF repository page is restricted in Protected mode. No run was started.');
  } finally {clearTimeout(timeout);$('retry').disabled=false;}
}
$('retry').onclick=()=>{if(!busy&&!job)connect();};
connect();


if($('run_export'))$('run_export').onclick=()=>{
  if(!runReceipt)return;
  const cleaned=cleanRunReceipt(runReceipt);if(!cleaned)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(cleaned,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='ald-run-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function activeCleanReceipt(){return cleanRunReceipt(runReceipt)||cleanRunReceipt(portableReceipt);}
function downloadBytes(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadTextFile(text,name,type){downloadBytes(text,name,type);}
function formatPlayerReport(receipt){
  const r=receipt.report,metric=value=>typeof value==='number'?String(value):'Not reported';
  const lines=['ALD driving run report','',`Build: ${receipt.build_id}`,`Backend: ${receipt.backend}`,`Vehicle: ${r.vehicle_name} (Type ${r.vehicle_type})`,`Generations: ${r.generations_completed} / ${r.generations_requested}`,`Population: ${r.population}`,`Elapsed seconds: ${metric(r.elapsed_seconds)}`,`Final-generation population best score: ${metric(r.best_score)}`,`Final-generation population mean score: ${metric(r.mean_score)}`,`Best completed lap observed during this run (may be another car): ${r.best_lap_seconds===null?'None':metric(r.best_lap_seconds)+' s'}`,`Cars completing a lap in the final generation: ${r.lapped_cars===null?'Not reported':r.lapped_cars}`,`Simulated ticks: ${r.simulated_ticks}`,`Input network SHA-256: ${r.inputs.network_sha256}`,`Track SHA-256: ${r.inputs.track_sha256}`,`Output network SHA-256: ${receipt.output_sha256}`,'','Configured training settings:',JSON.stringify(r.settings,null,2),'','Reward weights are configured values; per-reward contribution is not reported by the engine.'];
  if(r.history?.length){lines.push('','Generation history:','Generation | Mutation | Best score | Mean score | Best lap observed in generation | Cars lapped | Simulated ticks');for(const h of r.history)lines.push([h.generation,h.mutation,h.best_score,h.mean_score,h.best_lap_seconds===null?'':h.best_lap_seconds,h.lapped_cars===null?'':h.lapped_cars,h.simulated_ticks].join(' | '));}
  return lines.join('\n')+'\n';
}
const csvCell=value=>{const text=value===null?'':String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
function formatHistoryCsv(receipt){const rows=receipt?.report?.history;if(!Array.isArray(rows)||!rows.length)throw Error('No generation history is available in this receipt');const headers=['generation','mutation','best_score','mean_score','best_lap_seconds_observed_in_generation','lapped_cars','simulated_ticks'];return [headers.map(csvCell).join(','),...rows.map(row=>runHistoryKeys.map(key=>csvCell(row[key])).join(','))].join('\r\n')+'\r\n';}
if($('player_report_download'))$('player_report_download').onclick=()=>{const receipt=activeCleanReceipt();if(receipt)downloadTextFile(formatPlayerReport(receipt),'ald-player-report.txt','text/plain;charset=utf-8');};
if($('history_csv_download'))$('history_csv_download').onclick=()=>{const receipt=activeCleanReceipt();if(receipt?.report?.history?.length)downloadTextFile(formatHistoryCsv(receipt),'ald-generation-history.csv','text/csv;charset=utf-8');};
const bundleMessage=text=>{if($('bundle_status'))$('bundle_status').textContent=text;};
const bundleExact=(value,keys)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...keys].sort().join())throw Error('Unexpected receipt fields');
};
const bundleSettings=value=>{
  const currentKeys=Object.keys(window.RecipeLibrary.defaults),legacyKeys=currentKeys.filter(key=>key!=='freeze');
  const keys=Object.keys(value||{}).sort().join();
  if(keys!==[...currentKeys].sort().join()&&keys!==legacyKeys.sort().join())throw Error('Unexpected recipe settings fields');
  return window.RecipeLibrary.settings(value);
};
const bundleFinite=value=>typeof value==='number'&&Number.isFinite(value);
const runHistoryKeys=['generation','mutation','best_score','mean_score','best_lap_seconds','lapped_cars','simulated_ticks'];
function cleanRunHistory(value){
  if(value===undefined)return undefined;
  if(!Array.isArray(value)||value.length>2000)throw Error('Generation history exceeds its 2,000-row limit');
  return value.map((row,index)=>{
    bundleExact(row,runHistoryKeys);
    if(!Number.isInteger(row.generation)||row.generation!==index+1||row.generation>2000||!bundleFinite(row.mutation)||row.mutation<0||row.mutation>4.2||
       !bundleFinite(row.best_score)||Math.abs(row.best_score)>1e12||!bundleFinite(row.mean_score)||Math.abs(row.mean_score)>1e12||
       !(row.best_lap_seconds===null||(bundleFinite(row.best_lap_seconds)&&row.best_lap_seconds>0&&row.best_lap_seconds<=1e12))||
       !(row.lapped_cars===null||(Number.isInteger(row.lapped_cars)&&row.lapped_cars>=0&&row.lapped_cars<=1024))||
       !Number.isInteger(row.simulated_ticks)||row.simulated_ticks<0||row.simulated_ticks>8000000)throw Error('Generation history contains an invalid value');
    return {generation:row.generation,mutation:row.mutation,best_score:row.best_score,mean_score:row.mean_score,best_lap_seconds:row.best_lap_seconds,lapped_cars:row.lapped_cars,simulated_ticks:row.simulated_ticks};
  });
}
function cleanRunReceipt(source){
  if(!source||!source.report)return null;
  const report=source.report,buildId=source.build_id??source.build?.build_id??report.build?.build_id;
  if(source.version!==1||source.state!=='completed'||typeof buildId!=='string'||buildId.length>128||!['cpu','gpu'].includes(source.backend)||!/^[a-f0-9]{64}$/.test(source.output_sha256))return null;
  const vehicleNames=['Formula','Rally','Snowmobile','Truck'];
  if(!Number.isInteger(report.vehicle_type)||report.vehicle_type<0||report.vehicle_type>3||report.vehicle_name!==vehicleNames[report.vehicle_type]||
     !Number.isInteger(report.generations_completed)||report.generations_completed<0||!Number.isInteger(report.generations_requested)||report.generations_requested<1||
     !Number.isInteger(report.population)||report.population<1||!bundleFinite(report.elapsed_seconds)||report.elapsed_seconds<0||
     !bundleFinite(report.best_score)||!bundleFinite(report.mean_score)||
     !(report.best_lap_seconds===null||(bundleFinite(report.best_lap_seconds)&&report.best_lap_seconds>0))||
     !(report.lapped_cars===null||(Number.isInteger(report.lapped_cars)&&report.lapped_cars>=0))||
     !Number.isInteger(report.simulated_ticks)||report.simulated_ticks<0||!Number.isInteger(report.requested_ticks)||report.requested_ticks<1||report.candidate_validated!==true||
     !['cpu','cuda'].includes(report.execution_backend)||report.execution_backend!==(source.backend==='gpu'?'cuda':'cpu'))return null;
  try{
    bundleExact(report.inputs,['track_sha256','network_sha256']);
    if(!/^[a-f0-9]{64}$/.test(report.inputs.track_sha256)||!/^[a-f0-9]{64}$/.test(report.inputs.network_sha256))return null;
    const recipeSettings={...report.settings},sourceMode=recipeSettings.mode,sourceCleanMinLaps=recipeSettings.clean_min_laps;delete recipeSettings.mode;delete recipeSettings.clean_min_laps;
    const analysisSummary=report.analysis_summary?validateAnalysisSummary(report.analysis_summary):null,mode=analysisSummary?.mode??sourceMode;
    const cleanMinLaps=analysisSummary?.conditions.clean_min_laps??sourceCleanMinLaps??2;
    if((sourceMode!==undefined&&!['train','evaluate'].includes(sourceMode))||(analysisSummary&&sourceMode!==undefined&&sourceMode!==analysisSummary.mode)||
       (sourceCleanMinLaps!==undefined&&(!Number.isInteger(sourceCleanMinLaps)||sourceCleanMinLaps<1||sourceCleanMinLaps>100))||
       (analysisSummary&&sourceCleanMinLaps!==undefined&&sourceCleanMinLaps!==analysisSummary.conditions.clean_min_laps)||!Number.isInteger(cleanMinLaps)||cleanMinLaps<1||cleanMinLaps>100)return null;
    let settings;
    if(mode==='evaluate'){
      if(recipeSettings.population!==1||recipeSettings.generations!==1||recipeSettings.mutation!==0||recipeSettings.mutation_end!==0||recipeSettings.schedule!=='fixed'||recipeSettings.selection!=='best'||recipeSettings.parents!==1||recipeSettings.elite!==0||recipeSettings.crossover!=='none'||recipeSettings.decay!==0||recipeSettings.adaptive_mutation!==false)return null;
      // Check the original frozen values first, then reuse the training schema
      // with positive placeholders only for its training-only mutation rule.
      const checked=bundleSettings({...recipeSettings,mutation:0.01,mutation_end:0.01});
      settings={...checked,mutation:0,mutation_end:0};
    }else settings=bundleSettings(recipeSettings);
    if(mode==='evaluate'&&(settings.freeze.layers.length||settings.freeze.inputs.length||settings.freeze.outputs.length))return null;
    const history=cleanRunHistory(report.history);
    settings.mode=mode??'train';settings.clean_min_laps=cleanMinLaps;
    if(report.population!==settings.population||report.generations_requested!==settings.generations||report.requested_ticks!==settings.ticks||(history&&history.length!==report.generations_completed))return null;
    return {version:1,kind:'run',state:'completed',build_id:buildId,backend:source.backend,output_sha256:source.output_sha256,
      report:{vehicle_type:report.vehicle_type,vehicle_name:report.vehicle_name,generations_completed:report.generations_completed,
        generations_requested:report.generations_requested,population:report.population,elapsed_seconds:report.elapsed_seconds,
        best_score:report.best_score,mean_score:report.mean_score,best_lap_seconds:report.best_lap_seconds,lapped_cars:report.lapped_cars,
        simulated_ticks:report.simulated_ticks,requested_ticks:report.requested_ticks,candidate_validated:true,
        execution_backend:report.execution_backend,inputs:{track_sha256:report.inputs.track_sha256,network_sha256:report.inputs.network_sha256},settings,...(history?{history}:{}),...(analysisSummary?{analysis_summary:analysisSummary}:{})}};
  }catch{return null;}
}
function validatePortableReceipt(receipt,network,track){
  bundleExact(receipt,['version','kind','state','build_id','backend','output_sha256','report']);
  const report=receipt.report,reportKeys=['vehicle_type','vehicle_name','generations_completed','generations_requested','population','elapsed_seconds','best_score','mean_score','best_lap_seconds','lapped_cars','simulated_ticks','requested_ticks','candidate_validated','execution_backend','inputs','settings'];
  if(Object.hasOwn(report,'history'))reportKeys.push('history');
  if(Object.hasOwn(report,'analysis_summary'))reportKeys.push('analysis_summary');
  bundleExact(report,reportKeys);
  const clean=cleanRunReceipt(receipt);
  if(receipt.version!==1||receipt.kind!=='run'||receipt.state!=='completed'||!clean)throw Error('Run receipt failed its allowlist or value checks');
  const inputMatches=network.kind==='input'&&report.inputs.network_sha256===network.sha256;
  const outputMatches=network.kind==='result'&&receipt.output_sha256===network.sha256;
  if(!inputMatches&&!outputMatches)throw Error('Run receipt does not describe the bundled network');
  if(track&&report.inputs.track_sha256!==track.sha256)throw Error('Run receipt does not describe the bundled track');
  return clean;
}
async function validateNetworkBytes(bytes){
  let decoded=bytes;
  if(bytes[0]===31&&bytes[1]===139){
    if(typeof DecompressionStream!=='function')throw Error('This browser cannot validate compressed .evolution files');
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let length=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>4*1024*1024)throw Error('Expanded network exceeds 4 MiB');chunks.push(value);}}
    finally{reader.releaseLock();}
    decoded=new Uint8Array(length);let at=0;for(const chunk of chunks){decoded.set(chunk,at);at+=chunk.byteLength;}
  }
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));window.NetworkEditor.compatible(value);return value;
}
async function validateBundleTrack(track){
  if(!track)return null;
  const file=new File([track.bytes],'portable-track.track',{type:'application/octet-stream'});
  const saved=await window.TrackMap.decode(file);
  const response=await fetch('/assets/track-atlas.json',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('Track preview reference unavailable; bundle was not restored');
  window.TrackMap.model(saved,await response.json());
  return file;
}
async function buildPortableBundle(){
  if(pairedAnalysisPending)throw Error('The paired analysis is still pending; retry the server download before exporting a bundle');
  const api=window.PortableBundle;if(!api)throw Error('Portable bundle support is unavailable');
  const inputNetwork=networkSource(),winner=selectedWinner&&localAnalysis?.winnerNetworks?.[selectedWinner],selected=winner?new Blob([winner.bytes]):inputNetwork||localResult;if(!selected)throw Error('Choose or download a network/result first');
  const kind=winner||!inputNetwork?'result':'input',networkBytes=new Uint8Array(await selected.arrayBuffer());
  await validateNetworkBytes(networkBytes);
  const network=await api.artifact('evolution',kind,networkBytes),artifacts={selected_network:network};
  let selectedTrack=null,trackInfo=null;
  if($('bundle_track').checked){
    const source=await trackSource();if(!source)throw Error('Choose a track before including it');
    const bytes=new Uint8Array(await source.arrayBuffer());trackInfo=trackLibrary?.info()??{source:'upload'};
    selectedTrack=await api.artifact('track','selected',bytes);
    delete selectedTrack.kind;
    if(trackInfo.source==='builtin')Object.assign(selectedTrack,{source:'builtin',track_id:trackInfo.id,display_name:trackInfo.display_name});
    else selectedTrack.source='upload';
    artifacts.selected_track=selectedTrack;
  }
  if($('bundle_recipe').checked){
    const recipe=window.getPortableRecipe?.();if(recipe)artifacts.selected_recipe={version:1,slot:recipe.slot,name:recipe.name,settings:window.RecipeLibrary.settings(recipe.settings)};
  }
  let note='',attachedRunReceipt=false;
  const receiptSource=runReceipt||portableReceipt;
  if($('bundle_receipt').checked&&receiptSource){
    const candidate=cleanRunReceipt(receiptSource);
    const matches=candidate&&((kind==='result'&&candidate.output_sha256===network.sha256)||(kind==='input'&&candidate.report.inputs.network_sha256===network.sha256)||(winner&&localAnalysis?.summary?.winners?.[selectedWinner]?.artifact?.sha256===network.sha256));
    if(matches&&(!trackInfo||trackInfo.source!=='builtin'&&trackInfo.source!=='upload'||!selectedTrack||candidate.report.inputs.track_sha256===selectedTrack.sha256)){artifacts.run_receipt=candidate;attachedRunReceipt=true;}
    else note=' The latest run receipt did not match this selected network/track and was omitted.';
  }
  if(localAnalysis?.archiveBytes&&(kind==='result'||winner)){
    if(attachedRunReceipt)artifacts.analysis_archive=await api.analysisSlot(localAnalysis.archiveBytes);
    else note+=' The analysis archive was omitted because its matching run receipt is not included.';
  }
  const text=await api.pack(artifacts);
  return {text,note};
}
async function buildRunResultBundle(resultBlob,sourceReceipt,context){
  if(pairedAnalysisPending)throw Error('The paired analysis is still pending; retry the server download before saving this run');
  if(!(resultBlob instanceof Blob)||!sourceReceipt||!context?.trackBytes)throw Error('The completed run data is not available for a verified bundle');
  const networkBytes=new Uint8Array(await resultBlob.arrayBuffer()),trackBytes=context.trackBytes;
  await validateNetworkBytes(networkBytes);
  const api=window.PortableBundle,network=await api.artifact('evolution','result',networkBytes);
  const track=await api.artifact('track','selected',trackBytes);delete track.kind;
  const info=context.trackInfo??{source:'upload'};
  if(info.source==='builtin')Object.assign(track,{source:'builtin',track_id:info.id,display_name:info.display_name});else track.source='upload';
  await validateBundleTrack({bytes:trackBytes,metadata:track});
  const receipt=cleanRunReceipt(sourceReceipt);
  if(!receipt?.report?.history?.length)throw Error('The completed run has no validated generation history to save');
  if(receipt.output_sha256!==network.sha256||receipt.report.inputs.network_sha256!==context.inputNetworkSha256||receipt.report.inputs.track_sha256!==track.sha256)throw Error('The saved run log does not match the verified network and track bytes');
  validatePortableReceipt(receipt,network,track);
  const artifacts={selected_network:network,selected_track:track,run_receipt:receipt};
  if(localAnalysis?.archiveBytes){
    if(!receipt.report.analysis_summary)throw Error('The analysis archive cannot be saved without its matching validated summary');
    if(localAnalysis.mode==='train'&&localAnalysis.winnerNetworks?.fitness?.sha256!==network.sha256)throw Error('The primary network does not match the archived fitness winner');
    if(localAnalysis.mode==='evaluate'&&localAnalysis.summary.conditions.network_sha256!==network.sha256)throw Error('The frozen result does not match the submitted policy');
    artifacts.analysis_archive=await api.analysisSlot(localAnalysis.archiveBytes);
  }
  const text=await api.pack(artifacts);
  return {text,receipt,network,track};
}
async function saveVerifiedRunToBucket(snapshot,context){
  if(!bucketSnapshotCurrent(snapshot))throw Error('Candidate is safe in this page, but the bucket connection changed before saving. Reconnect and save it manually.');
  const bundle=await buildRunResultBundle(localResult,runReceipt,context);
  if(!bucketSnapshotCurrent(snapshot))throw Error('Candidate is safe in this page, but the bucket connection changed before saving. Reconnect and save it manually.');
  context.bucketSaveStarted=true;
  const saved=await saveBucketBundleText(bundle.text,snapshot);
  if(!bucketSnapshotCurrent(snapshot))throw Error('Bucket connection changed after the save; the old response was ignored. Candidate remains available in this page.');
  return {saved,bundle};
}
async function receiveAndAutosave(currentJob,snapshot,context){
  const received=await receive(currentJob);
  localResult=new Blob([received.bytes]);localAnalysis=received.analysis;context.analysisArchiveBytes=received.analysisBytes;context.localVerified=true;renderAnalysisPanel();buttons();
  const acknowledgment=await acknowledge(currentJob,received);
  if(acknowledgment.deleted!==true)throw Error('Candidate was verified, but server deletion was not confirmed; the bucket save was skipped. Download or delete the server result manually.');
  context.serverDeleted=true;
  if(runReceipt)runReceipt.delivery={received_and_hash_verified:true,server_copy_deleted:true};
  if(job===currentJob)job=null;buttons();
  if(localAnalysis?.mode==='evaluate')await addFrozenEvaluation();
  const outcome=await saveVerifiedRunToBucket(snapshot,context);context.bucketSaveConfirmed=true;return outcome;
}
async function exportPortableBundle(){
  const {text,note}=await buildPortableBundle(),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='ald-portable-bundle.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  bundleMessage('Portable bundle downloaded to this device. It has not been uploaded or saved by the app.'+note);
}
if($('bundle_export'))$('bundle_export').onclick=async()=>{
  try{await exportPortableBundle();}catch(error){bundleMessage('Bundle not exported: '+error.message);}
};
async function preparePortableText(text){
  if(new TextEncoder().encode(text).byteLength>window.PortableBundle.LIMITS.bundle)throw Error('Portable bundle exceeds 48 MiB');
  const parsed=await window.PortableBundle.parse(text);
  await validateNetworkBytes(parsed.network.bytes);
  if(parsed.analysisArchive){
    if(!parsed.receipt?.report?.analysis_summary)throw Error('Version 2 analysis bundles need their matching sanitized run summary');
    parsed.analysis=await parseRunAnalysisArchive(parsed.analysisArchive.bytes,{size:parsed.analysisArchive.bytes.byteLength,sha256:parsed.analysisArchive.sha256,format:parsed.analysisArchive.format},parsed.receipt.report.analysis_summary);
    const summary=parsed.analysis.summary,selectedHash=parsed.network.sha256,fitnessHash=summary.winners.fitness.status==='available'?summary.winners.fitness.artifact.sha256:null;
    const selectedIsWinner=Object.values(parsed.analysis.winnerNetworks).some(w=>w.sha256===selectedHash);
    if(summary.mode==='evaluate'&&selectedHash!==summary.conditions.network_sha256)throw Error('Frozen evaluation bundle network does not match its unchanged input');
    if(summary.mode==='train'&&selectedHash!==fitnessHash&&!selectedIsWinner)throw Error('Selected network is not the primary result or a verified winner from this analysis');
    if(parsed.receipt.output_sha256!==fitnessHash&&summary.mode==='train')throw Error('Run receipt output does not match the fitness leader in its analysis');
  }
  if(parsed.track){
    if(parsed.track.metadata.source==='builtin'){
      const entry=trackLibrary?.entries().find(e=>e.id===parsed.track.metadata.track_id);
      if(!entry||entry.display_name!==parsed.track.metadata.display_name||entry.bytes!==parsed.track.bytes.byteLength||entry.sha256!==parsed.track.metadata.sha256)throw Error('Built-in track does not match this app’s catalog');
    }
    parsed.track.file=await validateBundleTrack(parsed.track);
  }
  if(parsed.recipe)parsed.recipe.settings=bundleSettings(parsed.recipe.settings);
  if(parsed.receipt){
    if(parsed.analysis){
      const clean=cleanRunReceipt(parsed.receipt);if(!clean)throw Error('Run receipt failed its allowlist or value checks');
      if(parsed.receipt.report.inputs.track_sha256!==parsed.track?.metadata?.sha256&&parsed.track)throw Error('Run receipt does not describe the bundled track');
      if(parsed.receipt.report.analysis_summary?.conditions?.network_sha256!==parsed.receipt.report.inputs.network_sha256)throw Error('Analysis summary does not describe the receipt input');
      parsed.receipt=clean;
    }else parsed.receipt=validatePortableReceipt(parsed.receipt,parsed.network,parsed.track?.metadata);
  }
  let trackTransfer=null;
  if(parsed.track?.metadata.source==='upload'){
    if(typeof DataTransfer!=='function')throw Error('This browser cannot stage an uploaded track; no bundle data was applied');
    trackTransfer=new DataTransfer();trackTransfer.items.add(parsed.track.file);
  }
  return {parsed,trackTransfer,networkFile:new File([parsed.network.bytes],'portable-network.evolution',{type:'application/octet-stream'})};
}
async function applyPreparedPortable(prepared,{isCurrent=null}={}){
  const {parsed,trackTransfer,networkFile}=prepared;
  if(busy||job)throw Error('A run started while the bundle was being validated; no bundle data was applied');
  if(isCurrent&&!isCurrent())throw Error('Bucket connection changed while the bundle was being validated; no bundle data was applied');
  if(parsed.track){
    if(parsed.track.metadata.source==='builtin'){
      const picker=$('trackPresetDrive');picker.value=parsed.track.metadata.track_id;picker.dispatchEvent(new Event('change',{bubbles:true}));
    }else{
      $('track').files=trackTransfer.files;$('track').dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  window.TrainingClient.useNetwork(networkFile);
  if(parsed.recipe)window.stagePortableRecipe(parsed.recipe);
  portableReceipt=parsed.receipt||null;runDisplayContext=null;
  localAnalysis=parsed.analysis||null;selectedWinner=null;renderAnalysisPanel();
  $('bundle_receipt_download').disabled=!portableReceipt;
  bundleMessage('Bundle restored in this page only. Network and optional track/recipe are staged; no run started and no browser storage or server was changed.'+(portableReceipt?' Sanitized receipt is available for separate download.':''));
  buttons();
}
async function restorePortableText(text,{lockHeld=false,isCurrent=null}={}){
  if((bundleRestoring&&!lockHeld)||busy||job)throw Error('Finish the active run before restoring a bundle');
  const prepared=await preparePortableText(text);
  await applyPreparedPortable(prepared,{isCurrent});
  return prepared;
}
if($('bundle_import'))$('bundle_import').onchange=async()=>{
  const input=$('bundle_import'),file=input.files?.[0];if(!file)return;let restoreId=null;
  try{
    if(bundleRestoring||busy||job)throw Error('Finish the active run before restoring a bundle');
    restoreId=++bundleRestoreId;bundleRestoring=true;buttons();
    if(file.size>window.PortableBundle.LIMITS.bundle)throw Error('Portable bundle exceeds 48 MiB');
    await restorePortableText(await file.text(),{lockHeld:true});
  }catch(error){bundleMessage('Bundle not restored: '+error.message+'. The existing selections were left unchanged.');}
  finally{if(restoreId===bundleRestoreId)bundleRestoring=false;buttons();input.value='';}
};
if($('bundle_receipt_download'))$('bundle_receipt_download').onclick=()=>{
  if(!portableReceipt)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(portableReceipt,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='ald-run-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};


