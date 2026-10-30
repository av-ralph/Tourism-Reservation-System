import {useEffect,useState} from 'react'
import {defaultOrganization,emptyOrganizationSections,includeOrganizationSections} from './organization-defaults'
import {prepareImagePhoto} from './profile-photo'
import './CollegeOrganization.css'

const withKeys=groups=>groups.map(group=>({...group,clientId:crypto.randomUUID()}))

export default function AdminCollegeOrganizationEditor({request}){
 const [groups,setGroups]=useState(()=>withKeys(defaultOrganization()))
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false)
 const [dragging,setDragging]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const peopleCount=groups.reduce((sum,group)=>sum+group.items.length,0)

 useEffect(()=>{let active=true;request('organization').then(result=>{if(active)setGroups(withKeys(result.groups?includeOrganizationSections(result.groups):defaultOrganization()))}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[request])
 function changed(){setNotice('');setError('')}
 function changeGroup(index,value){setGroups(current=>current.map((group,i)=>i===index?{...group,title:value}:group));changed()}
 function changePerson(groupIndex,personIndex,changes){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.map((person,j)=>j===personIndex?{...person,...changes}:person)}:group));changed()}
 function addGroup(){setGroups(current=>[...current,{clientId:crypto.randomUUID(),title:'',items:[{name:'',title:'',photo:''}]}]);changed()}
 function addPerson(index){setGroups(current=>current.map((group,i)=>i===index?{...group,items:[...group.items,{name:'',title:'',photo:''}]}:group));changed()}
 function removePerson(groupIndex,personIndex){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.filter((_,j)=>j!==personIndex)}:group));changed()}
 function removeGroup(index){setGroups(current=>current.filter((_,i)=>i!==index));changed()}
 function moveGroup(from,to){if(from===to||from<0||to<0||from>=groups.length||to>=groups.length)return;setGroups(current=>{const next=[...current],item=next.splice(from,1)[0];next.splice(to,0,item);return next});changed()}
 function dropGroup(event,to){const value=event.dataTransfer.getData('application/x-college-group');if(!value)return;event.preventDefault();const from=Number(value);if(Number.isInteger(from))moveGroup(from,to);setDragging(null)}
 async function upload(event,groupIndex,personIndex){
  const file=event.target.files?.[0];event.target.value='';if(!file)return
  setError('');setUploading(true)
  try{const photo=await prepareImagePhoto(file,{square:true,sizes:[160,128,112,96],maxLength:30000});changePerson(groupIndex,personIndex,{photo});setNotice('Portrait ready. Save changes to publish it.')}
  catch(e){setError(e.message||'Unable to open photo.')}finally{setUploading(false)}
 }
 async function save(event){
  event.preventDefault();setError('');setNotice('')
  if(!groups.length||groups.some(group=>!group.title.trim()||(!group.items.length&&!emptyOrganizationSections.includes(group.title.trim()))||group.items.some(person=>!person.name.trim()))){setError('Every group needs a name. Add at least one person to each group except The Founders and Faculty and Staff.');return}
  setBusy(true)
  try{const result=await request('organization',{method:'PATCH',body:JSON.stringify({groups:groups.map(group=>({title:group.title,items:group.items}))})});setGroups(withKeys(result.groups));setNotice('Saved. About CeC now shows this order and these titles.')}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }

 return <section className="records organization-editor">
  <div className="section-heading"><div><h2>College Organization</h2><p>Arrange the groups, then open one to edit its people. Your changes appear on About CeC after you save.</p></div></div>
  {loading?<p role="status">Loading organization…</p>:<form onSubmit={save}><fieldset disabled={busy||uploading}>
   <div className="organization-editor-toolbar"><div className="organization-editor-summary"><strong>{groups.length} groups</strong><span>{peopleCount} people</span><small>Drag a handle or use the arrows to reorder.</small></div><div className="organization-editor-toolbar-actions"><button type="button" className="secondary" onClick={addGroup}>+ Add Group</button><button type="submit" className="primary">{busy?'Saving…':uploading?'Preparing Photo…':'Save Changes'}</button></div></div>
   <div className="organization-edit-list">{groups.map((group,groupIndex)=><div className={'organization-sort-row'+(dragging===groupIndex?' is-dragging':'')} key={group.clientId} onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-college-group')){event.preventDefault();event.dataTransfer.dropEffect='move'}}} onDrop={event=>dropGroup(event,groupIndex)}>
    <details className="organization-edit-group"><summary><span className="organization-sort-position">{String(groupIndex+1).padStart(2,'0')}</span><span className="organization-summary-title">{group.title||'New group'}</span><small>{group.items.length} {group.items.length===1?'person':'people'}</small><span className="organization-summary-chevron" aria-hidden="true">⌄</span></summary>
     <div className="organization-edit-body"><label className="organization-group-name">Group name<input value={group.title} onChange={e=>changeGroup(groupIndex,e.target.value)} maxLength={120} placeholder="e.g. Board of Trustees"/></label>
      <div className="organization-people-heading"><h3>People in This Group</h3><span>{group.items.length} total</span></div>
      <div className="organization-edit-people">{group.items.map((person,personIndex)=><div className="organization-edit-person" key={personIndex}>
       <span className="organization-person-number">{personIndex+1}</span><div className="organization-edit-portrait">{person.photo?<img src={person.photo} alt="Portrait preview"/>:<span aria-hidden="true">◯</span>}</div>
       <div className="organization-person-fields"><label>Name<input value={person.name} onChange={e=>changePerson(groupIndex,personIndex,{name:e.target.value})} maxLength={160} placeholder="Full name"/></label><label>Title / position<input value={person.title||''} onChange={e=>changePerson(groupIndex,personIndex,{title:e.target.value})} maxLength={160} placeholder="e.g. College President"/></label></div>
       <div className="organization-person-actions"><label className="organization-photo-upload"><span>{person.photo?'Change Photo':'Add Photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${person.photo?'Change':'Add'} photo for ${person.name||'person'}`} onChange={e=>upload(e,groupIndex,personIndex)}/></label>{person.photo&&<button type="button" className="organization-text-action" onClick={()=>changePerson(groupIndex,personIndex,{photo:''})}>Remove Photo</button>}<button type="button" className="organization-text-action is-danger" onClick={()=>removePerson(groupIndex,personIndex)}>Remove Person</button></div>
      </div>)}</div>
      <div className="organization-edit-actions"><button type="button" className="secondary" onClick={()=>addPerson(groupIndex)}>+ Add Person</button><button type="button" className="organization-text-action is-danger" onClick={()=>removeGroup(groupIndex)}>Remove Group</button></div>
     </div>
    </details>
    <div className="organization-sort-controls" aria-label={`Reorder ${group.title||'new group'}`}><button type="button" className="organization-drag-handle" draggable={!busy&&!uploading} onDragStart={event=>{event.dataTransfer.setData('application/x-college-group',String(groupIndex));event.dataTransfer.effectAllowed='move';setDragging(groupIndex)}} onDragEnd={()=>setDragging(null)} aria-label={`Drag ${group.title||'new group'} to reorder`} title="Drag to reorder"><span aria-hidden="true">⠿</span><span className="organization-sort-label">Drag</span></button><button type="button" className="secondary organization-move-button" onClick={()=>moveGroup(groupIndex,groupIndex-1)} disabled={groupIndex===0} aria-label={`Move ${group.title||'new group'} up`} title="Move up"><span aria-hidden="true">↑</span><span className="organization-sort-label">Up</span></button><button type="button" className="secondary organization-move-button" onClick={()=>moveGroup(groupIndex,groupIndex+1)} disabled={groupIndex===groups.length-1} aria-label={`Move ${group.title||'new group'} down`} title="Move down"><span aria-hidden="true">↓</span><span className="organization-sort-label">Down</span></button></div>
   </div>)}</div>
  </fieldset></form>}
  {error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
 </section>
}
