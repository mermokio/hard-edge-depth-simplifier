/// <reference lib="webworker" />
import { runPipeline } from "../algorithm/pipeline";
import type { DepthImage, Parameters } from "../algorithm/types";

let latest=0;const cache=new Map<string,unknown>();
self.onmessage=(event:MessageEvent<{id:number;image:DepthImage;parameters:Parameters}>)=>{const{id,image,parameters}=event.data;latest=Math.max(latest,id);try{const key=JSON.stringify([image.name,image.width,image.height,parameters]);let result=cache.get(key);if(!result){result=runPipeline(image,parameters);cache.clear();cache.set(key,result);}if(id===latest)self.postMessage({id,result});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}};
