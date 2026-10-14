import {useEffect,useRef} from 'react'
import {SIGNATURE_WIDTH,SIGNATURE_HEIGHT,signaturePaths} from './signature-utils'

export function SignatureView({value}){const paths=signaturePaths(value);return paths.length?<svg className="instructor-signature-preview" viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label="Instructor's saved signature">{paths.map((path,index)=><path key={index} d={path} fill="none" stroke="#142e57" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>:null}

export default function SignaturePad({onChange}){
 const canvas=useRef(null),strokes=useRef([]),active=useRef(false)
 useEffect(()=>{const context=canvas.current.getContext('2d');context.lineWidth=3.5;context.lineCap='round';context.lineJoin='round';context.strokeStyle='#142e57'},[])
 function position(event){const rect=canvas.current.getBoundingClientRect();return [Math.max(0,Math.min(SIGNATURE_WIDTH,Math.round((event.clientX-rect.left)*SIGNATURE_WIDTH/rect.width))),Math.max(0,Math.min(SIGNATURE_HEIGHT,Math.round((event.clientY-rect.top)*SIGNATURE_HEIGHT/rect.height)))]}
 function start(event){event.preventDefault();canvas.current.setPointerCapture(event.pointerId);active.current=true;const point=position(event);strokes.current.push([point]);const context=canvas.current.getContext('2d');context.beginPath();context.moveTo(...point)}
 function move(event){if(!active.current)return;event.preventDefault();const point=position(event),stroke=strokes.current.at(-1),last=stroke.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])<2)return;if(stroke.length>=300)return;stroke.push(point);const context=canvas.current.getContext('2d');context.lineTo(...point);context.stroke()}
 function finish(){if(!active.current)return;active.current=false;onChange(strokes.current.map(stroke=>[...stroke]))}
 function clear(){strokes.current=[];canvas.current.getContext('2d').clearRect(0,0,SIGNATURE_WIDTH,SIGNATURE_HEIGHT);onChange([])}
 return <div className="signature-pad"><div className="signature-pad-heading"><strong>Instructor signature</strong><button type="button" className="secondary" onClick={clear}>Clear</button></div><canvas ref={canvas} width={SIGNATURE_WIDTH} height={SIGNATURE_HEIGHT} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} aria-label="Draw your signature here with a mouse, finger, or stylus"/><small>Draw your signature in the box. A short tap or straight mark will not be accepted.</small></div>
}
