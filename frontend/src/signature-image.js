import {SIGNATURE_WIDTH,SIGNATURE_HEIGHT} from './signature-utils'

export async function extractSignatureImage(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG, or WebP signature image.')
 if(file.size>8*1024*1024)throw new Error('Choose a signature image smaller than 8 MB.')
 let imageUrl
 let source
 if(typeof createImageBitmap==='function')source=await createImageBitmap(file)
 else{
  imageUrl=URL.createObjectURL(file)
  try{source=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The signature image could not be opened.'));image.src=imageUrl})}
  catch(error){URL.revokeObjectURL(imageUrl);throw error}
 }
 try{
  const scale=Math.min(1,1200/source.width,600/source.height)
  const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale))
  const work=document.createElement('canvas');work.width=width;work.height=height
  const context=work.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,width,height)
  const image=context.getImageData(0,0,width,height),pixels=image.data
  let left=width,top=height,right=-1,bottom=-1,ink=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const index=(y*width+x)*4,alpha=pixels[index+3]/255
   const brightness=(pixels[index]+pixels[index+1]+pixels[index+2])/3
   const opacity=alpha*Math.max(0,Math.min(1,(225-brightness)/90))
   pixels[index]=20;pixels[index+1]=46;pixels[index+2]=87;pixels[index+3]=Math.round(opacity*255)
   if(opacity>.3){ink++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  }
  if(ink<40||right-left<12||bottom-top<3)throw new Error('No clear signature was found. Upload a close, well-lit image of your signature.')
  context.putImageData(image,0,0)
  const result=document.createElement('canvas');result.width=SIGNATURE_WIDTH;result.height=SIGNATURE_HEIGHT
  const inset=12,sourceWidth=right-left+1,sourceHeight=bottom-top+1
  const fit=Math.min((SIGNATURE_WIDTH-inset*2)/sourceWidth,(SIGNATURE_HEIGHT-inset*2)/sourceHeight)
  const drawWidth=sourceWidth*fit,drawHeight=sourceHeight*fit
  result.getContext('2d').drawImage(work,left,top,sourceWidth,sourceHeight,(SIGNATURE_WIDTH-drawWidth)/2,(SIGNATURE_HEIGHT-drawHeight)/2,drawWidth,drawHeight)
  const data=result.toDataURL('image/png')
  if(data.length>700000)throw new Error('The extracted signature is too large. Try a simpler image.')
  return {type:'image',data}
 }finally{source.close?.();if(imageUrl)URL.revokeObjectURL(imageUrl)}
}
