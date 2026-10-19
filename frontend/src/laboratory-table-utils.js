import {reservationItems} from './reservation-form'

export function laboratoryEntriesFor(record){
 const items=reservationItems(record).filter(item=>item.description&&item.description!=='None')
 let saved=[]
 try{const parsed=JSON.parse(record.laboratoryEntries||'[]');if(Array.isArray(parsed))saved=parsed}catch{/* Older reservations have no laboratory entries. */}
 return items.map((_,index)=>({released:String(saved[index]?.released||''),remarks:String(saved[index]?.remarks||''),returned:String(saved[index]?.returned||''),condition:String(saved[index]?.condition||'')}))
}

export function validateLaboratoryTable(record,entries){
 const items=reservationItems(record).filter(item=>item.description&&item.description!=='None')
 if(entries.length!==items.length)return 'The laboratory table no longer matches the requested items. Reopen the form.'
 for(let index=0;index<entries.length;index++){
  const row=entries[index],requested=Number(items[index].quantity)
  if(row.released&&(!/^[1-9]\d{0,5}$/.test(row.released)||Number.isInteger(requested)&&requested>0&&Number(row.released)>requested))return `Row ${index+1}: quantity released must not exceed the requested quantity.`
 }
 return ''
}
