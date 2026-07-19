import type { DepthImage } from "./types";

export type SyntheticExample = { id: string; name: string; expectation: string; create?: (w?: number, h?: number) => DepthImage };
const make = (name: string, fn: (u: number, v: number) => number, w = 192, h = 144): DepthImage => {
  const depth = new Float32Array(w * h), valid = new Uint8Array(w * h).fill(1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) depth[y * w + x] = Math.max(0, Math.min(1, fn(x / (w - 1), y / (h - 1))));
  return { width: w, height: h, depth, valid, name };
};
const circle = (u: number, v: number, cx=.5, cy=.5, r=.28) => Math.hypot(u-cx, v-cy) <= r;

export const SYNTHETIC_EXAMPLES: SyntheticExample[] = [
  { id:"city", name:"City street depth map", expectation:"Preserve the large street, façade, tree, and distant-building depth structures while absorbing window-scale texture. This example automatically loads a city-tuned partition preset."},
  { id:"cylinder", name:"Cylinder", expectation:"Preserve the silhouette; keep the varying normal field as one cylinder partition and reconstruct it with one plane.", create:(w,h)=>make("Cylinder",(u,v)=>{const x=(u-.5)/.27; return Math.abs(x)<=1 && v>.14&&v<.86 ? .42+.28*Math.sqrt(Math.max(0,1-x*x)):.18;},w,h)},
  { id:"sphere", name:"Sphere", expectation:"Preserve only the outer silhouette; do not facet the smooth sphere interior.", create:(w,h)=>make("Sphere",(u,v)=>{const x=(u-.5)/.29,y=(v-.5)/.29,r2=x*x+y*y; return r2<=1?.4+.3*Math.sqrt(1-r2):.15;},w,h)},
  { id:"sharp-corner", name:"Sharp building corner", expectation:"Preserve the central crease when both planar sides exceed the selected scale.", create:(w,h)=>make("Sharp building corner",(u)=>u<.5?.2+.35*u:.65-.25*u,w,h)},
  { id:"rounded-corner", name:"Rounded building corner", expectation:"Treat the distributed turn as one partition, not several planar facets.", create:(w,h)=>make("Rounded building corner",(u)=>.25+.32*(.5+.5*Math.tanh((u-.5)*5)),w,h)},
  { id:"tilted-plane", name:"Tilted plane", expectation:"Produce one gradient partition with the correct average slope.", create:(w,h)=>make("Tilted plane",(u,v)=>.18+.45*u+.16*v,w,h)},
  { id:"small-window", name:"Wall + small recessed window", expectation:"Detect raw edges, then remove the window when its width is below s.", create:(w,h)=>make("Small recessed window",(u,v)=>u>.43&&u<.57&&v>.39&&v<.61?.34:.58,w,h)},
  { id:"large-window", name:"Wall + large recessed window", expectation:"Keep the recess when its support and diameter exceed s.", create:(w,h)=>make("Large recessed window",(u,v)=>u>.28&&u<.72&&v>.25&&v<.75?.32:.58,w,h)},
  { id:"small-square", name:"Small sharp square", expectation:"Show its raw boundary, then merge it once s exceeds its diameter.", create:(w,h)=>make("Small sharp square",(u,v)=>Math.abs(u-.5)<.055&&Math.abs(v-.5)<.055?.78:.3,w,h)},
  { id:"large-square", name:"Large sharp square", expectation:"Keep the square as an independent region above the selected scale.", create:(w,h)=>make("Large sharp square",(u,v)=>Math.abs(u-.5)<.2&&Math.abs(v-.5)<.2?.78:.3,w,h)},
  { id:"smooth-bump", name:"Smooth bump", expectation:"Do not create a boundary around a distributed smooth change.", create:(w,h)=>make("Smooth bump",(u,v)=>.28+.34*Math.exp(-((u-.5)**2+(v-.5)**2)/.035),w,h)},
  { id:"thin-groove", name:"Thin sharp groove", expectation:"Detect the groove initially, then remove it when it lacks two-sided scale support.", create:(w,h)=>make("Thin sharp groove",(u)=>Math.abs(u-.5)<.025?.18:.58,w,h)},
  { id:"mixed", name:"Mixed scene", expectation:"Keep the large corner and cylinder silhouette while removing the tiny sharp detail.", create:(w,h)=>make("Mixed scene",(u,v)=>{let d=u<.5?.22+.18*u:.52-.12*u; if(circle(u,v,.7,.58,.18)){const x=(u-.7)/.18;d=.55+.18*Math.sqrt(Math.max(0,1-x*x));}if(Math.abs(u-.2)<.035&&Math.abs(v-.28)<.035)d=.82;return d;},w,h)},
];

export const getSynthetic = (id: string, w?: number, h?: number) => (SYNTHETIC_EXAMPLES.find(x=>x.id===id)?.create || SYNTHETIC_EXAMPLES.find(x=>x.id==="cylinder")!.create!)(w,h);
