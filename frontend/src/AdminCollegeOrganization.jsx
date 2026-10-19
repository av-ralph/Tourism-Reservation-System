import { useEffect, useState } from 'react'
import { defaultOrganization, emptyOrganizationSections, includeOrganizationSections } from './organization-defaults'
import { prepareImagePhoto } from './profile-photo'
import './CollegeOrganization.css'

export default function AdminCollegeOrganization({request}){
 const [groups,setGroups]=useState(defaultOrganization),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{let active=true;request('organization').then(result=>{if(active)setGroups(result.groups?includeOrganizationSections(result.groups):defaultOrganization())}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[request])
 function changeGroup(index,value){setGroups(current=>current.map((group,i)=>i===index?{...group,title:value}:group));setNotice('')}
 function changePerson(groupIndex,personIndex,changes){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.map((person,j)=>j===personIndex?{...person,...changes}:person)}:group));setNotice('')}
 function addGroup(){if(groups.length>=20){setError('You can add up to 20 groups.');return}setGroups(current=>[...current,{title:'',items:[{name:'',photo:''}]}]);setNotice('')}
 function addPerson(index){if(groups[index].items.length>=30||groups.reduce((sum,group)=>sum+group.items.length,0)>=150){setError('The organization list has reached its limit.');return}setGroups(current=>current.map((group,i)=>i===index?{...group,items:[...group.items,{name:'',photo:''}]}:group));setNotice('')}
 function removePerson(groupIndex,personIndex){setGroups(current=>current.map((group,i)=>i===groupIndex?{...group,items:group.items.filter((_,j)=>j!==personIndex)}:group));setNotice('')}
 function removeGroup(index){setGroups(current=>current.filter((_,i)=>i!==index));setNotice('')}
 async function upload(event,groupIndex,personIndex){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setError('');setUploading(true);
  try{
   const photo=await prepareImagePhoto(file,{square:true,sizes:[160,128,112,96],maxLength:30000});
   changePerson(groupIndex,personIndex,{photo});setNotice('Portrait compressed and ready. Save changes to publish it.');
  }catch(e){setError(e.message||'Unable to open photo.')}finally{setUploading(false)}
 }
 async function save(event){
  event.preventDefault();setError('');setNotice('');
  if(!groups.length||groups.some(group=>!group.title.trim()||(!group.items.length&&!emptyOrganizationSections.includes(group.title.trim()))||group.items.some(person=>!person.name.trim()))){setError('Every group needs a name. Add at least one person to each group except The Founders and Faculty and Staff.');return}
  setBusy(true);
  try{const result=await request('organization',{method:'PATCH',body:JSON.stringify({groups})});setGroups(result.groups);setNotice('College organization saved. The user page now shows these changes.')}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="records organization-editor"><div className="section-heading"><div><h2>College organization</h2><p>Edit each group and person. Portraits appear beside names on the About CeC page.</p></div></div>{loading?<p role="status">Loading organization…</p>:<form onSubmit={save}><fieldset disabled={busy||uploading}>{groups.map((group,groupIndex)=><details className="organization-edit-group" key={groupIndex}><summary>{group.title||'New group'} <small>{group.items.length} {group.items.length===1?'person':'people'}</small></summary><div className="organization-edit-body"><label>Group name<input value={group.title} onChange={e=>changeGroup(groupIndex,e.target.value)} maxLength={120} placeholder="e.g. Board of Trustees"/></label><div className="organization-edit-people">{group.items.map((person,personIndex)=><div className="organization-edit-person" key={personIndex}><div className="organization-edit-portrait">{person.photo?<img src={person.photo} alt="Portrait preview"/>:<span aria-hidden="true">◯</span>}</div><label>Name and role<input value={person.name} onChange={e=>changePerson(groupIndex,personIndex,{name:e.target.value})} maxLength={160} placeholder="Full name and position"/></label><label className="organization-photo-upload"><span>Upload photo</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload photo for ${person.name||'person'}`} onChange={e=>upload(e,groupIndex,personIndex)}/></label>{person.photo&&<button type="button" className="secondary" onClick={()=>changePerson(groupIndex,personIndex,{photo:''})}>Remove photo</button>}<button type="button" className="secondary organization-remove" onClick={()=>removePerson(groupIndex,personIndex)}>Remove person</button></div>)}</div><div className="organization-edit-actions"><button type="button" className="secondary" onClick={()=>addPerson(groupIndex)}>+ Add person</button><button type="button" className="text-button" onClick={()=>removeGroup(groupIndex)}>Remove group</button></div></div></details>)}<div className="organization-editor-footer"><button type="button" className="secondary" onClick={addGroup}>+ Add group</button><button type="submit" className="primary">{busy?'Saving…':uploading?'Compressing photo…':'Save changes'}</button></div></fieldset></form>}{error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}</section>
}
