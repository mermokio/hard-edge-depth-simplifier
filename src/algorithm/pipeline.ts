import { estimateNormals } from "./normals";
import { continuityPartition } from "./agglomeration";
import type { DepthImage, Parameters, PipelineResult, RegionStat } from "./types";

const now = () => typeof performance === "undefined" ? Date.now() : performance.now();
const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v));
const angle = (ax:number,ay:number,az:number,bx:number,by:number,bz:number) => Math.acos(clamp(ax*bx+ay*by+az*bz,-1,1));

function linkChanges(img:DepthImage,n:Float32Array,p:Parameters){
  const {width:w,height:h,depth:d,valid}=img, nh=(w-1)*h,nv=w*(h-1);
  const dh=new Float32Array(nh),dv=new Float32Array(nv),ah=new Float32Array(nh),av=new Float32Array(nv),ch=new Float32Array(nh),cv=new Float32Array(nv);
  const nt=p.normalJumpThresholdDeg*Math.PI/180;
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++){const i=y*(w-1)+x,a=y*w+x,b=a+1;if(!valid[a]||!valid[b])continue;dh[i]=Math.abs(d[b]-d[a])/p.depthJumpThreshold;ah[i]=angle(n[a*3],n[a*3+1],n[a*3+2],n[b*3],n[b*3+1],n[b*3+2])/nt;ch[i]=Math.max(dh[i],ah[i]);}
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const i=y*w+x,a=y*w+x,b=a+w;if(!valid[a]||!valid[b])continue;dv[i]=Math.abs(d[b]-d[a])/p.depthJumpThreshold;av[i]=angle(n[a*3],n[a*3+1],n[a*3+2],n[b*3],n[b*3+1],n[b*3+2])/nt;cv[i]=Math.max(dv[i],av[i]);}
  return{dh,dv,ah,av,ch,cv};
}

function concentrate(src:Float32Array,lines:number,lineLength:number,h:number,b:number,qmin:number){
  const q=new Float32Array(src.length),raw=new Uint8Array(src.length);
  for(let line=0;line<lines;line++)for(let x=0;x<lineLength;x++){
    let central=0,total=0,max=0;for(let k=-h;k<=h;k++){const xx=x+k;if(xx<0||xx>=lineLength)continue;const v=src[line*lineLength+xx];total+=v;if(Math.abs(k)<=b){central+=v;max=Math.max(max,v);}}
    const z=central/(total+1e-8);q[line*lineLength+x]=z;
    const left=x?src[line*lineLength+x-1]:-1,right=x+1<lineLength?src[line*lineLength+x+1]:-1;
    if(max>=1&&z>=qmin&&src[line*lineLength+x]>=left&&src[line*lineLength+x]>=right)raw[line*lineLength+x]=1;
  }return{q,raw};
}

function hardCueConcentration(combined:Float32Array,depth:Float32Array,normal:Float32Array,lines:number,lineLength:number,p:Parameters){const b=Math.min(p.centralBand,p.hardnessWindow-1),all=concentrate(combined,lines,lineLength,p.hardnessWindow,b,p.minimumConcentration),dc=concentrate(depth,lines,lineLength,p.hardnessWindow,b,p.minimumConcentration),nc=concentrate(normal,lines,lineLength,p.hardnessWindow,b,p.minimumConcentration);for(let i=0;i<all.raw.length;i++){all.raw[i]=all.raw[i]||dc.raw[i]||nc.raw[i]?1:0;all.q[i]=Math.max(all.q[i],dc.q[i],nc.q[i]);}return all;}

function verticalHardCueConcentration(combined:Float32Array,depth:Float32Array,normal:Float32Array,w:number,h:number,p:Parameters){const tC=new Float32Array(combined.length),tD=new Float32Array(depth.length),tN=new Float32Array(normal.length);for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const src=y*w+x,dst=x*(h-1)+y;tC[dst]=combined[src];tD[dst]=depth[src];tN[dst]=normal[src];}const t=hardCueConcentration(tC,tD,tN,w,h-1,p),q=new Float32Array(combined.length),raw=new Uint8Array(combined.length);for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const dst=y*w+x,src=x*(h-1)+y;q[dst]=t.q[src];raw[dst]=t.raw[src];}return{q,raw};}

function edgeComponents(rawH:Uint8Array,rawV:Uint8Array,w:number,h:number,minLen:number){
  const keepH=new Uint8Array(rawH),keepV=new Uint8Array(rawV),removedH=new Uint8Array(rawH.length),removedV=new Uint8Array(rawV.length);
  type E={o:0|1;i:number;a:number;b:number};const edges:E[]=[];const at=new Map<number,number[]>();
  const add=(e:E)=>{const id=edges.length;edges.push(e);for(const p of[e.a,e.b]){const list=at.get(p)||[];list.push(id);at.set(p,list);}};
  const vw=w+1;
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++){const i=y*(w-1)+x;if(rawH[i])add({o:0,i,a:y*vw+x+1,b:(y+1)*vw+x+1});}
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const i=y*w+x;if(rawV[i])add({o:1,i,a:(y+1)*vw+x,b:(y+1)*vw+x+1});}
  const seen=new Uint8Array(edges.length);let components=0,removed=0;
  for(let s=0;s<edges.length;s++)if(!seen[s]){components++;const stack=[s],comp:number[]=[];seen[s]=1;while(stack.length){const id=stack.pop()!;comp.push(id);const e=edges[id];for(const p of[e.a,e.b])for(const n of at.get(p)||[])if(!seen[n]){seen[n]=1;stack.push(n);}}if(comp.length<minLen){removed++;for(const id of comp){const e=edges[id];if(e.o===0){keepH[e.i]=0;removedH[e.i]=1}else{keepV[e.i]=0;removedV[e.i]=1}}}}
  return{keepH,keepV,removedH,removedV,components,removed};
}

function labelRegions(valid:Uint8Array,w:number,h:number,bh:Uint8Array,bv:Uint8Array){
  const labels=new Int32Array(w*h).fill(-1),queue=new Int32Array(w*h);let count=0;
  for(let s=0;s<labels.length;s++)if(valid[s]&&labels[s]<0){let head=0,tail=0;queue[tail++]=s;labels[s]=count;while(head<tail){const a=queue[head++],x=a%w,y=(a/w)|0;const visit=(b:number,blocked:boolean)=>{if(valid[b]&&labels[b]<0&&!blocked){labels[b]=count;queue[tail++]=b;}};if(x>0)visit(a-1,!!bh[y*(w-1)+x-1]);if(x<w-1)visit(a+1,!!bh[y*(w-1)+x]);if(y>0)visit(a-w,!!bv[(y-1)*w+x]);if(y<h-1)visit(a+w,!!bv[y*w+x]);}count++;}
  return{labels,count};
}

function pruneSupport(labels:Int32Array,valid:Uint8Array,w:number,h:number,bh:Uint8Array,bv:Uint8Array,s:number,minFraction:number){
  const outH=new Uint8Array(bh),outV=new Uint8Array(bv),removedH=new Uint8Array(bh.length),removedV=new Uint8Array(bv.length),supportH=new Float32Array(bh.length),supportV=new Float32Array(bv.length);
  const offsets=[-4,-3,-2,-1,0,1,2,3,4];
  const test=(mx:number,my:number,a:number,b:number)=>{let ca=0,cb=0,total=0;for(const oy of offsets)for(const ox of offsets){const x=Math.round(mx+ox*s/8),y=Math.round(my+oy*s/8);if(x<0||x>=w||y<0||y>=h)continue;const p=y*w+x;if(!valid[p])continue;total++;if(labels[p]===a)ca++;if(labels[p]===b)cb++;}return total?Math.min(ca,cb)/total:0;};
  const sums=new Map<string,{sum:number;count:number}>(),key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`,add=(a:number,b:number,z:number)=>{const k=key(a,b),v=sums.get(k)||{sum:0,count:0};v.sum+=z;v.count++;sums.set(k,v);};
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++){const i=y*(w-1)+x;if(!bh[i])continue;const a=labels[y*w+x],b=labels[y*w+x+1],z=test(x+.5,y,a,b);supportH[i]=z;add(a,b,z);}
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!bv[i])continue;const a=labels[y*w+x],b=labels[(y+1)*w+x],z=test(x,y+.5,a,b);supportV[i]=z;add(a,b,z);}
  const supported=(a:number,b:number)=>{const v=sums.get(key(a,b));return !!v&&v.sum/v.count>=minFraction;};
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++){const i=y*(w-1)+x;if(bh[i]&&!supported(labels[y*w+x],labels[y*w+x+1])){outH[i]=0;removedH[i]=1;}}
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const i=y*w+x;if(bv[i]&&!supported(labels[y*w+x],labels[(y+1)*w+x])){outV[i]=0;removedV[i]=1;}}
  let removed=0;for(const z of removedH)removed+=z;for(const z of removedV)removed+=z;return{outH,outV,removedH,removedV,supportH,supportV,removed};
}

type Info={area:number;perimeter:number;maxDist:number;meanDepth:number;normal:[number,number,number];neighbors:Map<number,number>};
function regionInfo(labels:Int32Array,count:number,img:DepthImage,normals:Float32Array){
  const {width:w,height:h,depth,valid}=img,infos:Info[]=Array.from({length:count},()=>({area:0,perimeter:0,maxDist:0,meanDepth:0,normal:[0,0,0],neighbors:new Map()}));
  const dist=new Int16Array(w*h).fill(-1),q=new Int32Array(w*h);let head=0,tail=0;
  for(let p=0;p<labels.length;p++){const id=labels[p];if(id<0)continue;const x=p%w,y=(p/w)|0,I=infos[id];I.area++;I.meanDepth+=depth[p];I.normal[0]+=normals[p*3];I.normal[1]+=normals[p*3+1];I.normal[2]+=normals[p*3+2];let boundary=false;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h||!valid[yy*w+xx]||labels[yy*w+xx]!==id){I.perimeter++;boundary=true;const other=xx>=0&&xx<w&&yy>=0&&yy<h?labels[yy*w+xx]:-1;if(other>=0&&other!==id)I.neighbors.set(other,(I.neighbors.get(other)||0)+1);}}if(boundary){dist[p]=0;q[tail++]=p;}}
  while(head<tail){const p=q[head++],id=labels[p],x=p%w,y=(p/w)|0;infos[id].maxDist=Math.max(infos[id].maxDist,dist[p]);for(const b of[x? p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(b>=0&&labels[b]===id&&dist[b]<0){dist[b]=dist[p]+1;q[tail++]=b;}}
  for(const I of infos){I.meanDepth/=Math.max(1,I.area);const l=Math.hypot(...I.normal);if(l<1e-9)I.normal=[0,0,1];else I.normal=[I.normal[0]/l,I.normal[1]/l,I.normal[2]/l];}
  return infos;
}

function compactLabels(labels:Int32Array){const map=new Map<number,number>();let c=0;const out=new Int32Array(labels.length).fill(-1);for(let i=0;i<labels.length;i++){const v=labels[i];if(v<0)continue;if(!map.has(v))map.set(v,c++);out[i]=map.get(v)!;}return{labels:out,count:c};}

function mergeSmall(labels:Int32Array,count:number,img:DepthImage,normals:Float32Array,p:Parameters){
  let current=labels,currentCount=count,merges=0,belowTotal=0,converged=false,iterations=0;const belowMask=new Uint8Array(labels.length),mergeTargets=new Int32Array(labels.length).fill(-1);let sources:number[]=[];
  for(let iter=0;iter<32;iter++){iterations=iter+1;const info=regionInfo(current,currentCount,img,normals);if(!sources.length)sources=info.map(()=>1);const small=info.map(I=>2*I.maxDist<p.minimumDiameterFactor*p.minimumScale||I.area<p.minimumAreaFactor*p.minimumScale*p.minimumScale);if(iter===0){belowTotal=small.filter(Boolean).length;for(let i=0;i<current.length;i++)if(current[i]>=0&&small[current[i]])belowMask[i]=1;}if(!small.some(Boolean)){converged=true;break;}const dest=new Int32Array(currentCount).map((_,i)=>i);let changed=0;
    // Merge uphill by area (then toward the lower ID on ties). This makes the
    // simultaneous merge graph acyclic, so tiny regions cannot swap labels.
    for(let a=0;a<currentCount;a++)if(small[a]&&info[a].neighbors.size){let best=-1,cost=Infinity;for(const [b,shared]of info[a].neighbors){if(b<0||b>=currentCount||info[b].area<info[a].area||(info[b].area===info[a].area&&b>a))continue;const A=info[a],B=info[b],c=p.mergeNormalWeight*(angle(...A.normal,...B.normal)/Math.PI)+p.mergeDepthWeight*Math.abs(A.meanDepth-B.meanDepth)-shared/Math.max(1,A.perimeter);if(c<cost){cost=c;best=b;}}if(best>=0){dest[a]=best;changed++;merges++;}}
    if(!changed){converged=true;break;}for(let i=0;i<current.length;i++)if(current[i]>=0){const old=current[i];mergeTargets[i]=dest[old];current[i]=dest[old];}const c=compactLabels(current);current=c.labels;currentCount=c.count;
  }
  return{labels:current,count:currentCount,merges,belowTotal,belowMask,mergeTargets,converged,iterations};
}

function boundariesFromLabels(labels:Int32Array,w:number,h:number){const H=new Uint8Array((w-1)*h),V=new Uint8Array(w*(h-1));for(let y=0;y<h;y++)for(let x=0;x<w-1;x++){const a=labels[y*w+x],b=labels[y*w+x+1];if(a>=0&&b>=0&&a!==b)H[y*(w-1)+x]=1;}for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){const a=labels[y*w+x],b=labels[(y+1)*w+x];if(a>=0&&b>=0&&a!==b)V[y*w+x]=1;}return{H,V};}

function reconstruct(labels:Int32Array,count:number,img:DepthImage,normals:Float32Array,p:Parameters,sourceCounts:number[]){
  const {width:w,height:h,depth}=img,info=regionInfo(labels,count,img,normals),meanU=new Float64Array(count),meanV=new Float64Array(count);for(let i=0;i<labels.length;i++){const id=labels[i];if(id<0)continue;meanU[id]+=(i%w)/Math.max(1,w-1);meanV[id]+=((i/w)|0)/Math.max(1,h-1);}for(let id=0;id<count;id++){meanU[id]/=Math.max(1,info[id].area);meanV[id]/=Math.max(1,info[id].area);}
  const slopes=info.map(I=>{const tilt=Math.acos(clamp(I.normal[2],-1,1))*180/Math.PI;if(tilt<p.flatnessAngleDeg)return{a:0,b:0,clamped:false};let a=-I.normal[0]/(p.depthGeometryScale*Math.max(I.normal[2],1e-3)),b=-I.normal[1]/(p.depthGeometryScale*Math.max(I.normal[2],1e-3)),m=Math.hypot(a,b),clamped=false;if(m>p.maximumPlaneSlope){a*=p.maximumPlaneSlope/m;b*=p.maximumPlaneSlope/m;clamped=true;}return{a,b,clamped};});
  const raw=new Float32Array(depth.length),bounded=new Float32Array(depth.length),oor=new Uint8Array(depth.length),meanNormalMap=new Float32Array(depth.length*3);
  for(let i=0;i<labels.length;i++){const id=labels[i];if(id<0)continue;const u=(i%w)/Math.max(1,w-1),v=((i/w)|0)/Math.max(1,h-1),s=slopes[id],z=info[id].meanDepth+s.a*(u-meanU[id])+s.b*(v-meanV[id]);raw[i]=z;oor[i]=z<0||z>1?1:0;meanNormalMap[i*3]=info[id].normal[0];meanNormalMap[i*3+1]=info[id].normal[1];meanNormalMap[i*3+2]=info[id].normal[2];}
  for(let id=0;id<count;id++){let lo=-2,hi=2;for(let it=0;it<40;it++){const mid=(lo+hi)/2;let sum=0,n=0;for(let i=0;i<labels.length;i++)if(labels[i]===id){sum+=clamp(raw[i]+mid);n++;}if(sum/Math.max(1,n)<info[id].meanDepth)lo=mid;else hi=mid;}const off=(lo+hi)/2;for(let i=0;i<labels.length;i++)if(labels[i]===id)bounded[i]=clamp(raw[i]+off);}
  const chosen=p.boundedReconstruction?bounded:raw,residual=new Float32Array(depth.length),absResidual=new Float32Array(depth.length);for(let i=0;i<depth.length;i++){residual[i]=depth[i]-chosen[i];absResidual[i]=Math.abs(residual[i]);}
  const stats:RegionStat[]=info.map((I,id)=>{let out=0,se=0,mx=0;for(let i=0;i<labels.length;i++)if(labels[i]===id){out+=chosen[i];se+=residual[i]*residual[i];mx=Math.max(mx,Math.abs(residual[i]));}out/=Math.max(1,I.area);const violation=2*I.maxDist<p.minimumDiameterFactor*p.minimumScale||I.area<p.minimumAreaFactor*p.minimumScale*p.minimumScale;return{id,area:I.area,perimeter:I.perimeter,diameter:2*I.maxDist,meanDepth:I.meanDepth,meanOutputDepth:out,meanDepthError:out-I.meanDepth,meanNormal:I.normal,slope:[slopes[id].a,slopes[id].b],kind:slopes[id].a===0&&slopes[id].b===0?"flat":"gradient",rmse:Math.sqrt(se/Math.max(1,I.area)),maxResidual:mx,sourceRegions:sourceCounts[id]||1,scaleStatus:violation?"violation":"passes",slopeClamped:slopes[id].clamped};});
  return{raw,bounded:chosen,oor,residual,absResidual,meanNormalMap,stats};
}

export function runPipeline(input:DepthImage,p:Parameters):PipelineResult{
  if(input.width<2||input.height<2)throw new Error("The working image must be at least 2 × 2 pixels.");if(!input.valid.some(Boolean))throw new Error("The image contains no valid pixels.");
  const t0=now(),timings:Record<string,number>={};let t=t0;const mark=(name:string)=>{const n=now();timings[name]=n-t;t=n;};
  const depth=new Float32Array(input.depth);if(p.whiteIsNear)for(let i=0;i<depth.length;i++)if(input.valid[i])depth[i]=1-depth[i];const img={...input,depth};mark("normalize");
  const {smoothed,normals}=estimateNormals(depth,input.valid,input.width,input.height,p.smoothingSigma,p.depthGeometryScale);mark("normals");
  const c=linkChanges(img,normals,p);mark("link changes");const qh=hardCueConcentration(c.ch,c.dh,c.ah,input.height,input.width-1,p);const qv=verticalHardCueConcentration(c.cv,c.dv,c.av,input.width,input.height,p);mark("hard edges");
  const comps=edgeComponents(qh.raw,qv.raw,input.width,input.height,p.minimumBoundaryLengthFactor*p.minimumScale);mark("edge length");const posterized=continuityPartition(img,p,c.ch,c.cv,qh.q,qv.q,comps.keepH,comps.keepV);const pb=boundariesFromLabels(posterized.labels,input.width,input.height);mark("continuity partition");const support=pruneSupport(posterized.labels,input.valid,input.width,input.height,pb.H,pb.V,p.minimumScale,p.minimumSideSupportFraction);const supported=labelRegions(input.valid,input.width,input.height,support.outH,support.outV);mark("scale support");
  const merged=mergeSmall(supported.labels,supported.count,img,normals,p);mark("region merging");const fb=boundariesFromLabels(merged.labels,input.width,input.height);const sourceCounts=Array.from({length:merged.count},()=>1);const rec=reconstruct(merged.labels,merged.count,img,normals,p,sourceCounts);mark("reconstruction");
  const violations=rec.stats.filter(x=>x.scaleStatus==="violation").length;const result:PipelineResult={width:input.width,height:input.height,depth,valid:input.valid,smoothed,normals,depthChangeH:c.dh,depthChangeV:c.dv,normalChangeH:c.ah,normalChangeV:c.av,combinedH:c.ch,combinedV:c.cv,concentrationH:qh.q,concentrationV:qv.q,rawH:qh.raw,rawV:qv.raw,retainedH:fb.H,retainedV:fb.V,removedShortH:comps.removedH,removedShortV:comps.removedV,removedSupportH:support.removedH,removedSupportV:support.removedV,supportH:posterized.evidenceH,supportV:posterized.evidenceV,initialLabels:supported.labels,belowScaleMask:merged.belowMask,mergeTargets:merged.mergeTargets,finalLabels:merged.labels,meanNormalMap:rec.meanNormalMap,reconstruction:rec.bounded,unclippedReconstruction:rec.raw,outOfRange:rec.oor,residual:rec.residual,absResidual:rec.absResidual,stats:rec.stats,audit:{minimumScale:p.minimumScale,minimumEdgeLength:p.minimumBoundaryLengthFactor*p.minimumScale,minimumRegionDiameter:p.minimumDiameterFactor*p.minimumScale,minimumRegionArea:p.minimumAreaFactor*p.minimumScale*p.minimumScale,rawComponents:comps.components,microRegions:posterized.microRegionCount,agglomerationMerges:posterized.merges,agglomerationPasses:posterized.passes,removedShortComponents:comps.removed,removedUnsupportedLinks:support.removed,provisionalRegions:supported.count,belowScaleRegions:merged.belowTotal,mergeOperations:merged.merges,finalRegions:merged.count,finalViolations:violations,converged:posterized.converged&&merged.converged,iterations:merged.iterations},timings,totalMs:now()-t0};return result;
}
