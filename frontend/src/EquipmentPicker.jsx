import {useState} from 'react'
import './EquipmentPicker.css'

const PAGE_SIZE=8
const quantityError=(item,stock)=>{
 if(!/^[1-9]\d*$/.test(String(item.quantity)))return 'Enter a whole number of at least 1.'
 if(Number(item.quantity)>stock)return `Only ${stock} available for this item.`
 return ''
}

export default function EquipmentPicker({inventory,inventoryStatus,onRetryInventory,items,onChange}){
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('all')
 const [sort,setSort]=useState('name')
 const [visibleCount,setVisibleCount]=useState(PAGE_SIZE)
 const term=query.trim().toLocaleLowerCase()
 const selectedIds=new Set(items.map(item=>item.id))
 const categories=[...new Set(inventory.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
 const matches=inventory.filter(item=>(category==='all'||item.category===category)&&[item.name,item.category,item.model].some(value=>String(value||'').toLocaleLowerCase().includes(term)))
 const compare=(a,b)=>sort==='stock'?Number(b.quantity)-Number(a.quantity)||a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):sort==='category'?a.category.localeCompare(b.category)||a.name.localeCompare(b.name):a.name.localeCompare(b.name)
 const sorted=[...matches].sort(compare)
 const updateQuantity=(id,quantity)=>onChange(items.map(item=>item.id===id?{...item,quantity}:item))
 const add=item=>{if(items.length<22&&!selectedIds.has(item.id))onChange([...items,{id:item.id,quantity:'1'}])}
 const remove=id=>onChange(items.filter(item=>item.id!==id))
 const resetLimit=()=>setVisibleCount(PAGE_SIZE)

 return <fieldset className="equipment-fields">
  <legend>Items / equipment <span className="equipment-optional">Optional</span></legend>
  {inventoryStatus==='loading'?<div className="equipment-state" role="status">Checking available equipment…</div>
   :inventoryStatus==='error'?<div className="equipment-state" role="alert"><p>We couldn’t load the equipment list. You can still request the space and describe any equipment you need in Purpose / activity.</p><button type="button" className="secondary" onClick={onRetryInventory}>Try loading equipment again</button></div>
   :inventory.length===0?<div className="equipment-state" role="status">No equipment is currently available to select online. If you need items for your activity, describe them above. The laboratory staff will confirm what can be provided.</div>
   :<>
    <p className="field-hint">Need equipment? Search or browse, then tap Add. You can also continue without selecting any.</p>
    {items.length>0&&<section className="equipment-selected" aria-label="Selected equipment">
     <div className="equipment-section-heading"><strong>Your items</strong><span>{items.length} of 22 selected</span></div>
     {items.map(item=>{
      const selected=inventory.find(entry=>entry.id===item.id)
      if(!selected)return null
      const stock=Number(selected.quantity)
      const error=quantityError(item,stock)
      return <div className="equipment-selected-row" key={item.id}>
       <div className="equipment-selected-details"><strong>{selected.name}</strong><small>{selected.category} · Up to {stock} {selected.unit}</small></div>
       <div className="equipment-quantity">
        <label htmlFor={`equipment-quantity-${item.id}`}>Quantity</label>
        <div className="equipment-stepper">
         <button type="button" aria-label={`Decrease quantity for ${selected.name}`} disabled={Number(item.quantity)<=1} onClick={()=>updateQuantity(item.id,String(Number(item.quantity)-1))}>−</button>
         <input id={`equipment-quantity-${item.id}`} type="number" inputMode="numeric" min="1" max={stock} step="1" required value={item.quantity} aria-invalid={Boolean(error)} onChange={event=>updateQuantity(item.id,event.target.value)}/>
         <button type="button" aria-label={`Increase quantity for ${selected.name}`} disabled={Number(item.quantity)>=stock||!item.quantity} onClick={()=>updateQuantity(item.id,String(Number(item.quantity)+1))}>+</button>
        </div>
        {error&&<small className="equipment-error" role="alert">{error}</small>}
       </div>
       <button type="button" className="equipment-remove" aria-label={`Remove ${selected.name}`} onClick={()=>remove(item.id)}>Remove</button>
      </div>
     })}
    </section>}
    <div className="equipment-browse-heading"><strong>Browse available items</strong><span>{inventory.length} items</span></div>
    <div className="equipment-controls">
     <label>Search<input type="search" value={query} onChange={event=>{setQuery(event.target.value);resetLimit()}} placeholder="Try “toaster” or “kitchen”" autoComplete="off"/></label>
     <label>Category<select value={category} onChange={event=>{setCategory(event.target.value);resetLimit()}}><option value="all">All categories</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label>Sort<select value={sort} onChange={event=>{setSort(event.target.value);resetLimit()}}><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="category">Category</option><option value="stock">Most available</option></select></label>
    </div>
    <p className="equipment-result-count" role="status">{sorted.length} {sorted.length===1?'item':'items'} found</p>
    {sorted.length?<div className="equipment-results">
     {sorted.slice(0,visibleCount).map(item=><div className="equipment-result" key={item.id}>
      <div><strong>{item.name}</strong><small>{item.category}{item.model&&item.model!=='N/A'?` · ${item.model}`:''}</small><span>{item.quantity} {item.unit} available</span></div>
      <button type="button" className={selectedIds.has(item.id)?'equipment-added':'secondary'} disabled={selectedIds.has(item.id)||items.length>=22} aria-label={selectedIds.has(item.id)?`${item.name} added`:`Add ${item.name}`} onClick={()=>add(item)}>{selectedIds.has(item.id)?'✓ Added':'+ Add'}</button>
     </div>)}
    </div>:<p className="equipment-no-match">No items match. Try another search or category.</p>}
    {visibleCount<sorted.length&&<button type="button" className="equipment-more secondary" onClick={()=>setVisibleCount(count=>count+PAGE_SIZE)}>Show more items</button>}
    {items.length>=22&&<p className="field-hint">You’ve reached the 22-item limit. Remove an item to choose another.</p>}
   </>}
 </fieldset>
}
