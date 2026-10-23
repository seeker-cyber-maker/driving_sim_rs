'use strict';
// The browser-local agent surface delegates to the same guarded UI controllers.
// It intentionally exposes no job, credential, bucket, deletion or arbitrary-selector action.
(() => {
  const q=id=>document.getElementById(id);
  const sections=['drive','training','batch','editor'];
  const controls={create_starter:'starter_create',inspect_selected_network:'editor_import'};
  let toolSupport='unavailable',agentBusy=false;
  const option=id=>{const node=q(id);return node?.selectedOptions?.[0]?.textContent?.trim()||null;};
  function readState(){
    const file=window.TrainingClient?.getSelectedNetwork?.();
    return {
      schema:'ald.agent-state',version:1,
      section:document.querySelector('.tabs [aria-selected="true"]')?.dataset.tab||'drive',
      network:{selected:!!file,name:file?(file.name||'Latest received result'):null},
      track:option('trackPresetDrive'),compute:option('backend'),
      run:{enabled:!!q('run')&&!q('run').disabled,label:q('run')?.textContent.trim()||null,status:q('status')?.textContent.trim()||null},
      editor:{state:q('editor_status')?.dataset.state||'idle',message:q('editor_status')?.textContent.trim()||null,network:q('editor_metadata')?.textContent.trim()||null},
      busy:agentBusy||!!window.TrainingClient?.isBusy?.(),
      webmcp:toolSupport,
      actions:{get_state:true,open_section:true,create_starter:!agentBusy&&!!q('starter_create')&&!q('starter_create').disabled,inspect_selected_network:!agentBusy&&!!q('editor_import')&&!q('editor_import').disabled}
    };
  }
  function render(){const node=q('agent_state');if(node){const text=JSON.stringify(readState(),null,2);if(node.textContent!==text)node.textContent=text;}}
  function exact(input,keys){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key)))throw Error('Invalid action arguments');
  }
  async function act(action,input={}){
    exact(input,action==='open_section'?['section']:[]);
    if(action==='get_state')return readState();
    if(action==='open_section'){
      if(!sections.includes(input.section))throw Error('Choose drive, training, batch or editor');
      window.LabNavigation.openSection(input.section);return readState();
    }
    const id=controls[action];if(!id)throw Error('Unknown local action');
    if(agentBusy||window.TrainingClient?.isBusy?.()||!q(id)||q(id).disabled)throw Error('This control is unavailable; read the current state first');
    agentBusy=true;render();
    try{
      if(action==='create_starter'){
        window.LabNavigation.openSection('drive');
        await window.TrainingClient.createStarter();
      }else{
        window.LabNavigation.openSection('editor');
        await window.NetworkEditorUI.inspectSelected();
      }
    }finally{agentBusy=false;render();}
    return readState();
  }
  window.ALDLabAgent=Object.freeze({version:1,readState,act});
  // Keep fallback state visible and current without inspecting cookies or tokens.
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});};
  const observer=new MutationObserver(records=>{
    if(records.some(record=>!q('agent_state')?.contains(record.target)&&record.target!==q('agent_state')))schedule();
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-selected','data-state']});
  document.addEventListener('change',schedule);document.addEventListener('input',schedule);
  window.addEventListener('ald:editor-status',schedule);window.addEventListener('ald:section-change',schedule);
  const definitions=[
    {name:'ald_get_state',title:'Read ALD lab state',description:'Read the current tab, selected driver name, track, compute choice, readiness and visible status. No credentials, weights or job identifiers are returned.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>JSON.stringify(await act('get_state',input))},
    {name:'ald_open_section',title:'Open an ALD lab section',description:'Open a local lab tab and bring its heading into view. Does not start a job or save data.',inputSchema:{type:'object',properties:{section:{type:'string',enum:sections}},required:['section'],additionalProperties:false},execute:async input=>JSON.stringify(await act('open_section',input))},
    {name:'ald_create_starter',title:'Create a local starter driver',description:'Create and select a small starter for the current Starter car. Uses the same UI confirmation when replacing a selection. Does not train, upload or save data.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async input=>JSON.stringify(await act('create_starter',input))},
    {name:'ald_inspect_selected_network',title:'Inspect the selected ALD driver',description:'Open the editor and inspect the active driver or chosen editor file. Read the returned editor state for success or error. Does not change the active driver or original weights.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{untrustedContentHint:true},execute:async input=>JSON.stringify(await act('inspect_selected_network',input))}
  ];
  async function register(){
    const context=document.modelContext;
    if(typeof context?.registerTool!=='function'){
      q('agent_tools_status').textContent='Browser tools are unavailable here. Use the action manifest, stable controls and current state below.';
      render();return;
    }
    try{
      for(const tool of definitions)await context.registerTool(tool);
      toolSupport='registered';
      q('agent_tools_status').textContent='Four browser-local WebMCP tools registered. The same actions remain available through the visible controls.';
    }catch{
      toolSupport='registration-failed';
      q('agent_tools_status').textContent='Browser tool registration was incomplete. Use the action manifest and visible controls.';
    }
    render();
  }
  render();register();
})();
