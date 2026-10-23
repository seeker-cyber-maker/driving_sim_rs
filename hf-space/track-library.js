/* Read-only public reference library. No cookies or browser-persistent storage. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.TrackLibrary=factory();
})(typeof window==='undefined'?this:window,function(){
  function create({fetch,digest,upload}){
    let entries=[],selected='',cached=null;
    return {
      async load(){
        const response=await fetch('/api/tracks',{cache:'no-store',credentials:'same-origin'});
        if(!response.ok)throw Error('Built-in track catalog unavailable');
        const catalog=await response.json();
        if(!Array.isArray(catalog.tracks)||catalog.tracks.length>128)throw Error('Invalid track catalog');
        const ids=new Set();
        for(const entry of catalog.tracks){
          if(!/^[a-z0-9-]{1,80}$/.test(entry.id)||ids.has(entry.id)||
             typeof entry.display_name!=='string'||!entry.display_name.length||entry.display_name.length>100||
             !Number.isInteger(entry.bytes)||entry.bytes<1||entry.bytes>1048576||
             !/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid track catalog');
          ids.add(entry.id);
        }
        entries=catalog.tracks.map(entry=>({...entry}));
        return this.entries();
      },
      entries:()=>entries.map(entry=>({...entry})),
      selected:()=>selected,
      select(id){
        if(id&&!entries.some(entry=>entry.id===id))throw Error('Unknown built-in track');
        if(id!==selected)cached=null;
        selected=id;
      },
      info(){const entry=entries.find(entry=>entry.id===selected);return entry?{source:'builtin',...entry}:{source:'upload'};},
      async file(){
        if(!selected)return upload();
        const entry=entries.find(entry=>entry.id===selected);
        if(cached?.id===selected)return cached.blob;
        const response=await fetch('/api/tracks/'+encodeURIComponent(selected)+'/file',
                                   {cache:'no-store',credentials:'same-origin'});
        if(!response.ok)throw Error('Built-in track unavailable; retry or choose an upload');
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength!==entry.bytes||await digest(bytes)!==entry.sha256)
          throw Error('Built-in track validation failed');
        const blob=new Blob([bytes],{type:'application/octet-stream'});
        cached={id:entry.id,blob};return blob;
      }
    };
  }
  function mount({document,fetch,digest}){
    const selects=Array.from(document.querySelectorAll('[data-track-library]'));
    const statuses=Array.from(document.querySelectorAll('[data-track-status]'));
    const input=document.getElementById('track');
    const picker=create({fetch,digest,upload:()=>input.files[0]});
    let ready=false,busy=false;
    function changed(){
      if(typeof document.dispatchEvent==='function'&&document.defaultView?.Event)
        document.dispatchEvent(new document.defaultView.Event('track-library-change'));
    }
    function render(message){
      for(const select of selects){select.value=picker.selected();select.disabled=busy||!ready;}
      const info=picker.info();
      for(const status of statuses)status.textContent=message??(info.source==='builtin'?
        info.display_name+' selected. It remains selected after a run.':
        'Upload mode selected. Built-in replicas can be selected instead.');
    }
    for(const select of selects)select.addEventListener('change',()=>{
      picker.select(select.value);if(select.value)input.value='';render();changed();
    });
    input.addEventListener('change',()=>{picker.select('');render();changed();});
    picker.setBusy=value=>{busy=value;render();};
    picker.load().then(()=>{
      for(const select of selects){
        for(const entry of picker.entries()){
          const option=document.createElement('option');option.value=entry.id;
          option.textContent=entry.display_name;select.append(option);
        }
      }
      ready=picker.entries().length>0;
      if(ready)picker.select(picker.entries()[0].id);
      render(ready?undefined:'No built-in tracks in this installation. Custom uploads still work.');
      changed();
    }).catch(()=>render('Built-in catalog unavailable. Custom uploads still work.'));
    return picker;
  }
  return {create,mount};
});
