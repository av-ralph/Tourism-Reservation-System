import {useEffect,useMemo,useRef,useState} from 'react'
import './StaffNotifications.css'
import {timeRange} from './time-format'

const recentFirst=(a,b)=>String(b.reviewedAt||b.instructorReviewedAt||b.createdAt||'').localeCompare(String(a.reviewedAt||a.instructorReviewedAt||a.createdAt||''))
const dateLabel=value=>value?new Date(`${value}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric'}):''
const timeLabel=value=>value?new Date(value).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}):''

export default function StaffNotifications({role,reservations=[],reports=[],onReservation,onReports,onViewAll,onRefresh,updatedAt}){
 const [open,setOpen]=useState(false)
 const [newIds,setNewIds]=useState([])
 const root=useRef(null)
 const previousIds=useRef(null)
 const needsReview=reservations.filter(row=>row.status===(role==='admin'?'Awaiting admin':'Awaiting instructor')).sort(recentFirst)
 const openReports=role==='admin'?reports.filter(row=>row.status!=='Resolved').sort(recentFirst):[]
 const completed=role==='instructor'?reservations.filter(row=>row.instructorDecision==='Approved'&&['Approved','Rejected','Cancelled'].includes(row.status)).sort(recentFirst).slice(0,4):[]
 const actionIds=useMemo(()=>[
  ...reservations.filter(row=>row.status===(role==='admin'?'Awaiting admin':'Awaiting instructor')).map(row=>'request-'+row.id),
  ...(role==='admin'?reports.filter(row=>row.status!=='Resolved').map(row=>'report-'+row.id):[]),
 ],[reservations,reports,role])
 const count=actionIds.length

 useEffect(()=>{
  if(!open)return
  const close=event=>{if(event.key==='Escape'||(event.type==='pointerdown'&&!root.current?.contains(event.target)))setOpen(false)}
  document.addEventListener('pointerdown',close)
  document.addEventListener('keydown',close)
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)}
 },[open])
 useEffect(()=>{
  if(previousIds.current){
   const added=actionIds.filter(id=>!previousIds.current.has(id))
   setNewIds(current=>{const next=[...new Set([...current.filter(id=>actionIds.includes(id)),...added])];return next.length===current.length&&next.every((id,i)=>id===current[i])?current:next})
  }
  previousIds.current=new Set(actionIds)
 },[actionIds])

 const closeAnd=action=>{setOpen(false);setNewIds([]);action?.()}
 const toggle=()=>{if(!open)onRefresh?.();else setNewIds([]);setOpen(value=>!value)}
 return <div className="staff-notifications" ref={root}>
  <button type="button" className={'staff-notification-trigger'+(newIds.length?' has-new':'')} aria-label={`Notifications${count?`, ${count} needing attention`:''}`} aria-expanded={open} aria-haspopup="dialog" onClick={toggle} title="Notifications">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
   {count>0&&<span className="staff-notification-count">{count>99?'99+':count}</span>}
  </button>
  {open&&<section className="staff-notification-panel" role="dialog" aria-label="Notifications">
   <div className="staff-notification-heading"><div><strong>Notifications</strong><small>{count?`${count} ${count===1?'item needs':'items need'} attention`:'You’re all caught up'}</small></div><button type="button" aria-label="Close notifications" onClick={()=>{setOpen(false);setNewIds([])}}>×</button></div>
   <div className="staff-notification-live"><span aria-hidden="true"/>Auto-updating{updatedAt&&<small>· Updated {timeLabel(updatedAt)}</small>}</div>
   <div className="staff-notification-list">
    {count>0&&<div className="staff-notification-section"><span>Needs action</span><b>{count}</b></div>}
    {needsReview.map(row=><button type="button" key={'request-'+row.id} className="staff-notification-item" onClick={()=>closeAnd(()=>onReservation(row))}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>{role==='admin'?'Ready for final approval':'Reservation to review'}{newIds.includes('request-'+row.id)&&<em>New</em>}</strong><small>{row.name} · {row.facility}</small><small>{dateLabel(row.date)}{row.start?` · ${timeRange(row.start,row.end)}`:''}</small></span><span aria-hidden="true">→</span></button>)}
    {openReports.map(row=><button type="button" key={'report-'+row.id} className="staff-notification-item" onClick={()=>closeAnd(onReports)}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>Damage or loss report{newIds.includes('report-'+row.id)&&<em>New</em>}</strong><small>{row.facility||row.name||'Needs follow-up'}</small></span><span aria-hidden="true">→</span></button>)}
    {completed.length>0&&<div className="staff-notification-section staff-notification-recent"><span>Recent admin decisions</span></div>}
    {completed.map(row=><button type="button" key={'completed-'+row.id} className="staff-notification-item staff-notification-completed" onClick={()=>closeAnd(()=>onReservation(row))}><span className="staff-notification-dot" aria-hidden="true"/><span><strong>{row.status} by admin</strong><small>{row.name} · {row.facility}</small><small>{row.reviewedAt?new Date(row.reviewedAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}):''}</small></span><span aria-hidden="true">→</span></button>)}
    {!count&&!completed.length&&<p className="staff-notification-empty">New requests will appear here when they need your review.</p>}
   </div>
   {(count>0||completed.length>0)&&<button type="button" className="staff-notification-view-all" onClick={()=>closeAnd(onViewAll)}>View all requests <span aria-hidden="true">→</span></button>}
  </section>}
 </div>
}
