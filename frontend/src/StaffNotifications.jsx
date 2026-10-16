import {useEffect,useRef,useState} from 'react'
import './StaffNotifications.css'

const recentFirst=(a,b)=>String(b.reviewedAt||b.instructorReviewedAt||b.createdAt||'').localeCompare(String(a.reviewedAt||a.instructorReviewedAt||a.createdAt||''))
const dateLabel=value=>value?new Date(`${value}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric'}):''

export default function StaffNotifications({role,reservations=[],reports=[],onReservation,onReports}){
 const [open,setOpen]=useState(false)
 const root=useRef(null)
 useEffect(()=>{if(!open)return;const close=event=>{if(event.key==='Escape'||(event.type==='pointerdown'&&!root.current?.contains(event.target)))setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)}},[open])
 const needsReview=reservations.filter(row=>row.status===(role==='admin'?'Awaiting admin':'Awaiting instructor')).sort(recentFirst)
 const openReports=role==='admin'?reports.filter(row=>row.status!=='Resolved').sort(recentFirst):[]
 const completed=role==='instructor'?reservations.filter(row=>row.instructorDecision==='Approved'&&['Approved','Rejected','Cancelled'].includes(row.status)).sort(recentFirst).slice(0,3):[]
 const count=needsReview.length+openReports.length
 const closeAnd=action=>{setOpen(false);action()}
 return <div className="staff-notifications" ref={root}>
  <button type="button" className="staff-notification-trigger" aria-label={`Notifications${count?`, ${count} needing attention`:''}`} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)} title="Notifications">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
   {count>0&&<span className="staff-notification-count">{count>99?'99+':count}</span>}
  </button>
  {open&&<section className="staff-notification-panel" role="dialog" aria-label="Notifications"><div className="staff-notification-heading"><div><strong>Notifications</strong><small>{count?`${count} ${count===1?'item needs':'items need'} attention`:'You’re all caught up'}</small></div><button type="button" aria-label="Close notifications" onClick={()=>setOpen(false)}>×</button></div><div className="staff-notification-list">
   {needsReview.map(row=><button type="button" key={'request-'+row.id} className="staff-notification-item" onClick={()=>closeAnd(()=>onReservation(row))}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>{role==='admin'?'Ready for final approval':'New reservation to review'}</strong><small>{row.name} · {row.facility}</small><small>{dateLabel(row.date)}{row.start?` · ${row.start}–${row.end}`:''}</small></span><span aria-hidden="true">→</span></button>)}
   {openReports.map(row=><button type="button" key={'report-'+row.id} className="staff-notification-item" onClick={()=>closeAnd(onReports)}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>Damage or loss report</strong><small>{row.facility||row.name||'Needs follow-up'}</small></span><span aria-hidden="true">→</span></button>)}
   {completed.map(row=><button type="button" key={'completed-'+row.id} className="staff-notification-item staff-notification-completed" onClick={()=>closeAnd(()=>onReservation(row))}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>Admin decision: {row.status}</strong><small>{row.name} · {row.facility}</small></span><span aria-hidden="true">→</span></button>)}
   {!count&&!completed.length&&<p className="staff-notification-empty">New requests will appear here when they need your review.</p>}
  </div></section>}
 </div>
}
