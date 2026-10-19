import {useEffect,useState} from 'react'
import {downloadReservationForm} from './reservation-form'
import {SignatureView} from './SignaturePad'
import LaboratoryTable from './LaboratoryTable'
import {laboratoryEntriesFor,validateLaboratoryTable} from './laboratory-table-utils'
import './AdminReservationForm.css'

function selectedItems(record){try{const items=JSON.parse(record.inventorySelection||'[]');return Array.isArray(items)?items.map(item=>({id:item.id,quantity:item.quantity,name:item.name})):[]}catch{return []}}
const signedAt=value=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):''

export default function AdminReservationForm({record,request,onSaved,onClose,onEdit,formatDate}){
 const [inventory,setInventory]=useState([]),[items,setItems]=useState(()=>selectedItems(record)),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('')
 const [labEntries,setLabEntries]=useState(()=>laboratoryEntriesFor(record))
 useEffect(()=>{let active=true;request('inventory').then(rows=>{if(active)setInventory(rows)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[request])
 const listed=inventory.filter(item=>item.status==='Available'&&Number(item.quantity)>0&&!items.some(pick=>pick.id===item.id)&&`${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,30)
 const legacy=!record.inventorySelection&&record.equipment&&record.equipment!=='None'
 const dirty=Boolean(legacy)||JSON.stringify(items.map(({id,quantity})=>({id,quantity})))!==JSON.stringify(selectedItems(record).map(({id,quantity})=>({id,quantity})))
 const labDirty=JSON.stringify(labEntries)!==JSON.stringify(laboratoryEntriesFor(record))
 function changeQuantity(id,value){setItems(rows=>rows.map(item=>item.id===id?{...item,quantity:value===''?'':Number(value)}:item))}
 async function save(){
  setError('');setNotice('')
  if(items.some(item=>!Number.isSafeInteger(item.quantity)||item.quantity<1)){setError('Enter a positive whole-number quantity for every item.');return}
  setSaving(true)
  try{const saved=await request(`reservations/${record.id}/items`,{method:'PATCH',body:JSON.stringify({items:items.map(({id,quantity})=>({id,quantity}))})});onSaved(saved);setItems(selectedItems(saved));setLabEntries(laboratoryEntriesFor(saved));setNotice('Items saved. The instructor must review and sign the updated request again before final approval.')}
  catch(e){setError(e.message)}finally{setSaving(false)}
 }
 async function saveLaboratory(){
  setError('');setNotice('');const message=validateLaboratoryTable(record,labEntries);if(message){setError(message);return}
  setSaving(true)
  try{const saved=await request(`reservations/${record.id}/laboratory`,{method:'PATCH',body:JSON.stringify({entries:labEntries})});onSaved(saved);setLabEntries(laboratoryEntriesFor(saved));setNotice('Laboratory issue and return details saved to the form.')}catch(e){setError(e.message)}finally{setSaving(false)}
 }
 return <div className="modal-backdrop"><section className="modal admin-form-modal" role="dialog" aria-modal="true" aria-labelledby="form-preview-title"><button className="close" aria-label="Close form preview" autoFocus disabled={saving} onClick={onClose}>×</button><div className="eyebrow">RESERVATION FORM</div><h2 id="form-preview-title">HRM Laboratory Utilization Form</h2><p>Review and update the information used in the college Word form.</p>
  <div className="admin-review-summary"><dl>{[['Facility',record.facility],['Date of usage',formatDate(record.date)],['Time of usage',`${record.start} – ${record.end}`],['Subject',record.subject],['Purpose',record.purpose],['Requester',record.name],['Email',record.email],['ID number',record.studentId||'Not provided'],['Instructor',record.instructor||'Not recorded']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button type="button" className="secondary" onClick={onEdit}>Edit booking details</button></div>
  <details className="admin-form-requested-items"><summary><span><strong>Requested items / equipment</strong><small>Expand to review or edit the requested items</small></span><span className="admin-form-item-count">{items.length} selected</span><span className="admin-form-chevron" aria-hidden="true">⌄</span></summary><div className="admin-form-requested-content">
  {legacy&&<p className="admin-form-warning">This older request has a text-only equipment list: {record.equipment}. Saving the list below will replace it with verified inventory items.</p>}
  <div className="admin-form-items">{items.map(item=>{const stock=inventory.find(row=>row.id===item.id);const unavailable=!stock||stock.status!=='Available'||Number(stock.quantity)<item.quantity;return <div className="admin-form-item" key={item.id}><div><strong>{stock?.name||item.name}</strong><small>{stock?`${stock.category} · ${stock.quantity} ${stock.unit} in inventory${stock.status!=='Available'?' · Unavailable':''}`:'No longer in inventory'}</small>{unavailable&&<em>Check availability; remove or adjust this item.</em>}</div><label>Quantity<input type="number" min="1" step="1" inputMode="numeric" value={item.quantity} onChange={e=>changeQuantity(item.id,e.target.value)}/></label><button type="button" className="secondary" onClick={()=>setItems(rows=>rows.filter(row=>row.id!==item.id))} aria-label={`Remove ${item.name}`}>Remove</button></div>})}{!items.length&&<p className="admin-form-empty">No equipment selected.</p>}</div>
  <label className="admin-form-search">Add an available item<input type="search" placeholder="Search verified inventory…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="admin-form-catalog">{loading?<p>Loading inventory…</p>:listed.length?listed.map(item=><button type="button" key={item.id} onClick={()=>{setItems(rows=>[...rows,{id:item.id,name:item.name,quantity:1}]);setSearch('')}}><span>{item.name}<small>{item.category} · {item.quantity} {item.unit} available</small></span><b>+ Add</b></button>):<p>No matching available items.</p>}</div>
  {dirty&&<p className="admin-form-warning">Saving equipment changes sends this reservation back to the instructor for a new signature. Its current final approval and signatures will be cleared.</p>}
  <div className="admin-form-actions"><button type="button" className="primary" disabled={!dirty||saving||loading} onClick={save}>{saving?'Saving…':'Save item changes'}</button><button type="button" className="secondary" disabled={saving} onClick={()=>{setItems(selectedItems(record));setError('')}}>Discard changes</button></div></div></details>
  {['Awaiting admin','Approved'].includes(record.status)&&<><LaboratoryTable record={record} entries={labEntries} onChange={setLabEntries}/><div className="admin-form-actions"><button type="button" className="primary" disabled={!labDirty||dirty||saving} onClick={saveLaboratory}>{saving?'Saving…':'Save laboratory details'}</button><button type="button" className="secondary" disabled={saving} onClick={()=>{setLabEntries(laboratoryEntriesFor(record));setError('')}}>Discard table changes</button></div></>}
  <div className="admin-form-signatures">{record.instructorSignature&&<div><strong>Instructor signature</strong><SignatureView value={record.instructorSignature}/><small>{record.instructorReviewedBy||record.instructor} · {signedAt(record.instructorReviewedAt)}</small></div>}{record.adminSignature&&<div><strong>Admin signature</strong><SignatureView value={record.adminSignature}/><small>{record.adminReviewedBy} · {signedAt(record.adminReviewedAt)}</small></div>}</div>
  <p className="source-note">The downloaded form includes the current items, saved laboratory entries, and signatures.</p><button type="button" className="primary submit" disabled={dirty||labDirty} onClick={()=>downloadReservationForm(record).catch(e=>setError(e.message))}>Download filled form</button>{(dirty||labDirty)&&<small>Save or discard changes before downloading.</small>}{notice&&<div className="notice" role="status">{notice}</div>}{error&&<div className="alert" role="alert">{error}</div>}
 </section></div>
}
