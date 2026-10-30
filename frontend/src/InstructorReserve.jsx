import {useEffect,useState} from 'react'
import BookingForm from './BookingForm'
import {requestJson} from './api'
import './InstructorReserve.css'
import './InstructorItemsEditor.css'

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())
const earliestBooking=()=>{const date=new Date(today()+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+2);return date.toISOString().slice(0,10)}

export default function InstructorReserve({data,request,onBooked}){
 const [schedule,setSchedule]=useState([]),[inventory,setInventory]=useState([]),[inventoryStatus,setInventoryStatus]=useState('loading'),[reload,setReload]=useState(0)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[formKey,setFormKey]=useState(0)
 useEffect(()=>{let active=true;requestJson('/api/schedule').then(rows=>{if(active)setSchedule(rows)}).catch(()=>{});return()=>{active=false}},[formKey])
 useEffect(()=>{let active=true;requestJson('/api/inventory').then(rows=>{if(active){setInventory(rows);setInventoryStatus('ready')}}).catch(()=>{if(active)setInventoryStatus('error')});return()=>{active=false}},[reload,formKey])
 async function submit(fields){
  setBusy(true);setError('')
  try{const saved=await request('reservations',{method:'POST',body:JSON.stringify(fields)});setFormKey(value=>value+1);onBooked(saved)}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="records instructor-reserve">
  <div className="section-heading"><div><h2>Reserve a Space</h2><p>Book a laboratory space for your own class. Your signature endorses the request, so it goes straight to the administrator for final approval.</p></div></div>
  {error&&<div className="alert" role="alert">{error}</div>}
  <div className="student-site booking-embed"><BookingForm key={formKey} mode="instructor" requester={{name:data.adminName,email:data.adminEmail}} savedSignature={data.savedSignature} facilities={(data.facilities||[]).map(facility=>[facility.name])} facilityInfo={data.facilities} inventory={inventory} inventoryStatus={inventoryStatus} onRetryInventory={()=>{setInventoryStatus('loading');setReload(value=>value+1)}} date={earliestBooking()} minDate={earliestBooking()} schedule={schedule} busy={busy} onSubmit={submit}/></div>
 </section>
}
