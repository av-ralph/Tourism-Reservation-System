import {useEffect,useState} from 'react'
import EquipmentPicker from './EquipmentPicker'
import {requestJson} from './api'
import './InstructorItemsEditor.css'

const selectedItems=reservation=>{try{const items=JSON.parse(reservation.inventorySelection||'[]');return Array.isArray(items)?items.map(item=>({id:item.id,quantity:String(item.quantity)})):[]}catch{return []}}
const sameItems=(a,b)=>JSON.stringify(a.map(({id,quantity})=>[id,Number(quantity)]))===JSON.stringify(b.map(({id,quantity})=>[id,Number(quantity)]))

export default function InstructorItemsEditor({reservation,request,onSaved}){
 const [open,setOpen]=useState(false),[inventory,setInventory]=useState([]),[inventoryStatus,setInventoryStatus]=useState('loading'),[reload,setReload]=useState(0)
 const [items,setItems]=useState(()=>selectedItems(reservation)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{if(!open)return;let active=true;requestJson('/api/inventory').then(rows=>{if(active){setInventory(rows);setInventoryStatus('ready')}}).catch(()=>{if(active)setInventoryStatus('error')});return()=>{active=false}},[open,reload])
 const legacy=!reservation.inventorySelection&&reservation.equipment&&reservation.equipment!=='None'
 const dirty=Boolean(legacy)||!sameItems(items,selectedItems(reservation))
 async function save(){
  setError('');setNotice('')
  if(items.some(item=>!/^[1-9]\d*$/.test(String(item.quantity)))){setError('Enter a whole-number quantity of at least 1 for every item.');return}
  setBusy(true)
  try{const saved=await request(`reservations/${reservation.id}/items`,{method:'PATCH',body:JSON.stringify({items:items.map(item=>({id:item.id,quantity:Number(item.quantity)}))})});onSaved(saved);setItems(selectedItems(saved));setNotice('Items updated. Review the list, then sign to send the request to the administrator.')}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!open)return <div className="instructor-items-toggle"><p>Need to add, remove, or change quantities before signing?</p><button type="button" className="secondary" onClick={()=>{setOpen(true);setNotice('')}}>Edit items</button>{notice&&<p className="instructor-items-notice" role="status">{notice}</p>}</div>
 return <section className="instructor-items-editor" aria-label="Edit requested items">
  {legacy&&<p className="instructor-items-legacy">This request lists equipment as text: <strong>{reservation.equipment}</strong>. Saving replaces it with the items selected below.</p>}
  <div className="student-site booking-embed"><EquipmentPicker inventory={inventory} inventoryStatus={inventoryStatus} onRetryInventory={()=>{setInventoryStatus('loading');setReload(value=>value+1)}} items={items} onChange={setItems}/></div>
  {error&&<div className="alert" role="alert">{error}</div>}
  {notice&&<p className="instructor-items-notice" role="status">{notice}</p>}
  <div className="instructor-items-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{setItems(selectedItems(reservation));setError('');setOpen(false)}}>Close</button><button type="button" className="primary" disabled={busy||!dirty} onClick={save}>{busy?'Saving…':'Save items'}</button></div>
 </section>
}
