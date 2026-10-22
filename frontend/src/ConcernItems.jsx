import {useState} from 'react'
import './ConcernItems.css'
const blank=()=>({quantity:'1',description:'',condition:'Damaged'})
export default function ConcernItems(){
 const [items,setItems]=useState(()=>[blank()])
 const change=(index,key,value)=>setItems(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item))
 return <fieldset className="concern-items"><legend>Damaged or lost items</legend><input type="hidden" name="reportItems" value={JSON.stringify(items.map(item=>({...item,quantity:Number(item.quantity)})))}/>
  {items.map((item,i)=><div className="concern-item" key={i}>
   <label>Qty<input type="number" min="1" max="999" required value={item.quantity} onChange={e=>change(i,'quantity',e.target.value)}/></label>
   <label>Item / equipment<input required maxLength={200} value={item.description} placeholder="e.g. Wine glass" onChange={e=>change(i,'description',e.target.value)}/></label>
   <label>Condition<select value={item.condition} onChange={e=>change(i,'condition',e.target.value)}><option>Broke</option><option>Lost</option><option>Damaged</option></select></label>
   {items.length>1&&<button type="button" className="concern-item-remove" aria-label={`Remove item ${i+1}`} onClick={()=>setItems(current=>current.filter((_,index)=>index!==i))}>×</button>}
  </div>)}
  {items.length<30&&<button type="button" className="secondary" onClick={()=>setItems(current=>[...current,blank()])}>＋ Add another item</button>}
 </fieldset>
}
