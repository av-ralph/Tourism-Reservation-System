import {useState} from 'react'
import './EquipmentPicker.css'

export default function EquipmentPicker({inventory,inventoryStatus,onRetryInventory,items,onChange}){
 const [query,setQuery]=useState('')
 const [sort,setSort]=useState('name')
 const term=query.trim().toLocaleLowerCase()
 const selectedIds=new Set(items.map(item=>item.id).filter(Boolean))
 const matches=inventory.filter(item=>[item.name,item.category,item.model].some(value=>String(value||'').toLocaleLowerCase().includes(term)))
 const compare=(a,b)=>sort==='stock'?Number(b.quantity)-Number(a.quantity)||a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):sort==='category'?a.category.localeCompare(b.category)||a.name.localeCompare(b.name):a.name.localeCompare(b.name)
 const sorted=[...matches].sort(compare)
 const optionsFor=id=>{
  const selected=inventory.find(item=>item.id===id)
  const options=sorted.filter(item=>item.id===id||!selectedIds.has(item.id))
  if(selected&&!options.some(item=>item.id===id))options.unshift(selected)
  return options.map(item=><option key={item.id} value={item.id}>{item.name}{item.model&&item.model!=='N/A'?' · '+item.model:''} — {item.quantity} {item.unit}</option>)
 }
 const update=(index,key,value)=>onChange(items.map((item,i)=>i===index?{...item,[key]:value}:item))
 const add=()=>onChange([...items,{id:'',quantity:'1'}])
 const quantityError=item=>{
  if(!item.id)return ''
  const stock=Number(inventory.find(entry=>entry.id===item.id)?.quantity)
  if(!/^[1-9]\d*$/.test(String(item.quantity)))return 'Enter a whole number of at least 1.'
  if(Number(item.quantity)>stock)return `Only ${stock} available for this item.`
  return ''
 }
 return <fieldset className="equipment-fields">
  <legend>Items / equipment <span className="equipment-optional">Optional</span></legend>
  {inventoryStatus==='loading'?<div className="equipment-state" role="status">Checking available equipment…</div>
   :inventoryStatus==='error'?<div className="equipment-state" role="alert"><p>We couldn’t load the equipment list. You can still request the space and describe any equipment you need in Purpose / activity.</p><button type="button" className="secondary" onClick={onRetryInventory}>Try loading equipment again</button></div>
   :inventory.length===0?<div className="equipment-state" role="status">No equipment is currently available to select online. If you need items for your activity, describe them above. The laboratory staff will confirm what can be provided.</div>
   :<>
    <p className="field-hint">Search the available equipment, select an item, then enter how many you need. You can leave this section empty.</p>
    <div className="equipment-controls">
     <label>Search items<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, category, or model" autoComplete="off"/></label>
     <label>Sort results<select value={sort} onChange={event=>setSort(event.target.value)}><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="category">Category</option><option value="stock">Most available</option></select></label>
    </div>
    <p className="equipment-result-count" role="status">{sorted.length} matching {sorted.length===1?'item':'items'}{term?' — clear search to see all available equipment':''}</p>
    {items.map((item,i)=>{
     const selected=inventory.find(entry=>entry.id===item.id)
     const error=quantityError(item)
     return <div className="equipment-entry" key={i}>
      <label>Item / equipment<select required value={item.id} onChange={event=>update(i,'id',event.target.value)}><option value="">Choose an item</option>{optionsFor(item.id)}</select></label>
      <label>Quantity<input type="number" inputMode="numeric" min="1" max={selected?.quantity||undefined} step="1" required value={item.quantity} aria-invalid={Boolean(error)} onChange={event=>update(i,'quantity',event.target.value)}/>{selected&&<small className="field-hint">Up to {selected.quantity} {selected.unit}</small>}{error&&<small className="equipment-error" role="alert">{error}</small>}</label>
      <button type="button" className="text-button" aria-label={'Remove item '+(i+1)} onClick={()=>onChange(items.filter((_,index)=>index!==i))}>Remove</button>
     </div>
    })}
    {!sorted.length&&<p className="equipment-no-match">No items match your search. Try a different name or category.</p>}
    <button type="button" className="secondary" disabled={items.length>=22||items.length>=inventory.length} onClick={add}>+ Add item</button>
    <small className="field-hint">{items.length} of 22 equipment rows used</small>
   </>}
 </fieldset>
}
