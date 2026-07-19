import type { DepthImage } from "./types";

export async function decodeDepthImage(file:File,maxDimension:number):Promise<DepthImage>{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error("Choose a PNG, JPEG, or WebP image.");
  let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error("The image could not be decoded.");}
  if(!bitmap.width||!bitmap.height){bitmap.close();throw new Error("The image has no pixels.");}
  const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height)),w=Math.max(2,Math.round(bitmap.width*scale)),h=Math.max(2,Math.round(bitmap.height*scale));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw new Error("Canvas image decoding is unavailable.");ctx.drawImage(bitmap,0,0,w,h);bitmap.close();const rgba=ctx.getImageData(0,0,w,h).data,depth=new Float32Array(w*h),valid=new Uint8Array(w*h);let count=0;
  for(let i=0;i<w*h;i++){const a=rgba[i*4+3];if(a===0)continue;valid[i]=1;count++;depth[i]=(0.2126*rgba[i*4]+0.7152*rgba[i*4+1]+0.0722*rgba[i*4+2])/255;}
  if(!count)throw new Error("The image is completely transparent.");return{width:w,height:h,depth,valid,name:file.name};
}
