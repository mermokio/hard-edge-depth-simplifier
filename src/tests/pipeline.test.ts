import { describe, expect, it } from "vitest";
import { runPipeline } from "../algorithm/pipeline";
import { DEFAULT_PARAMETERS, type DepthImage } from "../algorithm/types";
import { getSynthetic } from "../algorithm/syntheticDepthMaps";

const make=(w:number,h:number,fn:(u:number,v:number)=>number):DepthImage=>{const depth=new Float32Array(w*h),valid=new Uint8Array(w*h).fill(1);for(let y=0;y<h;y++)for(let x=0;x<w;x++)depth[y*w+x]=fn(x/(w-1),y/(h-1));return{width:w,height:h,depth,valid};};
const params={...DEFAULT_PARAMETERS,minimumScale:10,minimumBoundaryLengthFactor:.5,minimumSideSupportFraction:.1,minimumAreaFactor:.2};

describe("scale-constrained hard-edge pipeline",()=>{
  it("keeps a constant plane as one unchanged partition",()=>{const img=make(64,48,()=>.42),r=runPipeline(img,params);expect(r.audit.finalRegions).toBe(1);expect(Math.max(...r.absResidual)).toBeLessThan(1e-5);});
  it("reconstructs a tilted plane as one gradient with the correct mean",()=>{const img=make(72,50,(u,v)=>.2+.25*u+.1*v),r=runPipeline(img,{...params,smoothingSigma:0});expect(r.audit.finalRegions).toBe(1);expect(r.stats[0].kind).toBe("gradient");expect(Math.abs(r.stats[0].meanDepthError)).toBeLessThan(1e-5);expect(r.stats[0].slope[0]).toBeCloseTo(.25,1);});
  it("retains a supported hard depth step",()=>{const r=runPipeline(make(80,50,u=>u<.5?.2:.75),params);expect(r.audit.finalRegions).toBe(2);});
  it("retains a continuous sharp normal crease",()=>{const r=runPipeline(make(90,54,u=>.25+.35*Math.abs(u-.5)),{...params,normalJumpThresholdDeg:8});expect(r.audit.finalRegions).toBeGreaterThanOrEqual(2);});
  it("does not facet a cylinder interior and represents it with one region",()=>{const r=runPipeline(getSynthetic("cylinder",128,96),{...params,minimumScale:12});const cy=r.finalLabels[48*128+64],left=r.finalLabels[48*128+50],right=r.finalLabels[48*128+78];expect(cy).toBe(left);expect(cy).toBe(right);expect(r.stats.filter(s=>s.id===cy)).toHaveLength(1);});
  it("does not create a hard boundary in a rounded corner",()=>{const r=runPipeline(getSynthetic("rounded-corner",112,80),params);expect(r.audit.finalRegions).toBe(1);});
  it("detects then removes a below-scale square",()=>{const r=runPipeline(getSynthetic("small-square",120,90),{...params,minimumScale:28});expect(r.rawH.some(Boolean)||r.rawV.some(Boolean)).toBe(true);expect(r.audit.finalRegions).toBe(1);});
  it("keeps a large supported square",()=>{const r=runPipeline(getSynthetic("large-square",120,90),{...params,minimumScale:12});expect(r.audit.finalRegions).toBeGreaterThan(1);});
  it("preserves the mean depth of every final region",()=>{const r=runPipeline(getSynthetic("mixed",120,90),params);for(const s of r.stats)expect(Math.abs(s.meanDepthError)).toBeLessThan(2e-5);});
  it("is deterministic",()=>{const img=getSynthetic("sphere",90,90),a=runPipeline(img,params),b=runPipeline(img,params);expect(Array.from(a.finalLabels)).toEqual(Array.from(b.finalLabels));expect(Array.from(a.reconstruction)).toEqual(Array.from(b.reconstruction));});
  it("handles the one-region case when all boundaries are removed",()=>{const r=runPipeline(getSynthetic("small-window",90,70),{...params,minimumScale:40,minimumBoundaryLengthFactor:4});expect(r.audit.finalRegions).toBe(1);expect(r.stats).toHaveLength(1);});
  it("excludes invalid pixels from statistics",()=>{const img=make(32,24,()=>.5);for(let y=8;y<16;y++)for(let x=10;x<18;x++){const p=y*32+x;img.valid[p]=0;img.depth[p]=NaN;}const r=runPipeline(img,params);expect(r.stats.every(s=>Number.isFinite(s.meanDepth))).toBe(true);expect(r.finalLabels[10*32+12]).toBe(-1);});
});
