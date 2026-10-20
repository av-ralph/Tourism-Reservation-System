import assert from 'node:assert/strict'
import {removeSignatureBackground} from '../src/signature-image.js'

function sample(background,alpha=255){
 const width=80,height=30,pixels=new Uint8ClampedArray(width*height*4)
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const index=(y*width+x)*4
  const ink=x>=12&&x<=60&&y>=8&&y<=19&&(x+y)%3!==0
  const color=ink?[20,30,55]:background
  pixels.set([...color,ink?255:alpha],index)
 }
 return {pixels,width,height}
}
for(const background of [[255,255,255],[225,218,205],[185,200,215]]){
 const {pixels,width,height}=sample(background)
 const box=removeSignatureBackground(pixels,width,height)
 assert.deepEqual(box,{left:12,top:8,right:60,bottom:19})
 assert.equal(pixels[3],0,'Background is fully transparent')
 assert(pixels[(10*width+21)*4+3]>180,'Ink remains visible')
}
{
 const {pixels,width,height}=sample([0,0,0],0)
 removeSignatureBackground(pixels,width,height)
 assert.equal(pixels[3],0,'Existing transparent background stays transparent')
}
{
 const {pixels,width,height}=sample([40,40,40])
 assert.throws(()=>removeSignatureBackground(pixels,width,height),/plain light background/)
}
console.log('Passed: uploaded signature backgrounds are transparent; ink remains visible; unsuitable dark backgrounds are rejected.')
