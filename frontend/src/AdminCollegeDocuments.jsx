import {useEffect,useState} from 'react'
import college from './college-content.json'
import './AdminCollegeDocuments.css'

const copySections=sections=>sections.map(section=>({
 ...section,
 paragraphs:[...(section.paragraphs||[])],
 items:[...(section.items||[])],
}))

export default function AdminCollegeDocuments({request}){
 const [sections,setSections]=useState(()=>copySections(college.sections))
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{let active=true;request('college-content').then(result=>{if(active&&result.sections)setSections(copySections(result.sections))}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[request])
 function updateSection(index,changes){setSections(current=>current.map((section,i)=>i===index?{...section,...changes}:section));setNotice('');setError('')}
 function updateLine(index,key,lineIndex,value){setSections(current=>current.map((section,i)=>i===index?{...section,[key]:section[key].map((line,j)=>j===lineIndex?value:line)}:section));setNotice('');setError('')}
 function addLine(index,key){setSections(current=>current.map((section,i)=>i===index?{...section,[key]:[...section[key],'']}:section));setNotice('')}
 function removeLine(index,key,lineIndex){setSections(current=>current.map((section,i)=>i===index?{...section,[key]:section[key].filter((_,j)=>j!==lineIndex)}:section));setNotice('')}
 async function save(event){
  event.preventDefault();setError('');setNotice('');
  if(sections.some(section=>!section.title.trim()||![...section.paragraphs,...section.items].some(line=>line.trim())||[...section.paragraphs,...section.items].some(line=>!line.trim()))){setError('Each section needs a title and at least one filled paragraph or list item. Remove empty lines before saving.');return}
  setSaving(true)
  try{const result=await request('college-content',{method:'PATCH',body:JSON.stringify({sections})});setSections(copySections(result.sections));setNotice('Saved. The About CeC page now shows this text.')}
  catch(e){setError(e.message)}finally{setSaving(false)}
 }
 return <section className="records college-documents-editor">
  <div className="section-heading"><div><h2>College Documents</h2><p>Edit the college text shown on About CeC. Save to publish all changes together.</p></div></div>
  <div className="document-list">{college.downloads.map(doc=><a key={doc.url} href={doc.url} download>{doc.name.startsWith('ACA-')?'HRM Laboratory Utilization Form':doc.name.replace('.docx','')}<span>Download Word document ↓</span></a>)}</div>
  <p className="college-documents-hint">These are the About CeC page sections extracted from the reference documents. The downloadable Word files remain the original copies.</p>
  {loading?<p role="status">Loading document text…</p>:<form onSubmit={save}><fieldset disabled={saving}>
   {sections.map((section,index)=><details className="college-document-section" key={index}><summary><strong>{section.title}</strong><small>{section.source||'College text'}</small></summary><div className="college-document-fields">
    <label>Section title<input value={section.title} maxLength={120} required onChange={e=>updateSection(index,{title:e.target.value})}/></label>
    <div className="college-document-lines"><h3>Paragraphs</h3>{section.paragraphs.map((line,lineIndex)=><div className="college-document-line" key={lineIndex}><label><span>Paragraph {lineIndex+1}</span><textarea value={line} maxLength={2000} rows={Math.min(8,Math.max(3,Math.ceil(line.length/90)))} onChange={e=>updateLine(index,'paragraphs',lineIndex,e.target.value)}/></label><button type="button" className="secondary" onClick={()=>removeLine(index,'paragraphs',lineIndex)} aria-label={`Remove paragraph ${lineIndex+1} from ${section.title}`}>Remove</button></div>)}<button type="button" className="secondary" onClick={()=>addLine(index,'paragraphs')} disabled={section.paragraphs.length>=30}>+ Add paragraph</button></div>
    <div className="college-document-lines"><h3>List items</h3>{section.items.map((line,lineIndex)=><div className="college-document-line" key={lineIndex}><label><span>Item {lineIndex+1}</span><textarea value={line} maxLength={2000} rows={2} onChange={e=>updateLine(index,'items',lineIndex,e.target.value)}/></label><button type="button" className="secondary" onClick={()=>removeLine(index,'items',lineIndex)} aria-label={`Remove item ${lineIndex+1} from ${section.title}`}>Remove</button></div>)}<button type="button" className="secondary" onClick={()=>addLine(index,'items')} disabled={section.items.length>=30}>+ Add list item</button></div>
    {section.note!==undefined&&<label>Note<input value={section.note} maxLength={500} onChange={e=>updateSection(index,{note:e.target.value})}/></label>}
   </div></details>)}
   <div className="college-document-save"><button type="submit" className="primary">{saving?'Saving…':'Save About CeC text'}</button></div>
  </fieldset></form>}
  {error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
 </section>
}
