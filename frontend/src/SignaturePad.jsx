import {useRef,useState} from 'react'
import {SIGNATURE_WIDTH,SIGNATURE_HEIGHT,signaturePaths,drawSignature} from './signature-utils'

export function SignatureView({value,label='Saved'}){const paths=signaturePaths(value);return paths.length?<svg className="instructor-signature-preview" viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label={`${label} signature`}>{paths.map((path,index)=><path key={index} d={path} fill="none" stroke="#142e57" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>:null}

export default function SignaturePad({onChange,label='Instructor'}){
 const canvas=useRef(null),strokes=useRef([]),activePointer=useRef(null)
 const [strokeCount,setStrokeCount]=useState(0)
 function redraw(){drawSignature(canvas.current.getContext('2d'),strokes.current)}
 function update(){setStrokeCount(strokes.current.length);onChange(strokes.current.map(stroke=>[...stroke]))}
 function position(event){const rect=canvas.current.getBoundingClientRect();return [Math.max(0,Math.min(SIGNATURE_WIDTH,Math.round((event.clientX-rect.left)*SIGNATURE_WIDTH/rect.width))),Math.max(0,Math.min(SIGNATURE_HEIGHT,Math.round((event.clientY-rect.top)*SIGNATURE_HEIGHT/rect.height)))]}
 function start(event){if(activePointer.current!==null||event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();activePointer.current=event.pointerId;canvas.current.setPointerCapture?.(event.pointerId);strokes.current.push([position(event)])}
 function move(event){if(activePointer.current!==event.pointerId)return;event.preventDefault();const stroke=strokes.current.at(-1);for(const sample of event.nativeEvent.getCoalescedEvents?.()||[event]){const point=position(sample),last=stroke.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])<2||stroke.length>=300)continue;stroke.push(point)}redraw()}
 function finish(event){if(activePointer.current!==event.pointerId)return;activePointer.current=null;redraw();update()}
 function undo(){if(!strokes.current.length)return;strokes.current.pop();redraw();update()}
 function clear(){strokes.current=[];redraw();update()}
 return <div className="signature-pad"><div className="signature-pad-heading"><strong>{label} signature <span className="signature-enhanced">Smooth lines applied automatically</span></strong><div className="signature-tools"><button type="button" className="secondary" disabled={!strokeCount} onClick={undo}>Undo</button><button type="button" className="secondary" disabled={!strokeCount} onClick={clear}>Clear</button></div></div><canvas ref={canvas} width={SIGNATURE_WIDTH} height={SIGNATURE_HEIGHT} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} aria-label="Draw your signature here with a mouse, finger, or stylus"/><small>Draw naturally with a mouse, finger, or stylus. We smooth shaky lines without changing your handwriting.</small></div>
}
