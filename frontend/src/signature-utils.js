export const SIGNATURE_WIDTH=600
export const SIGNATURE_HEIGHT=180

export function signatureIsMeaningful(strokes){
 if(strokes?.type==='image')return typeof strokes.data==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(strokes.data)&&strokes.data.length>150&&strokes.data.length<=700000
 if(!Array.isArray(strokes))return false
 const points=strokes.flat()
 if(points.length<8)return false
 const xs=points.map(point=>point[0]),ys=points.map(point=>point[1])
 const length=strokes.reduce((sum,stroke)=>sum+stroke.slice(1).reduce((distance,point,index)=>distance+Math.hypot(point[0]-stroke[index][0],point[1]-stroke[index][1]),0),0)
 return Math.max(...xs)-Math.min(...xs)>=25&&Math.max(...ys)-Math.min(...ys)>=8&&length>=75
}

export function smoothSignaturePoints(stroke){
 if(stroke.length<3)return stroke
 return stroke.map((point,index)=>{
  if(index===0||index===stroke.length-1)return point
  const neighbors=[stroke[Math.max(0,index-2)],stroke[index-1],point,stroke[index+1],stroke[Math.min(stroke.length-1,index+2)]]
  const weights=[1,2,4,2,1]
  const target=[0,1].map(axis=>neighbors.reduce((sum,neighbor,neighborIndex)=>sum+neighbor[axis]*weights[neighborIndex],0)/10)
  const shift=Math.hypot(target[0]-point[0],target[1]-point[1])
  const amount=shift>3?3/shift:1
  return [point[0]+(target[0]-point[0])*amount,point[1]+(target[1]-point[1])*amount]
 })
}

export function signaturePath(stroke){
 if(stroke.length<2)return ''
 const points=smoothSignaturePoints(stroke)
 if(points.length===2)return `M${points[0][0]} ${points[0][1]} L${points[1][0]} ${points[1][1]}`
 let path=`M${points[0][0]} ${points[0][1]}`
 for(let index=1;index<points.length-1;index++){
  const middle=[(points[index][0]+points[index+1][0])/2,(points[index][1]+points[index+1][1])/2]
  path+=` Q${points[index][0]} ${points[index][1]} ${middle[0]} ${middle[1]}`
 }
 const last=points.at(-1)
 return path+` Q${last[0]} ${last[1]} ${last[0]} ${last[1]}`
}

export function drawSignature(context,strokes){
 context.clearRect(0,0,SIGNATURE_WIDTH,SIGNATURE_HEIGHT)
 context.strokeStyle='#142e57';context.lineWidth=3.2;context.lineCap='round';context.lineJoin='round'
 for(const stroke of strokes){
  const points=smoothSignaturePoints(stroke)
  if(points.length<2)continue
  context.beginPath();context.moveTo(...points[0])
  if(points.length===2)context.lineTo(...points[1])
  else{
   for(let index=1;index<points.length-1;index++)context.quadraticCurveTo(...points[index],(points[index][0]+points[index+1][0])/2,(points[index][1]+points[index+1][1])/2)
   context.quadraticCurveTo(...points.at(-1),...points.at(-1))
  }
  context.stroke()
 }
}

export function signaturePaths(value){
 try{const strokes=JSON.parse(value);return Array.isArray(strokes)?strokes.filter(stroke=>Array.isArray(stroke)&&stroke.length>1).map(signaturePath):[]}catch{return []}
}
