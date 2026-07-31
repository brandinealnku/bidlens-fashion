export type PreparedImage={blob:Blob;width:number;height:number;dispose:()=>void};

/** Decodes orientation, limits iPhone screenshot memory, and applies a gentle contrast pass. */
export async function prepareImage(source:Blob|string,crop?:{x:number;y:number;width:number;height:number}):Promise<PreparedImage>{
 const blob=typeof source==='string'?await(await fetch(source)).blob():source;
 const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});
 const region=crop??{x:0,y:0,width:bitmap.width,height:bitmap.height};
 const maxDimension=2400,scale=Math.min(1,maxDimension/Math.max(region.width,region.height));
 const width=Math.max(1,Math.round(region.width*scale)),height=Math.max(1,Math.round(region.height*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context){bitmap.close();throw new Error('Image preparation is unavailable.');}
 context.filter='contrast(1.14)';context.drawImage(bitmap,region.x,region.y,region.width,region.height,0,0,width,height);context.filter='none';bitmap.close();
 const output=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Image preparation failed.')),'image/jpeg',.92));
 return{blob:output,width,height,dispose:()=>{canvas.width=1;canvas.height=1}};
}
