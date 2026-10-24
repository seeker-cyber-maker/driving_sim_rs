/* Part-derived free-space masks and a route-ordered geometric guide. No driving model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TrackMask=api;
})(typeof window==='undefined'?this:window,function createMaskPlanner(){
  const TILE=768,CELL=8,N=TILE/CELL,MARGIN=32,EPS=1e-7;
  const maskCache=new Map();
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function project(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return[a[0]+t*dx,a[1]+t*dy];}
  function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  function separation(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(dist(a,project(a,c,d)),dist(b,project(b,c,d)),dist(c,project(c,a,b)),dist(d,project(d,a,b)));}
  function shape(poly){return{poly,edges:poly.map((p,i)=>[p,poly[(i+1)%poly.length]]),box:[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))]};}
  function boxDistance(p,b){return Math.hypot(Math.max(b[0]-p[0],0,p[0]-b[2]),Math.max(b[1]-p[1],0,p[1]-b[3]));}
  function polygonClearance(p,obstacles,cap=256){let value=cap;for(const s of obstacles){if(boxDistance(p,s.box)>value)continue;if(inside(p,s.poly))return 0;for(const[a,b]of s.edges)value=Math.min(value,dist(p,project(p,a,b)));}return value;}
  function partMask(polygons){
    if(!Array.isArray(polygons))throw Error('Native collision polygons are required for the road mask');
    const key=JSON.stringify(polygons);if(maskCache.has(key))return maskCache.get(key);
    const obstacles=polygons.map(shape),free=new Uint8Array(N*N),radius=CELL*Math.SQRT2/2;
    // A blocked cell conservatively covers every polygon it touches. Obstacles
    // are a union: winding and overlaps cannot cancel walls or isolated posts.
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(polygonClearance([(x+.5)*CELL,(y+.5)*CELL],obstacles)>radius+EPS)free[y*N+x]=1;
    if(maskCache.size>=160)maskCache.delete(maskCache.keys().next().value);
    const result={cell_size:CELL,width:N,height:N,free};maskCache.set(key,result);return result;
  }
  function scene(track){
    if(!track||!Array.isArray(track.tiles)||track.tiles.length<1||track.tiles.length>256)throw Error('Road mask requires 1–256 saved pieces');
    const tiles=new Map();for(const t of track.tiles){if(!Number.isInteger(t.x)||!Number.isInteger(t.y)||!Array.isArray(t.polygons))throw Error('Native wall geometry is unavailable');const key=`${t.x},${t.y}`;if(tiles.has(key))throw Error('Duplicate road-mask tile');tiles.set(key,{...t,obstacles:t.polygons.map(shape),mask:partMask(t.polygons.map(poly=>poly.map(p=>[p[0]-t.x*TILE,p[1]-t.y*TILE]))),field:new Float64Array(N*N).fill(-1)});}
    const neighbors=new Map();
    function obstacles(t){const key=`${t.x},${t.y}`;if(neighbors.has(key))return neighbors.get(key);const all=[];for(let y=t.y-1;y<=t.y+1;y++)for(let x=t.x-1;x<=t.x+1;x++){const own=tiles.get(`${x},${y}`);if(own)all.push(...own.obstacles);else all.push(shape([[x*TILE,y*TILE],[(x+1)*TILE,y*TILE],[(x+1)*TILE,(y+1)*TILE],[x*TILE,(y+1)*TILE]]));}neighbors.set(key,all);return all;}
    function clearance(p,t){return polygonClearance(p,obstacles(t));}
    function clear(a,b,t){
      const x=t.x*TILE,y=t.y*TILE;if([a,b].some(p=>p[0]<x-EPS||p[0]>x+TILE+EPS||p[1]<y-EPS||p[1]>y+TILE+EPS))return false;
      const box=[Math.min(a[0],b[0])-MARGIN,Math.min(a[1],b[1])-MARGIN,Math.max(a[0],b[0])+MARGIN,Math.max(a[1],b[1])+MARGIN];
      for(const s of obstacles(t)){if(s.box[0]>box[2]||s.box[2]<box[0]||s.box[1]>box[3]||s.box[3]<box[1])continue;if(inside(a,s.poly)||inside(b,s.poly))return false;for(const[c,d]of s.edges)if(separation(a,b,c,d)<MARGIN-EPS)return false;}return true;
    }
    function point(t,id){return[t.x*TILE+(id%N+.5)*CELL,t.y*TILE+(Math.floor(id/N)+.5)*CELL];}
    function field(t,id){if(!t.mask.free[id])return 0;if(t.field[id]<0)t.field[id]=clearance(point(t,id),t);return t.field[id];}
    return{tiles,clearance,clear,point,field};
  }
  function portPoint(t,c,offset=[128,384,640][c.index]){const x=t.x*TILE,y=t.y*TILE;return c.side===0?[x+offset,y]:c.side===1?[x+offset,y+TILE]:c.side===2?[x,y+offset]:[x+TILE,y+offset];}
  function ordered(track,s){
    const equal=(a,b)=>a.side===b.side&&a.index===b.index&&a.type===b.type,steps=[[0,-1],[0,1],[-1,0],[1,0]],seen=new Set(),route=[];
    let t=s.tiles.get(track.start.join(',')),incoming=track.startConnection;
    while(t&&!seen.has(`${t.x},${t.y}`)){
      if(t.connections?.length!==2||!t.connections.some(c=>equal(c,incoming)))throw Error('The saved route has an incompatible connection');seen.add(`${t.x},${t.y}`);
      const outgoing=t.connections.find(c=>!equal(c,incoming));if(!outgoing)throw Error('The saved route has no exit');route.push({tile:t,incoming,outgoing});const step=steps[outgoing.side];if(!step)throw Error('Invalid route side');t=s.tiles.get(`${t.x+step[0]},${t.y+step[1]}`);incoming={...outgoing,side:outgoing.side^1};
    }
    if(!t||t.x!==track.start[0]||t.y!==track.start[1]||!equal(incoming,track.startConnection))throw Error('The saved route does not close at its saved start');
    if(seen.size!==track.tiles.length)throw Error('The saved track contains pieces outside its single closed route');return route;
  }
  function portals(t,c,next,s){
    const groups=[];let run=[];
    for(let offset=0;offset<=TILE;offset+=CELL){const p=portPoint(t,c,offset),valid=s.clearance(p,t)>=MARGIN-EPS&&s.clearance(p,next)>=MARGIN-EPS;if(valid)run.push(offset);else if(run.length){groups.push(run);run=[];}}
    if(run.length)groups.push(run);if(!groups.length)throw Error('No shared opening keeps the 32-unit wall margin');
    const center=[128,384,640][c.index],gap=g=>Math.max(g[0]-center,0,center-g[g.length-1]),closest=Math.min(...groups.map(gap));
    // Split ports retain both real openings; normal ports associate with their
    // declared connection index. Adjacent unconnected boundaries are never edges.
    const selected=c.type===2?groups:groups.filter(g=>gap(g)<=closest+EPS);
    return selected.map(g=>portPoint(t,c,(g[0]+g[g.length-1])/2));
  }
  class Heap{constructor(){this.items=[];}less(a,b){return a.f<b.f||a.f===b.f&&a.id<b.id;}push(v){let i=this.items.length;this.items.push(v);while(i){let p=(i-1)>>1;if(!this.less(v,this.items[p]))break;this.items[i]=this.items[p];i=p;}this.items[i]=v;}pop(){if(!this.items.length)return null;const top=this.items[0],v=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let j=i*2+1;if(j+1<this.items.length&&this.less(this.items[j+1],this.items[j]))j++;if(!this.less(this.items[j],v))break;this.items[i]=this.items[j];i=j;}this.items[i]=v;}return top;}}
  function path(t,start,end,s,stats){
    const cost=new Float64Array(N*N).fill(Infinity),parent=new Int32Array(N*N).fill(-2),heap=new Heap(),goals=new Map();
    function near(p){const a=[];const x=Math.floor((p[0]-t.x*TILE)/CELL),y=Math.floor((p[1]-t.y*TILE)/CELL);for(let yy=Math.max(0,y-2);yy<=Math.min(N-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(N-1,x+2);xx++){const id=yy*N+xx;if(s.field(t,id)>=MARGIN-EPS&&s.clear(p,s.point(t,id),t))a.push(id);}return a;}
    function weight(d,a,b){return d*(1+1.5*(96/Math.max(MARGIN,(a+b)/2))**2);}
    for(const id of near(start)){const p=s.point(t,id);cost[id]=weight(dist(start,p),s.clearance(start,t),s.field(t,id));parent[id]=-1;heap.push({id,g:cost[id],f:cost[id]+dist(p,end)});}
    for(const id of near(end))goals.set(id,weight(dist(s.point(t,id),end),s.field(t,id),s.clearance(end,t)));
    let best=Infinity,last=-1,node;const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    while((node=heap.pop())){
      if(node.g!==cost[node.id])continue;if(node.f>=best)break;stats.expanded++;if(stats.expanded>6000000)throw Error('Road-mask search exceeds the bounded preview budget');
      if(goals.has(node.id)&&node.g+goals.get(node.id)<best){best=node.g+goals.get(node.id);last=node.id;}
      const x=node.id%N,y=Math.floor(node.id/N),a=s.point(t,node.id),ca=s.field(t,node.id);
      for(const[dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=N||yy<0||yy>=N)continue;const id=yy*N+xx,cb=s.field(t,id);if(cb<MARGIN-EPS)continue;
        if(dx&&dy&&(s.field(t,y*N+xx)<MARGIN-EPS||s.field(t,yy*N+x)<MARGIN-EPS))continue;
        const length=CELL*Math.hypot(dx,dy),g=node.g+weight(length,ca,cb);if(g>=cost[id])continue;const b=s.point(t,id);
        // Exact sampled clearance is Lipschitz. Only near-boundary edges need
        // the more expensive continuous polygon test; neither mask nor EDT is
        // used as an unproven physical clearance guarantee.
        if(Math.min(ca,cb)-length/2<MARGIN&&!s.clear(a,b,t))continue;
        cost[id]=g;parent[id]=node.id;heap.push({id,g,f:g+dist(b,end)});
      }
    }
    if(last<0)return null;const points=[end];for(let at=last;at>=0;at=parent[at])points.push(s.point(t,at));points.push(start);points.reverse();return{points,cost:best};
  }
  function simplify(points,t,s,spacing){const out=[points[0]];let i=0;while(i<points.length-1){let best=i+1;for(let j=i+2;j<points.length&&dist(points[i],points[j])<=spacing;j++)if(s.clear(points[i],points[j],t))best=j;out.push(points[best]);i=best;}return out;}
  function line(track){
    const s=scene(track),route=ordered(track,s),start=portPoint(route[0].tile,track.startConnection),stats={expanded:0};
    if(s.clearance(start,route[0].tile)<MARGIN-EPS)throw Error('The exact saved start is inside a wall or lacks the 32-unit margin; it was not moved');
    const openings=[[start]];for(let i=0;i<route.length-1;i++)openings.push(portals(route[i].tile,route[i].outgoing,route[i+1].tile,s));openings.push([start]);
    const parents=[],matrices=[];let costs=[0];
    for(let i=0;i<route.length;i++){
      const matrix=openings[i].map(a=>openings[i+1].map(b=>path(route[i].tile,a,b,s,stats))),next=openings[i+1].map(()=>Infinity),previous=openings[i+1].map(()=>-1);
      for(let a=0;a<costs.length;a++)for(let b=0;b<next.length;b++){const p=matrix[a][b],v=costs[a]+(p?.cost??Infinity);if(v<next[b]){next[b]=v;previous[b]=a;}}
      matrices.push(matrix);parents.push(previous);costs=next;
    }
    if(!Number.isFinite(costs[0]))throw Error('No continuous lane connects the saved portals with the 32-unit wall margin');
    const pieces=new Array(route.length);let chosen=0;for(let i=route.length-1;i>=0;i--){const prev=parents[i][chosen];pieces[i]=matrices[i][prev][chosen].points;chosen=prev;}
    const length=pieces.reduce((sum,p)=>sum+p.slice(1).reduce((n,b,j)=>n+dist(p[j],b),0),0);let points,owners,anchors,spacing=Math.max(32,length/(2048-2*route.length));
    for(let attempt=0;attempt<5;attempt++){
      points=[];owners=[];anchors=[];pieces.forEach((p,i)=>{const row=simplify(p,route[i].tile,s,spacing);row.slice(0,-1).forEach((v,j)=>{points.push([...v]);owners.push(i);anchors.push(j===0);});});if(points.length<=2048)break;spacing*=1.5;
    }
    if(points.length>2048)throw Error('Exact mask route exceeds the 2,048-point preview budget');
    const n=points.length,wrap=i=>(i+n)%n,bend=i=>{const a=points[wrap(i-1)],b=points[wrap(i)],c=points[wrap(i+1)];return(a[0]-2*b[0]+c[0])**2+(a[1]-2*b[1]+c[1])**2;},energy=()=>points.reduce((sum,_,i)=>sum+bend(i),0),before=energy();
    for(let sweep=0;sweep<8;sweep++)for(let i=0;i<n;i++){
      if(anchors[i])continue;const t=route[owners[i]].tile,a=points[wrap(i-1)],b=points[i],c=points[wrap(i+1)],q=b.map((v,k)=>v+.35*((a[k]+c[k])/2-v));
      if(s.clearance(q,t)<Math.max(MARGIN,Math.min(96,s.clearance(b,t))-4)||!s.clear(a,q,t)||!s.clear(q,c,t))continue;
      const cost=bend(i-1)+bend(i)+bend(i+1);points[i]=q;if(bend(i-1)+bend(i)+bend(i+1)>cost+EPS)points[i]=b;
    }
    for(let i=0;i<n;i++)if(!s.clear(points[i],points[wrap(i+1)],route[owners[i]].tile))throw Error('Final line failed exact native geometry certification');
    return{points,margin:MARGIN,route_tiles:route.length,smoothness_before:before,smoothness_after:energy(),method:'part_mask_portal_graph_exact_clearance',cell_size:CELL,search_expanded:stats.expanded,portal_components:openings.slice(0,-1).map(p=>p.length),segment_tiles:owners.map(i=>[route[i].tile.x,route[i].tile.y]),selected_portals:points.filter((_,i)=>anchors[i]),physical_mask:'tile square minus native polygon union',clearance_field:'exact sampled native polygon distance; continuous final certification',vehicle_model:false};
  }
  return{partMask,line,cell_size:CELL,workerSource:()=>`(${createMaskPlanner.toString()})()`};
});
