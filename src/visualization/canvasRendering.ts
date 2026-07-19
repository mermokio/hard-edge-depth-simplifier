import type { PipelineResult } from "../algorithm/types";

export type StageKey="input"|"smoothed"|"normals"|"depthChanges"|"normalChanges"|"combined"|"concentration"|"rawEdges"|"removedEdges"|"initialRegions"|"support"|"belowScale"|"merges"|"finalRegions"|"overlay"|"averageNormals"|"reconstruction"|"residual"|"absResidual";
export const colorForRegion=(id:number)=>{if(id<0)return[0,0,0] as const;const hue=(id*137.508)%360,s=.57,l=.54,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((hue/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;if(hue<60)[r,g]=[c,x];else if(hue<120)[r,g]=[x,c];else if(hue<180)[g,b]=[c,x];else if(hue<240)[g,b]=[x,c];else if(hue<300)[r,b]=[x,c];else[r,b]=[c,x];return[Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)] as const;};
const heat=(v:number)=>{const t=Math.max(0,Math.min(1,v));return[Math.round(255*Math.min(1,t*2)),Math.round(255*Math.max(0,1-Math.abs(t*2-1))),Math.round(255*Math.max(0,1-t*2))] as const;};
const linkPixel=(h:Float32Array,v:Float32Array,x:number,y:number,w:number,ht:number)=>Math.max(x<w-1?h[y*(w-1)+x]:0,x?h[y*(w-1)+x-1]:0,y<ht-1?v[y*w+x]:0,y?v[(y-1)*w+x]:0);
const edgePixel=(h:Uint8Array,v:Uint8Array,x:number,y:number,w:number,ht:number)=>linkPixel(h as unknown as Float32Array,v as unknown as Float32Array,x,y,w,ht)>0;
export function renderStage(r:PipelineResult,key:StageKey):ImageData{const{width:w,height:h}=r,data=r.depth;const out=new ImageData(w,h);let max=1;if(key==="residual")for(const v of r.absResidual)max=Math.max(max,Math.abs(v)*8);if(key==="absResidual")for(const v of r.absResidual)max=Math.max(max,v*8);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x,j=p*4;if(!r.valid[p]){out.data[j+3]=0;continue;}let rgb:readonly [number,number,number]=[0,0,0],z=0;
    if(key==="input"||key==="smoothed"||key==="reconstruction"){z=key==="input"?data[p]:key==="smoothed"?r.smoothed[p]:r.reconstruction[p];rgb=[z*255,z*255,z*255];}
    else if(key==="normals"||key==="averageNormals"){const n=key==="normals"?r.normals:r.meanNormalMap;rgb=[(n[p*3]*.5+.5)*255,(n[p*3+1]*.5+.5)*255,(n[p*3+2]*.5+.5)*255];}
    else if(key==="depthChanges"||key==="normalChanges"||key==="combined"||key==="concentration"||key==="support"){const A=key==="depthChanges"?[r.depthChangeH,r.depthChangeV]:key==="normalChanges"?[r.normalChangeH,r.normalChangeV]:key==="combined"?[r.combinedH,r.combinedV]:key==="concentration"?[r.concentrationH,r.concentrationV]:[r.supportH,r.supportV];z=linkPixel(A[0],A[1],x,y,w,h);rgb=heat(key==="support"?z/.45:Math.min(1,z));}
    else if(key==="initialRegions"||key==="finalRegions"){rgb=[...colorForRegion((key==="initialRegions"?r.initialLabels:r.finalLabels)[p])];}
    else if(key==="belowScale"){rgb=r.belowScaleMask[p]?[246,95,68]:[45,48,48];}
    else if(key==="merges"){const id=r.mergeTargets[p];rgb=id>=0?[...colorForRegion(id)]:[35,37,37];}
    else if(key==="residual"){z=r.residual[p]/(max||1);rgb=z>=0?[255,255*(1-z),255*(1-z)]:[255*(1+z),255*(1+z),255];}
    else if(key==="absResidual"){rgb=heat(r.absResidual[p]/(max||1));}
    else if(key==="overlay"){z=data[p]*255;rgb=[z,z,z];if(edgePixel(r.retainedH,r.retainedV,x,y,w,h))rgb=[253,188,66];}
    else {const raw=edgePixel(r.rawH,r.rawV,x,y,w,h),short=edgePixel(r.removedShortH,r.removedShortV,x,y,w,h),support=edgePixel(r.removedSupportH,r.removedSupportV,x,y,w,h);rgb=key==="rawEdges"?(raw?[246,192,71]:[24,26,26]):support?[172,92,232]:short?[239,87,72]:raw?[80,216,170]:[24,26,26];}
    out.data[j]=rgb[0];out.data[j+1]=rgb[1];out.data[j+2]=rgb[2];out.data[j+3]=255;
  }return out;}

export function imageDataToCanvas(image:ImageData,canvas:HTMLCanvasElement){canvas.width=image.width;canvas.height=image.height;canvas.getContext("2d")!.putImageData(image,0,0);}
export function downloadCanvas(image:ImageData,name:string){const c=document.createElement("canvas");imageDataToCanvas(image,c);c.toBlob(b=>{if(!b)return;const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);},"image/png");}
