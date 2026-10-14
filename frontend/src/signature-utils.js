export const SIGNATURE_WIDTH=600
export const SIGNATURE_HEIGHT=180

export function signatureIsMeaningful(strokes){
 const points=strokes.flat()
 if(points.length<8)return false
 const xs=points.map(point=>point[0]),ys=points.map(point=>point[1])
 const length=strokes.reduce((sum,stroke)=>sum+stroke.slice(1).reduce((distance,point,index)=>distance+Math.hypot(point[0]-stroke[index][0],point[1]-stroke[index][1]),0),0)
 return Math.max(...xs)-Math.min(...xs)>=25&&Math.max(...ys)-Math.min(...ys)>=8&&length>=75
}

export function signaturePaths(value){
 try{const strokes=JSON.parse(value);return Array.isArray(strokes)?strokes.filter(stroke=>Array.isArray(stroke)&&stroke.length>1).map(stroke=>stroke.map(([x,y],index)=>`${index?'L':'M'}${x} ${y}`).join(' ')):[]}catch{return []}
}
