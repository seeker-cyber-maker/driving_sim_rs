'use strict';
// Official HF PKCE redirect helpers. Only the one-use verifier crosses navigation;
// OAuth access tokens and profile details stay in this page's memory.
(() => {
  const node=id=>document.getElementById(id),flowKey='tiga.ald.hf.pkce.v1';
  const identityScopes=['openid','profile'],storageScopes=['openid','profile','write-repos'];
  let session=null,storageSession=null,locked=false,ready=false,config=null,exchanging=false;
  const message=text=>{node('hfIdentity').textContent=text;};
  const storageMessage=text=>{node('bucket_auth_status').textContent=text;};
  const scopeSet=value=>{
    if(typeof value!=='string'||!value.trim())return null;
    const items=value.trim().split(/\s+/),set=new Set(items);
    return set.size===items.length?set:null;
  };
  const exactScopes=(value,expected)=>{
    const scopes=scopeSet(value);
    return !!scopes&&scopes.size===expected.length&&expected.every(scope=>scopes.has(scope));
  };
  const storageEnabled=()=>ready&&config?.storage_enabled===true&&exactScopes(config.storage_scopes,storageScopes);
  function emitChange(){window.dispatchEvent(new Event('hf-auth-change'));}
  function render(){
    const anySession=!!session||!!storageSession;
    node('hfSignIn').hidden=!!session;
    node('hfSignIn').disabled=locked||exchanging||!ready;
    node('hfAccount').hidden=!session;
    node('hfAccount').textContent=session?'Connected as '+session.userInfo.preferred_username:'';
    node('hfSignOut').hidden=!anySession;
    node('hfSignOut').disabled=locked||exchanging||!anySession;
    node('hfSignOut').textContent=session?'Disconnect account':'Disconnect HF access';
    node('hfVerify').hidden=!session;
    node('hfVerify').disabled=locked||exchanging||!session;
    const authorize=node('bucket_authorize');
    if(authorize){authorize.hidden=!storageEnabled()||!!storageSession;authorize.disabled=locked||exchanging||!storageEnabled()||!!storageSession;}
    if(node('bucket_auth_unavailable'))node('bucket_auth_unavailable').hidden=storageEnabled();
    getStorageToken();
    if(node('bucket_auth_status'))node('bucket_auth_status').textContent=storageSession
      ?'HF bucket access authorized as '+storageSession.userInfo.preferred_username+'. Choose your private bucket below.'
      :'Not authorized. Bucket storage is optional.';
  }
  function clearAll(){session=null;storageSession=null;emitChange();render();}
  function clearStorage(){
    if(!storageSession)return;
    if(session===storageSession)session=null;
    storageSession=null;emitChange();render();
  }
  function getStorageToken(){
    if(storageSession&&storageSession.accessTokenExpiresAt.getTime()<=Date.now()){
      if(session===storageSession)session=null;
      storageSession=null;emitChange();storageMessage('HF authorization expired. Sign in or authorize access again to reconnect.');
      render();return null;
    }
    return storageSession?.accessToken??null;
  }
  window.HFAuth={
    get storageEnabled(){return storageEnabled();},
    get storageAuthorized(){return !!getStorageToken();},
    setBusy(value){locked=value;render();},
    credentials(){
      if(exchanging)throw Error('Complete HF sign-in before starting GPU');
      if(session&&session.accessTokenExpiresAt.getTime()<=Date.now()){
        clearAll();message('HF sign-in expired. Sign in again before an account GPU request.');
        throw Error('HF sign-in expired; sign in again');
      }
      return session?{token:session.accessToken}:{};
    },
    getStorageToken,
    getStorageUsername(){return getStorageToken()?storageSession.userInfo.preferred_username:null;},
    clearStorageAuthorization:clearStorage,
    verify(identity){
      if(session&&(!identity.authenticated||identity.auth_path!=='queue-bearer'||identity.username!==session.userInfo.preferred_username))
        throw Error('GPU queue visitor identity did not match your HF sign-in; no GPU request started');
      if(session)message('Account connection checked. GPU use remains subject to your HF allowance.');
    }
  };
  node('hfSignOut').onclick=()=>{clearAll();message('HF access disconnected from this app. CPU remains available. HF website sign-in is unchanged.');storageMessage('HF access disconnected. Authorize bucket access again to use storage.');};
  node('hfVerify').onclick=async()=>{
    try{await window.TrainingClient.verifyIdentity();}
    catch{message('Account connection check failed. No GPU request started. Disconnect and sign in again, or use CPU.');}
  };
  async function authorize(purpose){
    if(locked||exchanging||!ready)return;
    if(purpose==='storage'&&!storageEnabled())return;
    if(window.TrainingClient?.hasUnsavedState?.() &&
       !(await window.appConfirm('HF authorization navigates away. Selected files, a downloaded result and unsaved editor changes are lost; saved recipes remain. Continue, then reselect or recreate them?',{heading:'Continue to HF authorization',confirmLabel:'Continue to HF'})))return;
    exchanging=true;render();
    try{
      const state={},requested=purpose==='storage'?storageScopes:identityScopes;
      const helpers=await import('/hf-oauth.js');
      const url=await helpers.oauthLoginUrl({clientId:config.client_id,scopes:requested.join(' '),
        redirectUrl:location.origin+'/',localStorage:state});
      sessionStorage.setItem(flowKey,JSON.stringify({...state,started:Date.now(),purpose}));
      if(purpose==='storage')storageMessage('Opening HF permission request for bucket access. No password or personal token is entered here.');
      else message('Opening Hugging Face sign-in. No password or personal token is entered here.');
      location.href=url;
    }catch{
      exchanging=false;render();
      const text='HF authorization could not start. Tab-local sign-in storage is required; local export and CPU remain available.';
      if(purpose==='storage')storageMessage(text);else message(text);
    }
  }
  node('hfSignIn').onclick=()=>authorize('identity');
  node('bucket_authorize').onclick=()=>authorize('storage');
  const returned=location.href,params=new URL(returned).searchParams;
  const isCallback=params.has('code')||params.has('error');
  if(isCallback){history.replaceState(null,'','/');exchanging=true;}
  fetch('/api/auth/config',{cache:'no-store',credentials:'same-origin'}).then(async response=>{
    if(!response.ok)throw Error();config=await response.json();ready=config.enabled===true;
    if(isCallback){
      let flow;
      try{flow=JSON.parse(sessionStorage.getItem(flowKey));}
      finally{sessionStorage.removeItem(flowKey);}
      if(!ready||!flow?.nonce||!flow?.codeVerifier||!Number.isFinite(flow.started)||Date.now()-flow.started>300000||flow.started>Date.now()||!['identity','storage'].includes(flow.purpose))throw Error();
      if(flow.purpose==='storage'&&!storageEnabled())throw Error();
      const helpers=await import('/hf-oauth.js');
      const result=await helpers.oauthHandleRedirect({redirectedUrl:returned,nonce:flow.nonce,codeVerifier:flow.codeVerifier});
      flow.nonce=null;flow.codeVerifier=null;
      const allowed=flow.purpose==='storage'?storageScopes:identityScopes;
      if(!exactScopes(result.scope,allowed))throw Error();
      if(!result.accessToken||!result.userInfo?.preferred_username||!Number.isFinite(result.accessTokenExpiresAt?.getTime())||result.accessTokenExpiresAt.getTime()<=Date.now())throw Error();
      if(flow.purpose==='storage'){
        // The optional storage grant includes the ordinary identity scopes. Reuse
        // this one page-memory grant for both purposes so the user signs in once.
        session=result;storageSession=result;emitChange();
        storageMessage('HF bucket access authorized as '+result.userInfo.preferred_username+'. Choose your existing private bucket below.');
      }else{
        session=result;storageSession=null;emitChange();
        message('Account connected. You can choose GPU; your account is checked automatically before the run.');
      }
    }else{
      sessionStorage.removeItem(flowKey);
      message(ready?'CPU needs no sign-in. For your account GPU allowance, sign in before choosing files.':
        'HF sign-in is not configured on this deployment. CPU remains anonymous.');
      storageMessage(storageEnabled()?'Not authorized. Bucket storage is optional.':
        'HF storage authorization is unavailable on this deployment. Local bundle export remains available.');
    }
  }).catch(()=>{
    try{sessionStorage.removeItem(flowKey);}catch{}
    clearAll();message('HF sign-in unavailable, cancelled, expired, or not verified. No GPU request started; CPU remains anonymous.');
    storageMessage('HF authorization unavailable, cancelled, expired, or not verified. Bucket storage remains disconnected; local export is available.');
  }).finally(()=>{exchanging=false;render();});
  setInterval(()=>{
    let changed=false;
    if(session&&session.accessTokenExpiresAt.getTime()<=Date.now()){
      session=null;message('HF sign-in expired. Sign in again to identify account GPU requests. CPU remains available.');changed=true;
    }
    if(storageSession&&storageSession.accessTokenExpiresAt.getTime()<=Date.now()){
      storageSession=null;storageMessage('HF bucket authorization expired. Authorize access again to reconnect.');changed=true;
    }
    if(changed){emitChange();render();}
  },1000);
  render();
})();
