import {lazy,Suspense,useCallback,useState} from 'react'
import './AdminInventory.css'

const InventorySheet=lazy(()=>import('./InventorySheet'))

const blank={name:'',category:'',quantity:'0',unit:'pc',model:'',serial:'',notes:'',status:'Draft'}
const PAGE_SIZE=25
const reportValue=(quantity,unit)=>quantity||unit?`${quantity||'—'}${unit?' '+unit:''}`:'Not recorded'
const hasReport=item=>Object.hasOwn(item,'reportActualQuantity')

export default function AdminInventory({items=[],request,onChange}){
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('All')
 const [category,setCategory]=useState('All categories')
 const [sort,setSort]=useState('Category and item')
 const [page,setPage]=useState(1)
 const [editing,setEditing]=useState(null)
 const [view,setView]=useState('sheet')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const editItem=useCallback(item=>{setEditing(item);setError('')},[setEditing,setError])

 const categories=[...new Set(items.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
 const counts=Object.fromEntries(['Draft','Available','Unavailable'].map(value=>[value,items.filter(item=>item.status===value).length]))
 const matching=items.filter(item=>(status==='All'||item.status===status)&&(category==='All categories'||item.category===category)&&[item.name,item.category,item.model,item.serial,item.notes,item.reportRemarks].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
 matching.sort((a,b)=>sort==='Item name'?a.name.localeCompare(b.name):sort==='Quantity: high to low'?Number(b.quantity)-Number(a.quantity)||a.name.localeCompare(b.name):a.category.localeCompare(b.category)||a.name.localeCompare(b.name))
 const pages=Math.max(1,Math.ceil(matching.length/PAGE_SIZE))
 const currentPage=Math.min(page,pages)
 const first=(currentPage-1)*PAGE_SIZE
 const visible=matching.slice(first,first+PAGE_SIZE)
 const resetPage=()=>setPage(1)

 async function save(event){
  event.preventDefault();setBusy(true);setError('')
  try{
   const form=Object.fromEntries(new FormData(event.currentTarget))
   const id=editing.id
   const saved=await request(id?'inventory/'+encodeURIComponent(id):'inventory',{method:id?'PATCH':'POST',body:JSON.stringify(form)})
   onChange(current=>id?current.map(item=>item.id===id?saved:item):[...current,saved])
   setEditing(null)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function remove(item){
  if(!window.confirm(`Delete ${item.name}?`))return
  setBusy(true);setError('')
  try{
   await request('inventory/'+encodeURIComponent(item.id),{method:'DELETE'})
   onChange(current=>current.filter(row=>row.id!==item.id))
   setEditing(null)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 return <section className="records inventory-page">
  <div className="section-heading"><div><h2>Laboratory inventory</h2><p>Positive quantities from the 2nd Sem A.Y. 2025–2026 report are available for student requests by default. Zero-stock items remain drafts. Review and update booking stock as needed.</p></div><button className="primary" onClick={()=>{setEditing(blank);setError('')}}>+ Add item</button></div>
  <div className="inventory-view-switch" role="group" aria-label="Inventory view"><button type="button" className={view==='sheet'?'selected':''} aria-pressed={view==='sheet'} onClick={()=>setView('sheet')}>Sheet view</button><button type="button" className={view==='report'?'selected':''} aria-pressed={view==='report'} onClick={()=>setView('report')}>Report table</button></div>
  <div className="inventory-overview"><strong>{items.length} total items</strong><span>{counts.Draft||0} drafts</span><span>{counts.Available||0} available</span><span>{counts.Unavailable||0} unavailable</span></div>
  <div className="inventory-controls"><label>Search<input className="search" placeholder="Item, model, serial, or remark" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}}/></label><label>Category<select value={category} onChange={event=>{setCategory(event.target.value);resetPage()}}><option>All categories</option>{categories.map(value=><option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={event=>{setStatus(event.target.value);resetPage()}}>{['All','Draft','Available','Unavailable'].map(value=><option key={value}>{value}</option>)}</select></label><label>Sort by<select value={sort} onChange={event=>{setSort(event.target.value);resetPage()}}>{['Category and item','Item name','Quantity: high to low'].map(value=><option key={value}>{value}</option>)}</select></label></div>
  {error&&!editing&&<div className="alert" role="alert">{error}</div>}
  <div className="inventory-result-line"><span>{matching.length?(view==='sheet'?`${matching.length} items in sheet`:`Showing ${first+1}–${Math.min(first+PAGE_SIZE,matching.length)} of ${matching.length} items`):'No matching items'}</span>{(query||status!=='All'||category!=='All categories')&&<button className="text-button" onClick={()=>{setQuery('');setStatus('All');setCategory('All categories');resetPage()}}>Clear filters</button>}</div>
  {view==='sheet'?<Suspense fallback={<div className="inventory-sheet-loading" role="status">Opening inventory sheet…</div>}><InventorySheet items={matching} request={request} onChange={onChange} onEdit={editItem}/></Suspense>:<><p className="inventory-scroll-hint">Scroll sideways inside the table to see every report column and the edit action.</p>
  <div className="inventory-table-wrap" role="region" aria-label="Laboratory inventory table" tabIndex="0"><table className="inventory-table"><thead><tr><th scope="col">Item / equipment</th><th scope="col">Model / serial</th><th scope="col">Previous inventory</th><th scope="col">Actual in report</th><th scope="col">Required</th><th scope="col">Remarks</th><th scope="col">Booking stock</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><strong>{item.name}</strong><small>{item.category}</small></td><td>{item.model||<span className="inventory-muted">—</span>}{item.serial&&<small>Serial: {item.serial}</small>}</td><td>{hasReport(item)?reportValue(item.reportPreviousQuantity,item.reportPreviousUnit):<span className="inventory-muted">—</span>}</td><td>{hasReport(item)?reportValue(item.reportActualQuantity,item.reportActualUnit):<span className="inventory-muted">—</span>}</td><td>{hasReport(item)?reportValue(item.reportRequiredQuantity,item.reportRequiredUnit):<span className="inventory-muted">—</span>}</td><td className="inventory-notes">{item.reportRemarks||item.notes||<span className="inventory-muted">—</span>}</td><td className="inventory-quantity">{hasReport(item)&&!item.reportActualQuantity&&item.status==='Draft'&&Number(item.quantity)===0?<span className="inventory-muted">Not set</span>:<><strong>{item.quantity}</strong> {item.unit==='not recorded'?'(unit not recorded)':item.unit}</>}</td><td><span className={'inventory-status inventory-status-'+item.status.toLowerCase()}>{item.status}</span></td><td><button className="secondary" aria-label={'Edit '+item.name} onClick={()=>{setEditing(item);setError('')}}>Edit</button></td></tr>)}</tbody></table>{!visible.length&&<div className="empty">No inventory items match your filters.</div>}</div>
  {pages>1&&<nav className="inventory-pagination" aria-label="Inventory pages"><button className="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>← Previous</button><span>Page {currentPage} of {pages}</span><button className="secondary" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next →</button></nav>}</>}
  {editing&&<div className="modal-backdrop"><section className="modal inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title"><button className="close" aria-label="Close inventory editor" disabled={busy} onClick={()=>setEditing(null)}>×</button><div className="eyebrow">LABORATORY INVENTORY</div><h2 id="inventory-dialog-title">{editing.id?'Edit item':'Add inventory item'}</h2><p>Items marked Available with positive booking stock appear in the student booking form. Please keep the stock current.</p>{hasReport(editing)&&<div className="inventory-source"><strong>As recorded in the college report</strong><dl><div><dt>Previous</dt><dd>{reportValue(editing.reportPreviousQuantity,editing.reportPreviousUnit)}</dd></div><div><dt>Actual</dt><dd>{reportValue(editing.reportActualQuantity,editing.reportActualUnit)}</dd></div><div><dt>Required</dt><dd>{reportValue(editing.reportRequiredQuantity,editing.reportRequiredUnit)}</dd></div><div><dt>Model</dt><dd>{editing.reportModel||'Not recorded'}</dd></div><div><dt>Serial</dt><dd>{editing.reportSerial||'Not recorded'}</dd></div><div><dt>Remarks</dt><dd>{editing.reportRemarks||'Not recorded'}</dd></div></dl></div>}<form key={editing.id||'new'} onSubmit={save}><label>Item / equipment name<input name="name" required maxLength={120} defaultValue={editing.name} autoFocus/></label><div className="form-row"><label>Category<input name="category" required maxLength={100} defaultValue={editing.category}/></label><label>Booking stock<input name="quantity" type="number" required min="0" max="99999" step="1" defaultValue={editing.quantity}/></label></div><div className="form-row"><label>Unit<input name="unit" required maxLength={30} defaultValue={editing.unit}/></label><label>Student availability<select name="status" defaultValue={editing.status}><option>Draft</option><option>Available</option><option>Unavailable</option></select></label></div><div className="form-row"><label>Model (optional)<input name="model" maxLength={120} defaultValue={editing.model}/></label><label>Serial number (optional)<input name="serial" maxLength={120} defaultValue={editing.serial}/></label></div><label>Current condition / notes<textarea name="notes" maxLength={500} defaultValue={editing.notes}/></label>{error&&<div className="alert" role="alert">{error}</div>}<div className="inventory-dialog-actions">{editing.id&&<button type="button" className="text-button" disabled={busy} onClick={()=>remove(editing)}>Delete item</button>}<button className="primary" disabled={busy}>{busy?'Saving…':'Save item'}</button></div></form></section></div>}
 </section>
}
