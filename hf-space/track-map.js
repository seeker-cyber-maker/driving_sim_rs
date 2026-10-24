/* Browser-only preview of the selected saved track. No upload for preview. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root);
  else root.TrackMap=factory(root);
})(typeof window==='undefined'?this:window,function(root){
  const maskPlanner=typeof module==='object'&&module.exports?require('./track-mask.js'):root.TrackMask;
  const COLOURS=['#607e96','#b89561','#b9d9ed'];
  const NAMES=['Asphalt','Dirt','Ice'];
  const VECTOR=/^Vector2i\((-?\d+),\s*(-?\d+)\)$/;
  function vector(value){
    const match=typeof value==='string'&&VECTOR.exec(value);
    if(!match)throw Error('Track has invalid tile coordinates');
    const x=Number(match[1]),y=Number(match[2]);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>1000||Math.abs(y)>1000)
      throw Error('Track coordinates exceed preview bounds');
    return [x,y];
  }
  function connection(value,message='Track has an invalid piece connection'){
    if(!value||typeof value!=='object'||Array.isArray(value)||
       !Number.isInteger(value.side)||value.side<0||value.side>3||
       !Number.isInteger(value.index)||value.index<0||value.index>2||
       !Number.isInteger(value.type)||value.type<0)throw Error(message);
    return {side:value.side,index:value.index,type:value.type};
  }
  function connectionPoint(value,x,y,size){
    const {side,index}=connection(value);
    // Native Connection.position uses offsets 128,384,640 in a 768-unit tile.
    // Shared boundaries keep adjacent path endpoints and the saved start aligned.
    const offset=[128,384,640][index]/768*size;
    switch(side){
      case 0:return [x+offset,y];
      case 1:return [x+offset,y+size];
      case 2:return [x,y+offset];
      case 3:return [x+size,y+offset];
    }
  }
  function connectionControl(own,other,point,target){
    // Native TrackUtils.GetPathCurve (random_track.rs, b90b8af): each
    // connection's inward normal sets its cubic handle, adjusted by port type.
    // At the exit this is the next tile's negated entry normal, so the same
    // per-tile construction also preserves the curve when endpoints reverse.
    const [nx,ny]=[[0,1],[0,-1],[1,0],[-1,0]][own.side];
    const dx=target[0]-point[0],dy=target[1]-point[1];
    const angle=own.type===1?Math.PI/4:own.type===3?Math.atan2(128,384):own.type===4?Math.atan2(384,128):0;
    const rotation=Math.sign(nx*dy-ny*dx)*angle;
    const c=Math.cos(rotation),s=Math.sin(rotation);
    const smoothness=[0,2,100].includes(own.type)&&[1,3,4].includes(other.type)?0.2:0.5;
    const reach=Math.hypot(dx,dy)*smoothness;
    return [point[0]+(nx*c-ny*s)*reach,point[1]+(nx*s+ny*c)*reach];
  }
  async function decode(file){
    if(!file||file.size<1||file.size>1048576)throw Error('Choose a .track file under 1 MB');
    if(typeof DecompressionStream!=='function')throw Error('This browser cannot preview gzip tracks');
    const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks=[];let total=0;
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        total+=value.byteLength;
        if(total>2*1024*1024)throw Error('Track preview exceeds the 2 MB expanded limit');
        chunks.push(value);
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(total);let at=0;
    for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }
  function model(saved,atlas){
    const entries=Object.entries(saved?.Tiles??{});
    if(entries.length<1||entries.length>256)throw Error('Track has no previewable tiles');
    const tiles=entries.map(([position,item])=>{
      const [x,y]=vector(position);
      const id=item?.Block?.TileSetId;
      const block=atlas?.blocks?.[`${id?.AtlasId}:${id?.AlternativeId}`];
      if(!block||![0,1,2].includes(block.surface))throw Error('Track uses a piece not in the simulator atlas');
      if(!Array.isArray(block.connections)||block.connections.length!==2)throw Error('Track piece connections are unavailable');
      const polygons=block.polygons;
      if(polygons!==undefined&&(!Array.isArray(polygons)||polygons.length>32||polygons.some(p=>!Array.isArray(p)||p.length<3||p.length>128||p.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||Math.abs(n)>384)))))
        throw Error('Track wall geometry is invalid');
      return {x,y,surface:block.surface,connections:block.connections.map(value=>connection(value)),
        polygons:polygons?.map(p=>p.map(([px,py])=>[px+x*768+384,py+y*768+384]))};
    });
    if(new Set(tiles.map(t=>`${t.x},${t.y}`)).size!==tiles.length)throw Error('Duplicate track tile');
    const start=vector(saved.StartTileCoords);
    const startTile=tiles.find(tile=>tile.x===start[0]&&tile.y===start[1]);
    if(!startTile)throw Error('Start tile is not present in this track');
    const startConnection=connection({side:saved.StartTileConnection?.Side,index:saved.StartTileConnection?.Index,type:saved.StartTileConnection?.Type},'Track has an invalid or missing start connection');
    if(!startTile.connections.some(item=>item.side===startConnection.side&&item.index===startConnection.index&&item.type===startConnection.type))
      throw Error('Saved start connection does not match the start tile');
    const minX=Math.min(...tiles.map(t=>t.x)),maxX=Math.max(...tiles.map(t=>t.x));
    const minY=Math.min(...tiles.map(t=>t.y)),maxY=Math.max(...tiles.map(t=>t.y));
    if(maxX-minX>30||maxY-minY>30)throw Error('Track preview is too large');
    return {tiles,start,startConnection,bounds:{minX,maxX,minY,maxY}};
  }
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function projectPoint(p,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
    return [a[0]+t*dx,a[1]+t*dy];
  }
  function insidePolygon(point,polygon){
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function segmentDistance(a,b,c,d){
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
    if(ac*ad<0&&ca*cb<0)return 0;
    return Math.min(distance(a,projectPoint(a,c,d)),distance(b,projectPoint(b,c,d)),distance(c,projectPoint(c,a,b)),distance(d,projectPoint(d,a,b)));
  }
  function routePoints(track){
    const byTile=new Map(track.tiles.map(t=>[`${t.x},${t.y}`,t]));
    const equal=(a,b)=>a.side===b.side&&a.index===b.index&&a.type===b.type;
    let tile=byTile.get(track.start.join(',')),incoming=track.startConnection;
    const visited=new Set(),points=[],neighbors=[[0,-1],[0,1],[-1,0],[1,0]];
    while(tile&&!visited.has(`${tile.x},${tile.y}`)){
      visited.add(`${tile.x},${tile.y}`);
      if(!tile.connections.some(c=>equal(c,incoming)))throw Error('The saved route has an incompatible connection');
      const outgoing=tile.connections.find(c=>!equal(c,incoming));
      if(!outgoing)throw Error('The saved route has no exit');
      const a=connectionPoint(incoming,tile.x*768,tile.y*768,768),b=connectionPoint(outgoing,tile.x*768,tile.y*768,768);
      const p=connectionControl(incoming,outgoing,a,b),q=connectionControl(outgoing,incoming,b,a);
      for(let i=0;i<32;i++){
        const t=i/32,s=1-t;
        points.push([s*s*s*a[0]+3*s*s*t*p[0]+3*s*t*t*q[0]+t*t*t*b[0],s*s*s*a[1]+3*s*s*t*p[1]+3*s*t*t*q[1]+t*t*t*b[1]]);
      }
      const step=neighbors[outgoing.side];
      tile=byTile.get(`${tile.x+step[0]},${tile.y+step[1]}`);
      incoming={...outgoing,side:outgoing.side^1};
    }
    if(!tile||tile.x!==track.start[0]||tile.y!==track.start[1]||!equal(incoming,track.startConnection))throw Error('The saved route does not close at its starting connection');
    points.push(points[0]);
    const lengths=[0];
    for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+distance(points[i-1],points[i]));
    const length=lengths[lengths.length-1];
    if(!Number.isFinite(length)||length<100)throw Error('The saved route has no usable length');
    const count=Math.min(2048,Math.max(32,Math.ceil(length/64))),sampled=[];
    let at=0;
    for(let i=0;i<count;i++){
      const target=length*i/count;
      while(at+1<lengths.length-1&&lengths[at+1]<target)at++;
      const t=(target-lengths[at])/(lengths[at+1]-lengths[at]);
      sampled.push(points[at].map((v,axis)=>v+t*(points[at+1][axis]-v)));
    }
    return {points:sampled,route_tiles:visited.size};
  }
  function referenceLine(track){if(!maskPlanner)throw Error('Road-mask planner unavailable');return maskPlanner.line(track);}
  function referenceDistance(point,line){
    if(!line?.points?.length)return null;
    let best=null;
    line.points.forEach((a,i)=>{
      const projected=projectPoint(point,a,line.points[(i+1)%line.points.length]),d=distance(point,projected);
      if(!best||d<best.distance)best={distance:d,point:projected};
    });
    return best;
  }
  function render(canvas,track){
    const context=canvas.getContext('2d');
    if(!context)throw Error('Canvas preview unavailable');
    const w=canvas.width,h=canvas.height;
    context.clearRect(0,0,w,h);
    context.fillStyle='#0c1926';context.fillRect(0,0,w,h);
    const b=track.bounds,columns=b.maxX-b.minX+1,rows=b.maxY-b.minY+1;
    const size=Math.min(160,(w-70)/columns,(h-70)/rows);
    const left=(w-columns*size)/2,top=(h-rows*size)/2;
    for(const tile of track.tiles){
      const x=left+(tile.x-b.minX)*size,y=top+(tile.y-b.minY)*size;
      context.fillStyle=COLOURS[tile.surface];
      // Physical part mask: a full tile with each native wall polygon removed.
      // No guessed rounded pavement or artificial gaps at tile joins.
      context.fillRect(x,y,size,size);
      for(const polygon of tile.polygons??[]){
        context.beginPath();
        polygon.forEach(([px,py],i)=>{const p=[x+(px-tile.x*768)/768*size,y+(py-tile.y*768)/768*size];if(i)context.lineTo(...p);else context.moveTo(...p);});
        context.closePath();context.fillStyle='#253443';context.fill();
      }

    }
    const startX=left+(track.start[0]-b.minX)*size,startY=top+(track.start[1]-b.minY)*size;
    const [sx,sy]=connectionPoint(track.startConnection,startX,startY,size);
    context.beginPath();context.arc(sx,sy,Math.max(6,size*.105),0,Math.PI*2);
    context.fillStyle='#66e5aa';context.fill();context.strokeStyle='#0c1926';context.lineWidth=3;context.stroke();
  }
  // Vehicle illustration uses only recorded position, heading, type and active state.
  function drawVehicle2D(ctx,x,y,heading,vehicleType,color,scale,showOutline,active){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(heading);
    ctx.scale(scale,scale);
    if(!active)ctx.globalAlpha=0.55;

    const wheelSteer=0; // Neutral artwork; steering samples are unavailable.
    // Draw wheels / skis
    ctx.fillStyle='#101820';
    ctx.strokeStyle=showOutline?'#ffffff':'#2a3d52';
    ctx.lineWidth=showOutline?1.2:0.7;
    if(vehicleType===2){
      // Snowmobile twin front skis + rear track
      for(const wy of [-5.2,5.2]){
        ctx.save();ctx.translate(8.5,wy);ctx.rotate(wheelSteer);
        ctx.beginPath();ctx.roundRect(-4.5,-1.3,9,2.6,1);ctx.fill();ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();ctx.roundRect(-12,-4.2,13,8.4,1.5);ctx.fill();
    }else{
      // Rear wheels
      const rwY=vehicleType===3?6.8:6.2;
      for(const wy of [-rwY,rwY]){
        ctx.beginPath();ctx.roundRect(-10.5,wy-1.8,6.5,3.6,1);ctx.fill();ctx.stroke();
      }
      // Steerable front wheels
      const fwY=vehicleType===0?6.4:6.0;
      for(const wy of [-fwY,fwY]){
        ctx.save();ctx.translate(8.2,wy);ctx.rotate(wheelSteer);
        ctx.beginPath();ctx.roundRect(-3.1,-1.6,6.2,3.2,1);ctx.fill();ctx.stroke();
        ctx.restore();
      }
    }

    // Chassis silhouette by VehicleType
    ctx.fillStyle=color;
    ctx.strokeStyle=showOutline?'#ffffff':'#0c1926';
    ctx.lineWidth=showOutline?2.1:1.1;
    ctx.beginPath();
    if(vehicleType===0){
      // Formula open-wheel: rear wing, sidepods, tapered nose, front wing
      ctx.moveTo(-13.5,-6.2);ctx.lineTo(-9.5,-6.2);ctx.lineTo(-9.5,-3.6);
      ctx.lineTo(-6.5,-5.5);ctx.lineTo(3.5,-4.8);ctx.lineTo(8.5,-2.0);
      ctx.lineTo(13.5,-5.8);ctx.lineTo(15.2,-5.8);ctx.lineTo(15.2,5.8);
      ctx.lineTo(13.5,5.8);ctx.lineTo(8.5,2.0);ctx.lineTo(3.5,4.8);
      ctx.lineTo(-6.5,5.5);ctx.lineTo(-9.5,3.6);ctx.lineTo(-9.5,6.2);
      ctx.lineTo(-13.5,6.2);ctx.closePath();
    }else if(vehicleType===1){
      // Rally car: wide-body hatchback
      ctx.roundRect(-12.5,-6.3,25,12.6,3.4);
    }else if(vehicleType===2){
      // Snowmobile: sleek sled cowling
      ctx.moveTo(-11.5,-4.6);ctx.lineTo(5.5,-5.0);ctx.lineTo(13.5,0);
      ctx.lineTo(5.5,5.0);ctx.lineTo(-11.5,4.6);ctx.closePath();
    }else{
      // Truck: heavy cab + cargo bed
      ctx.roundRect(-14,-7.0,28,14.0,2.4);
    }
    ctx.fill();ctx.stroke();

    // Cockpit / roof / bed details
    ctx.fillStyle='#0c1725';
    if(vehicleType===0){
      ctx.beginPath();ctx.ellipse(-0.5,0,4.2,2.3,0,0,Math.PI*2);ctx.fill();
      // Halo bar
      ctx.strokeStyle='#d7e8f2';ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(3.4,0);ctx.stroke();
    }else if(vehicleType===1){
      // Windshield + roof scoop + rear spoiler
      ctx.beginPath();ctx.roundRect(-4.5,-4.6,10.5,9.2,2);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(0.5,0,1.4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#101d2c';ctx.fillRect(-12,-5.6,2.4,11.2);
    }else if(vehicleType===2){
      ctx.beginPath();ctx.roundRect(-4,-2.8,8,5.6,1.6);ctx.fill();
    }else{
      // Truck bed & cab windshield
      ctx.fillRect(-12.2,-5.4,11,10.8);
      ctx.beginPath();ctx.roundRect(2,-5.2,6.5,10.4,1.5);ctx.fill();
    }

    // The recorded active flag controls the inactive badge.
    if(!active){
      ctx.strokeStyle='#ff6b6b';ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(-7,-7);ctx.lineTo(7,7);ctx.moveTo(7,-7);ctx.lineTo(-7,7);ctx.stroke();
    }
    ctx.restore();
  }


  function hash(value,label){
    if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))throw Error(label+' must be a SHA-256 hash');
    return value.toLowerCase();
  }
  const CONTROL_KEYS=['steering','acceleration','handbrake','brake','boost'];
  const SCALAR_SENSORS=['speed','velocityFront','velocitySide','angularVelocity','wheelAngle','boostCapacity','correctDirection'];
  function exactKeys(value,keys,label){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...keys].sort().join())throw Error('Invalid '+label);
  }
  function finiteValue(value,label,limit=1e12){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>limit)throw Error('Invalid '+label);return value;}
  function sensorDescriptor(sensor){
    const kind=sensor?.$type,keys=SCALAR_SENSORS.includes(kind)?[]:({raycast:['Degrees','Length'],accelerationFront:['MaxAcceleration'],accelerationSide:['MaxAcceleration'],distanceFromWall:['MaxDistance'],trackCurvature:['MinLookaheadDistance','MaxLookaheadDistance'],grip:['PositionOffset']})[kind];
    if(!keys)throw Error('Unsupported recorded sensor');exactKeys(sensor,['$type',...keys],'sensor descriptor');
    const clean={$type:kind};
    for(const key of keys){
      if(key==='PositionOffset'){exactKeys(sensor[key],['X','Y'],'grip offset');clean[key]={X:finiteValue(sensor[key].X,'grip X',1e6),Y:finiteValue(sensor[key].Y,'grip Y',1e6)};}
      else clean[key]=finiteValue(sensor[key],'sensor '+key,1e6);
    }
    if(kind==='raycast'&&(Math.abs(clean.Degrees)>360||clean.Length<1||clean.Length>10000))throw Error('Invalid ray parameters');
    if(keys.includes('MaxAcceleration')&&clean.MaxAcceleration<=0||kind==='distanceFromWall'&&clean.MaxDistance<=0)throw Error('Invalid sensor normalization');
    return clean;
  }
  function recordingTelemetry(payload){
    if(payload.version===1)return null;
    if(payload.policy_weights_verified!==true||payload.sampling_method!=='single_native_bench_trace'||payload.population!==1||payload.warmup_ticks!==0||payload.seed!==0)throw Error('Unsupported native recording conditions');
    const value=payload.telemetry;exactKeys(value,['source','state_phase','decision_phase','sensors','output_ids','controls'],'telemetry');
    if(value.source!=='native_cached_inference'||value.state_phase!=='post_physics'||value.decision_phase!=='pre_physics_at_decision_tick'||value.controls!=='raw_network_commands_and_native_normalized_controls')throw Error('Unsupported telemetry phases');
    if(!Array.isArray(value.sensors)||!value.sensors.length||value.sensors.length>20)throw Error('Invalid recorded sensor count');
    const sensors=value.sensors.map(sensorDescriptor),ids=value.output_ids;
    if(sensors.filter(x=>x.$type==='raycast').length>13||sensors.filter(x=>x.$type!=='raycast').length>7)throw Error('Invalid sensor layout');
    if(!Array.isArray(ids)||!ids.length||ids.length>5||new Set(ids).size!==ids.length||ids.some(x=>!Number.isInteger(x)||x<0||x>4)||!ids.includes(0)||!ids.includes(1)||payload.vehicle_type===2&&ids.includes(2))throw Error('Invalid recorded output slots');
    return {...value,sensors,output_ids:[...ids]};
  }
  function recordedControls(value,label){
    exactKeys(value,CONTROL_KEYS,label);return Object.fromEntries(CONTROL_KEYS.map(key=>[key,finiteValue(value[key],label,1)]));
  }
  function recordingEvents(recording){
    const result=[];
    recording.frames.forEach((frame,index)=>{
      const previous=recording.frames[index-1],from=previous?.tick??frame.tick;
      if(frame.collision_count!==undefined){
        const count=previous?.collision_count===undefined?frame.collision_count:frame.collision_count-previous.collision_count;
        if(count>0)result.push({from_tick:from,to_tick:frame.tick,kind:'contacts',count,label:previous?`${count} contact(s) recorded in (${from}, ${frame.tick}]`:`${count} contact(s) at first sample ${frame.tick}`});
      }
      if(previous&&previous.active!==frame.active)result.push({from_tick:from,to_tick:frame.tick,kind:'active',label:`${frame.active?'Active':'Inactive'} by sample ${frame.tick}; changed in (${from}, ${frame.tick}]`});
    });return result;
  }
  function adjacentSampleTick(recording,tick,direction){
    if(direction!==-1&&direction!==1||!Number.isFinite(tick))throw Error('Invalid sample step');
    const frames=recording.frames;
    return direction>0?(frames.find(frame=>frame.tick>tick)?.tick??frames[frames.length-1].tick):([...frames].reverse().find(frame=>frame.tick<tick)?.tick??frames[0].tick);
  }
  function validateRecording(payload,expectedTrackSha,expectedNetworkSha){
    if(!payload||payload.schema!=='ald.recorded-replay'||![1,2].includes(payload.version)||payload.kind!=='fresh_cpu_evaluation')
      throw Error('This file is not a supported recorded CPU evaluation');
    if(payload.physics_hz!==60||payload.control_hz!==60||payload.sample_interval_ticks!==6||payload.first_sample_tick!==1||
       payload.execution_backend!=='cpu'||payload.math_profile!=='proton'||payload.collision_elimination!==false||payload.idle_elimination!==false)
      throw Error('Recorded evaluation conditions are unsupported');
    const trackSha=hash(payload.track_sha256,'Recorded track'),networkSha=hash(payload.network_sha256,'Recorded network');
    if(trackSha!==hash(expectedTrackSha,'Selected track')||networkSha!==hash(expectedNetworkSha,'Selected network'))
      throw Error('The recording does not match the selected track and network');
    const ticks=payload.requested_ticks;
    if(!Number.isInteger(ticks)||ticks<1||ticks>900)throw Error('Recording must contain at most 900 physics ticks');
    if(!Number.isInteger(payload.vehicle_type)||payload.vehicle_type<0||payload.vehicle_type>3)throw Error('Recorded vehicle type is invalid');
    const expectedTicks=[1];
    for(let tick=6;tick<=ticks;tick+=6)expectedTicks.push(tick);
    if(expectedTicks[expectedTicks.length-1]!==ticks)expectedTicks.push(ticks);
    if(!Array.isArray(payload.frames)||payload.frames.length!==expectedTicks.length)
      throw Error('Recording is missing its expected native samples');
    const telemetry=recordingTelemetry(payload);
    const frames=payload.frames.map((frame,index)=>{
      if(!frame||frame.tick!==expectedTicks[index]||typeof frame.active!=='boolean')throw Error('Recorded frame ticks or active state are invalid');
      const copy={tick:frame.tick,active:frame.active};
      for(const key of ['x','y','rotation','vx','vy']){
        if(!Number.isFinite(frame[key])||Math.abs(frame[key])>1e9)throw Error('Recorded '+key+' is invalid');
        copy[key]=frame[key];
      }
      for(const key of ['angular_velocity','boost_energy','collision_count','update_count']){
        if(frame[key]===undefined)continue;
        if(!Number.isFinite(frame[key])||Math.abs(frame[key])>1e9)throw Error('Recorded '+key+' is invalid');
        if((key==='collision_count'||key==='update_count')&&(!Number.isInteger(frame[key])||frame[key]<0))throw Error('Recorded '+key+' is invalid');
        copy[key]=frame[key];
      }
      if(frame.metrics!==undefined){
        if(!frame.metrics||typeof frame.metrics!=='object'||Array.isArray(frame.metrics)||Object.keys(frame.metrics).length>64)throw Error('Invalid recorded metrics');
        copy.metrics=Object.fromEntries(Object.entries(frame.metrics).map(([key,value])=>{if(!key.length||key.length>96)throw Error('Invalid metric name');return [key,value===null?null:finiteValue(value,'metric')];}));
      }
      if(telemetry){
        copy.controls=recordedControls(frame.controls,'control commands');copy.applied_controls=recordedControls(frame.applied_controls,'applied controls');
        for(const key of CONTROL_KEYS){const expected=['boost','handbrake'].includes(key)?Math.max(0,copy.controls[key]):copy.controls[key];if(copy.applied_controls[key]!==expected)throw Error('Control normalization differs');}
        if(frame.decision===null)copy.decision=null;
        else{
          exactKeys(frame.decision,['tick','inputs'],'recorded decision');
          if(!Number.isInteger(frame.decision.tick)||frame.decision.tick<1||frame.decision.tick>frame.tick||!Array.isArray(frame.decision.inputs)||frame.decision.inputs.length!==telemetry.sensors.length)throw Error('Invalid decision tick or sensor vector');
          copy.decision={tick:frame.decision.tick,inputs:frame.decision.inputs.map(value=>finiteValue(value,'sensor input'))};
        }
      }
      return copy;
    });
    for(let i=1;i<frames.length;i++){
      if(frames[i].collision_count!==undefined&&frames[i-1].collision_count!==undefined&&frames[i].collision_count<frames[i-1].collision_count)throw Error('Contact counter moved backwards');
      if(telemetry&&frames[i-1].decision&&(frames[i].decision===null||frames[i].decision.tick<frames[i-1].decision.tick))throw Error('Decision clock moved backwards');
    }
    return {schema:payload.schema,version:payload.version,telemetry,kind:payload.kind,physics_hz:60,control_hz:60,sample_interval_ticks:6,
      first_sample_tick:1,track_sha256:trackSha,network_sha256:networkSha,vehicle_type:payload.vehicle_type,
      requested_ticks:ticks,execution_backend:'cpu',math_profile:'proton',collision_elimination:false,idle_elimination:false,frames};
  }
  function sampleRecording(recording,tick){
    if(!Number.isFinite(tick))throw Error('Replay tick must be finite');
    const frames=recording.frames,last=frames.length-1;
    const at=Math.max(frames[0].tick,Math.min(frames[last].tick,tick));
    let lo=0,hi=last;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].tick<=at)lo=mid;else hi=mid-1;}
    const a=frames[lo],b=frames[Math.min(last,lo+1)];
    const t=b.tick===a.tick?0:(at-a.tick)/(b.tick-a.tick);
    const angle=Math.atan2(Math.sin(b.rotation-a.rotation),Math.cos(b.rotation-a.rotation));
    // Pose interpolation is only between adjacent recorded samples. HUD values
    // remain the actual preceding sample, never reconstructed controls or rays.
    return {tick:at,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,rotation:a.rotation+angle*t,frame:{...a}};
  }
  function viewport(canvas,track){
    const b=track.bounds,columns=b.maxX-b.minX+1,rows=b.maxY-b.minY+1;
    const size=Math.min(160,(canvas.width-70)/columns,(canvas.height-70)/rows);
    return {size,left:(canvas.width-columns*size)/2,top:(canvas.height-rows*size)/2,minX:b.minX,minY:b.minY};
  }
  function worldPoint(view,x,y){return [view.left+(x/768-view.minX)*view.size,view.top+(y/768-view.minY)*view.size];}
  function mount({document,fetch,picker}){
    const canvas=document.getElementById('trackMap'),status=document.getElementById('mapStatus'),legend=document.getElementById('mapLegend');
    if(!canvas||!status||!legend||!picker)return;
    const element=id=>document.getElementById(id);
    let version=0,atlasPromise=null,currentTrack=null,currentTrackSha=null,staticLayer=null;
    let reference=null,referenceBusy=false,referenceWorker=null;
    let recording=null,hasRunSummary=false,cursor=1,playing=false,animId=null,lastFrameTime=null;
    let playSpeed=Math.max(0.25,Math.min(4,Number(element('replay_speed')?.value)||1));
    let cameraMode=element('replay_camera')?.value==='follow'?'follow':'full';
    const layers={outline:true,line:true,hud:true};
    let smoothPose=false,blackboxTick=null;
    const noRecording='No replay recorded. The map shows the selected track and its saved starting point.';
    const summaryOnly='No replay recorded. This run contains summary measurements, not vehicle positions or control samples.';
    function setText(id,text){const node=element(id);if(node&&node.textContent!==text)node.textContent=text;}
    function syncControls(reason){
      if(element('reference_calculate'))element('reference_calculate').disabled=!currentTrack||referenceBusy;
      if(element('reference_show'))element('reference_show').disabled=!reference;
      const last=recording?.frames[recording.frames.length-1].tick;
      const play=element('replay_play');
      if(play){play.disabled=!recording||cursor>=last;play.textContent=playing?'Pause':'Play';}
      for(const id of ['replay_reset','replay_scrub','replay_speed','replay_camera','replay_layer_outline','replay_layer_line','replay_layer_hud','replay_interpolate','replay_prev','replay_next','replay_event']){
        const node=element(id);if(node)node.disabled=!recording;
      }
      if(element('replay_prev'))element('replay_prev').disabled=!recording||cursor<=recording.frames[0].tick;
      if(element('replay_next'))element('replay_next').disabled=!recording||cursor>=last;
      if(element('replay_event'))element('replay_event').disabled=!recording||!recordingEvents(recording).length;
      if(element('replay_blackbox'))element('replay_blackbox').hidden=!recording;
      const scrub=element('replay_scrub');
      if(scrub){scrub.min='1';scrub.max=String(last??1);scrub.step='1';scrub.value=String(Math.round(cursor));}
      if(!recording){
        setText('replay_status',reason||(hasRunSummary?summaryOnly:noRecording));
        setText('replay_time_label','No recorded samples');
        setText('replay_readout','Record a drive to inspect position and speed. Native controls and sensor inputs appear after a version 2 recording is loaded.');
      }else{
        const state=cursor>=last?'Finished. Use Restart to view it again.':playing?'Playing.':'Paused.';
        setText('replay_status',`Fresh recorded CPU evaluation · ${recording.frames.length} samples · 60 Hz physics and controls · 10 Hz recording. ${smoothPose?'Pose interpolation on.':'Measured sample poses.'} ${state}`);
      }
    }
    function rows(id,entries){
      const body=element(id);if(!body)return;
      const nodes=entries.map(cells=>{const row=document.createElement('tr');cells.forEach((value,index)=>{const cell=document.createElement(index===0?'th':'td');cell.textContent=String(value);row.append(cell);});return row;});body.replaceChildren(...nodes);
    }
    function blackbox(frame){
      if(blackboxTick===frame.tick)return;blackboxTick=frame.tick;
      const number=value=>value===undefined||value===null?'Unavailable':typeof value==='number'?Number(value.toPrecision(8)).toString():String(value);
      const decision=frame.decision;
      setText('blackbox_phase',`Post-physics snapshot: tick ${frame.tick}. ${decision?`Native decision: tick ${decision.tick}, pre-physics${decision.tick<frame.tick?' (held from an earlier tick)':''}.`:recording.telemetry?'No inference captured before this snapshot.':'Legacy recording: controls and sensors unavailable.'}`);
      rows('blackbox_state',[
        ['Snapshot time',(frame.tick/60).toFixed(3)+' s'],['Position X / Y',number(frame.x)+' / '+number(frame.y)+' game units'],
        ['Velocity X / Y',number(frame.vx)+' / '+number(frame.vy)+' game units/s'],['Speed',number(Math.hypot(frame.vx,frame.vy))+' game units/s'],
        ['Heading',number(frame.rotation)+' rad'],['Angular velocity',number(frame.angular_velocity)+' rad/s'],['Boost energy',number(frame.boost_energy)],
        ['Physical contacts',number(frame.collision_count)],['Active',frame.active?'Yes':'No'],['Statistics updates',number(frame.update_count)]
      ]);
      rows('blackbox_controls',recording.telemetry?CONTROL_KEYS.map((key,index)=>[key,number(frame.controls[key]),number(frame.applied_controls[key]),recording.telemetry.output_ids.includes(index)?'Policy output':'Native default (no output slot)']):[['Unavailable','Not captured in this recording','Unavailable','Unavailable']]);
      rows('blackbox_inputs',recording.telemetry?recording.telemetry.sensors.map((sensor,index)=>[index,sensor.$type,JSON.stringify(Object.fromEntries(Object.entries(sensor).filter(([key])=>key!=='$type'))),decision?number(decision.inputs[index]):'Not captured yet']):[['Unavailable','Legacy recording','No input capture','Unavailable']]);
      rows('blackbox_metrics',Object.entries(frame.metrics??{}).map(([key,value])=>[key,number(value)]));
    }
    function eventOptions(){
      const select=element('replay_event');if(!select)return;select.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent=recording?'Choose contact / active-state interval':'No recording';select.append(empty);
      if(recording)recordingEvents(recording).forEach(event=>{const option=document.createElement('option');option.value=String(event.to_tick);option.textContent=event.label;select.append(option);});
    }
    function stopPlayback(){
      if(animId!==null&&typeof root?.cancelAnimationFrame==='function')root.cancelAnimationFrame(animId);
      animId=null;playing=false;lastFrameTime=null;
    }
    function renderEmpty(){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0c1926';ctx.fillRect(0,0,canvas.width,canvas.height);}
    function draw(){
      if(!currentTrack){renderEmpty();return;}
      const ctx=canvas.getContext('2d'),view=viewport(canvas,currentTrack);
      let state=recording?sampleRecording(recording,cursor):null;
      if(state&&!smoothPose)state={...state,x:state.frame.x,y:state.frame.y,rotation:state.frame.rotation};
      const position=state?worldPoint(view,state.x,state.y):null;
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0c1926';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();
      if(position&&cameraMode==='follow'){
        ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(2,2);ctx.translate(-position[0],-position[1]);
      }
      if(staticLayer)ctx.drawImage(staticLayer,0,0);else render(canvas,currentTrack);
      if(reference&&element('reference_show')?.checked){
        ctx.beginPath();
        reference.points.forEach((p,i)=>{const xy=worldPoint(view,...p);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});
        ctx.closePath();ctx.strokeStyle='#ffd073';ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.stroke();ctx.setLineDash([]);
      }
      if(recording){
        if(layers.line){
          ctx.beginPath();
          recording.frames.forEach((frame,index)=>{const p=worldPoint(view,frame.x,frame.y);if(index===0)ctx.moveTo(...p);else ctx.lineTo(...p);});
          ctx.strokeStyle='#62dfb1';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();
        }
        // Native rotation zero faces -Y; the vehicle illustration faces +X.
        drawVehicle2D(ctx,...position,state.rotation-Math.PI/2,recording.vehicle_type,'#62dfb1',Math.max(0.55,Math.min(1.1,view.size/120)),layers.outline,state.frame.active);
      }
      ctx.restore();
      if(state){
        const frame=state.frame;blackbox(frame);const speed=Math.hypot(frame.vx,frame.vy)/15*3.6;
        const contacts=frame.collision_count===undefined?'unavailable':String(frame.collision_count);
        const deviation=referenceDistance([frame.x,frame.y],reference);
        setText('reference_deviation',deviation?`Measured position is ${(deviation.distance/15).toFixed(2)} m from the nearest suggested-route segment. Distance alone does not measure driving quality.`:'');
        setText('replay_time_label',`${(cursor/60).toFixed(2)}s / ${(recording.requested_ticks/60).toFixed(2)}s · Tick ${Math.round(cursor)} · Measured tick ${frame.tick}`);
        setText('replay_readout',`Recorded sample tick ${frame.tick} (${(frame.tick/60).toFixed(2)}s). Speed ${speed.toFixed(1)} km/h, derived from recorded velocity. Position (${frame.x.toFixed(2)}, ${frame.y.toFixed(2)}). Contacts ${contacts}. ${frame.active?'Active':'Inactive'} at this sample. ${frame.decision?'Native controls and inputs captured at tick '+frame.decision.tick+'.':'No captured decision at this sample.'}`);
        if(layers.hud){
          ctx.save();ctx.fillStyle='rgba(9,17,27,0.88)';ctx.beginPath();ctx.roundRect(12,12,310,80,8);ctx.fill();
          ctx.fillStyle='#62dfb1';ctx.font='700 12px system-ui,sans-serif';ctx.fillText('RECORDED CPU EVALUATION',24,33);
          ctx.fillStyle='#e5edf5';ctx.font='600 12px ui-monospace,monospace';ctx.fillText(`Sample ${frame.tick} · ${speed.toFixed(1)} km/h from velocity`,24,55);
          ctx.fillStyle='#b4c5d5';ctx.font='12px system-ui,sans-serif';ctx.fillText(frame.decision?'Decision tick '+frame.decision.tick+' · native controls + inputs':'No captured decision at this sample',24,77);ctx.restore();
        }
      }
    }
    function clearRecording(reason){
      const hadRecording=recording!==null;stopPlayback();recording=null;cursor=1;blackboxTick=null;eventOptions();
      setText('reference_deviation','');
      if(hadRecording)draw();syncControls(reason);
    }
    function step(now){
      animId=null;if(!playing||!recording)return;
      if(document.hidden){stopPlayback();syncControls();return;}
      if(lastFrameTime===null)lastFrameTime=now;
      const elapsed=Math.max(0,Math.min(0.1,(now-lastFrameTime)/1000));lastFrameTime=now;
      const last=recording.frames[recording.frames.length-1].tick;
      cursor=Math.min(last,cursor+elapsed*60*playSpeed);
      draw();
      if(cursor>=last){stopPlayback();syncControls();return;}
      syncControls();animId=root.requestAnimationFrame(step);
    }
    function bind(){
      const on=(id,event,callback)=>{const node=element(id);if(node)node.addEventListener(event,callback);};
      on('reference_calculate','click',async()=>{
        if(!currentTrack||referenceBusy)return;
        const track=currentTrack,request=version;referenceBusy=true;syncControls();setText('reference_status','Calculating suggested route…');
        await new Promise(resolve=>typeof root?.setTimeout==='function'?root.setTimeout(resolve,0):resolve());
        if(request!==version)return;
        try{
          if(typeof root?.Worker==='function'&&typeof root?.URL?.createObjectURL==='function'){
            const source=`const MaskPlanner=${maskPlanner.workerSource()};onmessage=event=>{try{postMessage({line:MaskPlanner.line(event.data)});}catch(error){postMessage({error:error.message});}};`;
            const url=root.URL.createObjectURL(new Blob([source],{type:'application/javascript'}));
            let worker;
            try{
              worker=new root.Worker(url);
              const line=await new Promise((resolve,reject)=>{
                referenceWorker={worker,cancel:()=>reject(Error('Track changed'))};
                worker.onmessage=event=>event.data.error?reject(Error(event.data.error)):resolve(event.data.line);
                worker.onerror=()=>reject(Error('Browser could not calculate the suggested route'));
                worker.postMessage(track);
              });
              if(request!==version)return;
              reference=line;
            }finally{worker?.terminate();root.URL.revokeObjectURL(url);if(referenceWorker?.worker===worker)referenceWorker=null;}
          }else reference=referenceLine(track);
          if(request!==version)return;
          setText('reference_status',`Suggested route ready · ${reference.route_tiles} connected pieces. A geometric guide for orientation; vehicle dynamics are not modeled.`);
        }catch(error){if(request===version){reference=null;setText('reference_status','Suggested route unavailable: '+error.message);}}
        finally{if(request===version){referenceBusy=false;draw();syncControls();}}
      });
      on('reference_show','change',draw);
      on('replay_play','click',()=>{
        if(!recording)return;
        if(playing){stopPlayback();syncControls();return;}
        if(cursor>=recording.frames[recording.frames.length-1].tick||typeof root?.requestAnimationFrame!=='function')return;
        playing=true;lastFrameTime=null;syncControls();animId=root.requestAnimationFrame(step);
      });
      on('replay_reset','click',()=>{if(!recording)return;stopPlayback();cursor=recording.frames[0].tick;draw();syncControls();});
      on('replay_scrub','input',()=>{
        if(!recording)return;const value=Number(element('replay_scrub').value);if(!Number.isFinite(value))return;
        stopPlayback();cursor=Math.max(recording.frames[0].tick,Math.min(recording.frames[recording.frames.length-1].tick,value));draw();syncControls();
      });
      for(const [id,direction]of [['replay_prev',-1],['replay_next',1]])on(id,'click',()=>{if(!recording)return;stopPlayback();cursor=adjacentSampleTick(recording,cursor,direction);draw();syncControls();});
      on('replay_event','change',()=>{if(!recording||!element('replay_event').value)return;stopPlayback();cursor=Number(element('replay_event').value);draw();syncControls();});
      on('replay_interpolate','change',()=>{smoothPose=element('replay_interpolate').checked;draw();syncControls();});
      on('replay_speed','change',()=>{playSpeed=Math.max(0.25,Math.min(4,Number(element('replay_speed').value)||1));});
      on('replay_camera','change',()=>{cameraMode=element('replay_camera').value==='follow'?'follow':'full';draw();});
      for(const key of ['outline','line','hud']){
        const id='replay_layer_'+key,node=element(id);if(node)layers[key]=node.checked;
        on(id,'change',()=>{layers[key]=element(id).checked;draw();});
      }
      document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlayback();syncControls();}});
    }
    async function refresh(){
      if(referenceWorker){referenceWorker.worker.terminate();referenceWorker.cancel();referenceWorker=null;}
      const current=++version;clearRecording();currentTrackSha=null;currentTrack=null;staticLayer=null;reference=null;referenceBusy=false;
      setText('reference_status','Calculate an optional route for general orientation, then compare it with the recorded car path.');setText('reference_deviation','');syncControls();
      const info=picker.info();
      const source=info.source==='builtin'?info.display_name:element('track')?.files?.[0]?.name;
      if(!source){status.textContent='Select a built-in track or choose a custom .track file.';legend.textContent='';renderEmpty();return;}
      status.textContent='Loading '+source+'…';
      try{
        atlasPromise??=fetch('/assets/track-atlas.json',{cache:'no-store',credentials:'same-origin'}).then(r=>{
          if(!r.ok)throw Error('Track atlas unavailable');return r.json();
        });
        const [file,atlas]=await Promise.all([picker.file(),atlasPromise]);
        if(!file||file.size<1||file.size>1048576)throw Error('Choose a .track file under 1 MB');
        const hashPromise=root?.crypto?.subtle?file.arrayBuffer().then(bytes=>root.crypto.subtle.digest('SHA-256',bytes)).then(bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')):Promise.resolve(null);
        const [saved,sha]=await Promise.all([decode(file),hashPromise]);
        const track=model(saved,atlas);
        if(current!==version)return;
        currentTrack=track;currentTrackSha=sha;
        render(canvas,track);
        const off=document.createElement?.('canvas');
        if(off?.getContext?.('2d')){off.width=canvas.width;off.height=canvas.height;render(off,track);staticLayer=off;}
        const counts=[0,0,0];track.tiles.forEach(tile=>counts[tile.surface]++);
        status.textContent=source+' · '+track.tiles.length+' pieces · green dot marks the saved starting point';
        legend.textContent=NAMES.filter((_,i)=>counts[i]).map(name=>name+' '+counts[NAMES.indexOf(name)]).join(' · ')+' · Dark shapes show static walls. Road shape follows native part geometry. Dashed yellow: mask-derived suggestion. Green: recorded drive. Vehicle positions appear only from a recorded replay.';
        syncControls();
      }catch(error){
        if(current!==version)return;
        currentTrack=null;currentTrackSha=null;staticLayer=null;renderEmpty();
        status.textContent='Map unavailable: '+error.message;legend.textContent='Training selection is unaffected.';
      }
    }
    const controller={
      refresh,
      setStagedNetwork(){clearRecording();},
      setRunAnalysis(analysis,receipt){hasRunSummary=Boolean(analysis?.summary||receipt?.report);clearRecording();},
      focusCandidate(){clearRecording();},
      clearRecording,
      setRecording(payload,expectedTrackSha,expectedNetworkSha){
        clearRecording();
        try{
          const next=validateRecording(payload,expectedTrackSha,expectedNetworkSha);
          if(!currentTrack||!currentTrackSha)throw Error('The selected track must finish loading and hash verification before replay');
          if(next.track_sha256!==currentTrackSha)throw Error('The recording belongs to a different selected track');
          recording=next;blackboxTick=null;cursor=next.frames[0].tick;eventOptions();draw();syncControls();
          return {frames:next.frames.length,first_tick:cursor,last_tick:next.frames[next.frames.length-1].tick};
        }catch(error){clearRecording('Replay unavailable: '+error.message);throw error;}
      },
    };
    if(typeof root==='object'&&root)root.TrackReplay=controller;
    bind();syncControls();document.addEventListener('track-library-change',refresh);refresh();
    return controller;
  }
  return {mount,model,decode,render,referenceLine,referenceDistance,validateRecording,sampleRecording,recordingEvents,adjacentSampleTick};
});
