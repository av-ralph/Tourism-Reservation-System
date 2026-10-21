import { useEffect, useState } from 'react'
import { defaultOrganization, emptyOrganizationSections, includeOrganizationSections } from './organization-defaults'
import { prepareImagePhoto } from './profile-photo'
import './CollegeOrganization.css'

const withKeys=groups=>groups.map(group=>({...group,clientId:crypto.randomUUID()}))

export default function AdminCollegeOrganizationEditor({request}){
 const [groups,setGroups]=useState(()=>withKeys(defaultOrganization()))
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[dragging,setDragging]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{let active=true;request('organization').then(result=>{if(active)setGroups(withKeys(result.groups?includeOrganizationSections(result.groups):defaultOrganization()))}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[request])
 function changed(){setNotice('');setError('')}
 function changeGroup(index,value){setGroups(current=>current.map((group,i)=>i===index?{...group,title:value}:group));changed()}
 function changePerson(groupIndex,personIndex,changes){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.map((person,j)=>j===personIndex?{...person,...changes}:person)}:group));changed()}
 function addGroup(){if(groups.length>=20){setError('You can add up to 20 groups.');return}setGroups(current=>[...current,{clientId:crypto.randomUUID(),title:'',items:[{name:'',title:'',photo:''}]}]);changed()}
 function addPerson(index){if(groups[index].items.length>=30||groups.reduce((sum,group)=>sum+group.items.length,0)>=150){setError('The organization list has reached its limit.');return}setGroups(current=>current.map((group,i)=>i===index?{...group,items:[...group.items,{name:'',title:'',photo:''}]}:group));changed()}
 function removePerson(groupIndex,personIndex){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.filter((_,j)=>j!==personIndex)}:group));changed()}
 function removeGroup(index){setGroups(current=>current.filter((_,i)=>i!==index));changed()}
 function moveGroup(from,to){if(from===to||from<0||to<0||from>=groups.length||to>=groups.length)return;setGroups(current=>{const next=[...current],item=next.splice(from,1)[0];next.splice(to,0,item);return next});changed()}
 function dropGroup(event,to){const value=event.dataTransfer.getData('application/x-college-group');if(!value)return;event.preventDefault();const from=Number(value);if(Number.isInteger(from))moveGroup(from,to);setDragging(null)}
 async function upload(event,groupIndex,personIndex){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setError('');setUploading(true);
  try{const photo=await prepareImagePhoto(file,{square:true,sizes:[160,128,112,96],maxLength:30000});changePerson(groupIndex,personIndex,{photo});setNotice('Portrait compressed and ready. Save changes to publish it.')}
  catch(e){setError(e.message||'Unable to open photo.')}finally{setUploading(false)}
 }
 async function save(event){
  event.preventDefault();setError('');setNotice('');
  if(!groups.length||groups.some(group=>!group.title.trim()||(!group.items.length&&!emptyOrganizationSections.includes(group.title.trim()))||group.items.some(person=>!person.name.trim()))){setError('Every group needs a name. Add at least one person to each group except The Founders and Faculty and Staff.');return}
  setBusy(true);
  try{const result=await request('organization',{method:'PATCH',body:JSON.stringify({groups:groups.map(group=>({title:group.title,items:group.items}))})});setGroups(withKeys(result.groups));setNotice('College Organization saved. The About CeC page now shows the new order and titles.')}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="records organization-editor"><div className="section-heading"><div><h2>College Organization</h2><p>Edit names and titles separately. Drag groups to change their order, or use the arrow buttons on mobile. Save to publish on About CeC.</p></div></div>{loading?<p role="status">Loading organization…</p>:<form onSubmit={save}><fieldset disabled={busy||uploading}>
  {groups.map((group,groupIndex)=><div className={'organization-sort-row'+(dragging===groupIndex?' is-dragging':'')} key={group.clientId} onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-college-group')){event.preventDefault();event.dataTransfer.dropEffect='move'}}} onDrop={event=>dropGroup(event,groupIndex)}>
   <div className="organization-sort-controls"><button type="button" className="organization-drag-handle" draggable={!busy&&!uploading} onDragStart={event=>{event.dataTransfer.setData('application/x-college-group',String(groupIndex));event.dataTransfer.effectAllowed='move';setDragging(groupIndex)}} onDragEnd={()=>setDragging(null)} aria-label={`Drag ${group.title||'new group'} to reorder`} title="Drag to reorder">⠿ <span>Drag</span></button><span className="organization-sort-position">{groupIndex+1}</span><button type="button" className="secondary" onClick={()=>moveGroup(groupIndex,groupIndex-1)} disabled={groupIndex===0} aria-label={`Move ${group.title||'new group'} up`}>↑</button><button type="button" className="secondary" onClick={()=>moveGroup(groupIndex,groupIndex+1)} disabled={groupIndex===groups.length-1} aria-label={`Move ${group.title||'new group'} down`}>↓</button></div>
   <details className="organization-edit-group"><summary>{group.title||'New group'} <small>{group.items.length} {group.items.length===1?'person':'people'}</small></summary><div className="organization-edit-body"><label>Group name<input value={group.title} onChange={e=>changeGroup(groupIndex,e.target.value)} maxLength={120} placeholder="e.g. Board of Trustees"/></label><div className="organization-edit-people">{group.items.map((person,personIndex)=><div className="organization-edit-person" key={personIndex}><div className="organization-edit-portrait">{person.photo?<img src={person.photo} alt="Portrait preview"/>:<span aria-hidden="true">◯</span>}</div><div className="organization-person-fields"><label>Name<input value={person.name} onChange={e=>changePerson(groupIndex,personIndex,{name:e.target.value})} maxLength={160} placeholder="Full name"/></label><label>Title / position<input value={person.title||''} onChange={e=>changePerson(groupIndex,personIndex,{title:e.target.value})} maxLength={160} placeholder="e.g. College President"/></label></div><label className="organization-photo-upload"><span>Upload photo</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload photo for ${person.name||'person'}`} onChange={e=>upload(e,groupIndex,personIndex)}/></label>{person.photo&&<button type="button" className="secondary" onClick={()=>changePerson(groupIndex,personIndex,{photo:''})}>Remove photo</button>}<button type="button" className="secondary organization-remove" onClick={()=>removePerson(groupIndex,personIndex)}>Remove person</button></div>)}</div><div className="organization-edit-actions"><button type="button" className="secondary" onClick={()=>addPerson(groupIndex)}>+ Add person</button><button type="button" className="text-button" onClick={()=>removeGroup(groupIndex)}>Remove group</button></div></div></details>
  </div>)}
  <div className="organization-editor-footer"><button type="button" className="secondary" onClick={addGroup}>+ Add group</button><button type="submit" className="primary">{busy?'Saving…':uploading?'Compressing photo…':'Save changes'}</button></div>
 </fieldset></form>}{error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}</section>
}
