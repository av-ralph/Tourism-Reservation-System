import {concernItems} from './concern-form'
import './AdminIncidentReport.css'
import {timeRange} from './time-format'
const filedLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})}
export default function AdminIncidentReport({report:r,formatDate,onDownload,onResolve,onEdit,onDelete}){
 const resolved=r.status==='Resolved',items=r.reportItems?concernItems(r):[]
 const details=[['Date of usage',r.date&&formatDate(r.date)],['Time of usage',r.start&&timeRange(r.start,r.end)],['Subject',r.subject],['Instructor',r.instructor],['Purpose',r.purpose]].filter(([,value])=>value)
 return <article className={'incident-card'+(resolved?' is-resolved':'')}>
  <div className="incident-head">
   <div className="incident-title">
    <div className="incident-tags"><span className={'incident-status'+(resolved?' resolved':'')}>{resolved?'Resolved':'Open'}</span><span className="incident-type">{r.type}</span>{r.createdAt&&<span className="incident-filed">Filed {filedLabel(r.createdAt)}</span>}</div>
    <h3>{r.facility}</h3>
    <p className="incident-reporter">Reported by <strong>{r.name}</strong>{r.email&&<> · <a href={'mailto:'+r.email}>{r.email}</a></>}{r.studentId&&<> · ID {r.studentId}</>}</p>
   </div>
   <div className="incident-actions">
    <button className="secondary" onClick={onDownload}><span aria-hidden="true">⤓</span> Download form</button>
    {!resolved&&<button className="primary" onClick={onResolve}>Record resolution</button>}
    <div className="incident-manage"><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button incident-delete" onClick={onDelete}>Delete</button></div>
   </div>
  </div>
  {details.length>0&&<dl className="incident-details">{details.map(([label,value])=><div key={label} className={label==='Purpose'?'wide':''}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  {items.length>0&&<div className="incident-items-wrap"><table className="incident-items"><caption>Damaged or lost items</caption><thead><tr><th scope="col">Qty</th><th scope="col">Item / equipment</th><th scope="col">Condition</th></tr></thead><tbody>{items.map((item,i)=><tr key={i}><td>{item.quantity}</td><td>{item.description}</td><td><span className={'incident-condition '+item.condition.toLowerCase()}>{item.condition}</span></td></tr>)}</tbody></table></div>}
  <section className="incident-note"><h4>What happened</h4><p>{r.details}</p></section>
  {r.resolution&&<section className="incident-note incident-resolution"><h4>Resolution{r.resolvedAt&&<span> · {filedLabel(r.resolvedAt)}</span>}</h4><p>{r.resolution}</p></section>}
 </article>
}
