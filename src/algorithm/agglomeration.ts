import type { DepthImage, Parameters } from "./types";

type HeapNode={pixel:number;cost:number;seed:number};
class MinHeap{
  private data:HeapNode[]=[];
  get length(){return this.data.length;}
  push(v:HeapNode){const a=this.data;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(compare(a[p],v)<=0)break;a[i]=a[p];i=p;}a[i]=v;}
  pop(){const a=this.data,root=a[0],last=a.pop()!;if(a.length){let i=0;while(true){let c=i*2+1;if(c>=a.length)break;if(c+1<a.length&&compare(a[c+1],a[c])<0)c++;if(compare(a[c],last)>=0)break;a[i]=a[c];i=c;}a[i]=last;}return root;}
}
const compare=(a:HeapNode,b:HeapNode)=>a.cost-b.cost||a.seed-b.seed||a.pixel-b.pixel;
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));

/** Local hard evidence. A high value requires both a strong change and spatial concentration. */
function evidence(change:Float32Array,concentration:Float32Array,raw:Uint8Array){
  const out=new Float32Array(change.length);
  for(let i=0;i<out.length;i++)out[i]=raw[i]?1:clamp01(change[i])*Math.pow(clamp01(concentration[i]),1.5);
  return out;
}

function compact(labels:Int32Array){const ids=new Map<number,number>();let count=0;const out=new Int32Array(labels.length).fill(-1);for(let i=0;i<labels.length;i++){const id=labels[i];if(id<0)continue;if(!ids.has(id))ids.set(id,count++);out[i]=ids.get(id)!;}return{labels:out,count};}

function watershed(valid:Uint8Array,w:number,h:number,eh:Float32Array,ev:Float32Array,spacing:number){
  const labels=new Int32Array(w*h).fill(-1),cost=new Float32Array(w*h);cost.fill(Infinity);const heap=new MinHeap();let seeds=0;
  for(let y0=0;y0<h;y0+=spacing)for(let x0=0;x0<w;x0+=spacing){const x1=Math.min(w,x0+spacing),y1=Math.min(h,y0+spacing),cx=(x0+x1-1)/2,cy=(y0+y1-1)/2;let best=-1,bestD=Infinity;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*w+x;if(!valid[p])continue;const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(d<bestD){bestD=d;best=p;}}if(best>=0){labels[best]=seeds;cost[best]=0;heap.push({pixel:best,cost:0,seed:seeds++});}}
  const relax=(from:number,to:number,barrier:number,seed:number,base:number)=>{if(!valid[to])return;const next=Math.max(base,barrier);if(next+1e-7<cost[to]||(Math.abs(next-cost[to])<=1e-7&&seed<labels[to])){cost[to]=next;labels[to]=seed;heap.push({pixel:to,cost:next,seed});}};
  while(heap.length){const n=heap.pop();if(n.cost!==cost[n.pixel]||n.seed!==labels[n.pixel])continue;const x=n.pixel%w,y=(n.pixel/w)|0;if(x)relax(n.pixel,n.pixel-1,eh[y*(w-1)+x-1],n.seed,n.cost);if(x<w-1)relax(n.pixel,n.pixel+1,eh[y*(w-1)+x],n.seed,n.cost);if(y)relax(n.pixel,n.pixel-w,ev[(y-1)*w+x],n.seed,n.cost);if(y<h-1)relax(n.pixel,n.pixel+w,ev[y*w+x],n.seed,n.cost);}
  // A tile seed normally reaches its whole valid component. Seed any exceptional
  // disconnected island and run the same deterministic expansion once more.
  for(let start=0;start<labels.length;start++)if(valid[start]&&labels[start]<0){labels[start]=seeds;cost[start]=0;heap.push({pixel:start,cost:0,seed:seeds++});while(heap.length){const n=heap.pop();if(n.cost!==cost[n.pixel]||n.seed!==labels[n.pixel])continue;const x=n.pixel%w,y=(n.pixel/w)|0;if(x)relax(n.pixel,n.pixel-1,eh[y*(w-1)+x-1],n.seed,n.cost);if(x<w-1)relax(n.pixel,n.pixel+1,eh[y*(w-1)+x],n.seed,n.cost);if(y)relax(n.pixel,n.pixel-w,ev[(y-1)*w+x],n.seed,n.cost);if(y<h-1)relax(n.pixel,n.pixel+w,ev[y*w+x],n.seed,n.cost);}}
  return compact(labels);
}

type Interface={a:number;b:number;sum:number;hard:number;length:number};
function interfaces(labels:Int32Array,w:number,h:number,eh:Float32Array,ev:Float32Array){
  const map=new Map<string,Interface>();const add=(a:number,b:number,e:number)=>{if(a<0||b<0||a===b)return;if(a>b)[a,b]=[b,a];const key=`${a}:${b}`;let z=map.get(key);if(!z){z={a,b,sum:0,hard:0,length:0};map.set(key,z);}z.sum+=e;z.hard+=e>=.55?1:0;z.length++;};
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++)add(labels[y*w+x],labels[y*w+x+1],eh[y*(w-1)+x]);
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++)add(labels[y*w+x],labels[(y+1)*w+x],ev[y*w+x]);
  return [...map.values()];
}

function agglomerate(labels:Int32Array,count:number,w:number,h:number,eh:Float32Array,ev:Float32Array,threshold:number){
  let current=labels,currentCount=count,merges=0,passes=0,converged=false;
  for(let pass=0;pass<32;pass++){passes=pass+1;const parent=Int32Array.from({length:currentCount},(_,i)=>i),find=(a:number):number=>parent[a]===a?a:(parent[a]=find(parent[a]));let changed=0;
    const candidates=interfaces(current,w,h,eh,ev).map(z=>({...z,barrier:.45*(z.sum/z.length)+.55*(z.hard/z.length)})).filter(z=>z.barrier<threshold).sort((a,b)=>a.barrier-b.barrier||b.length-a.length||a.a-b.a||a.b-b.b);
    for(const z of candidates){const a=find(z.a),b=find(z.b);if(a===b)continue;parent[Math.max(a,b)]=Math.min(a,b);changed++;merges++;}
    if(!changed){converged=true;break;}const next=new Int32Array(current.length).fill(-1);for(let i=0;i<current.length;i++)if(current[i]>=0)next[i]=find(current[i]);const c=compact(next);current=c.labels;currentCount=c.count;
  }
  return{labels:current,count:currentCount,merges,passes,converged};
}

export function continuityPartition(img:DepthImage,p:Parameters,combinedH:Float32Array,combinedV:Float32Array,concentrationH:Float32Array,concentrationV:Float32Array,rawH:Uint8Array,rawV:Uint8Array){
  const eh=evidence(combinedH,concentrationH,rawH),ev=evidence(combinedV,concentrationV,rawV);
  const micro=watershed(img.valid,img.width,img.height,eh,ev,Math.max(2,Math.round(p.microRegionSize)));
  const joined=agglomerate(micro.labels,micro.count,img.width,img.height,eh,ev,p.interfaceHardCoverage);
  return{...joined,microRegionCount:micro.count,evidenceH:eh,evidenceV:ev};
}
