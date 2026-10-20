import './AdminBookingCalendar.css'

const manilaToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())
const monthKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
const dayKey=(month,day)=>`${month}-${String(day).padStart(2,'0')}`
const shiftMonth=(month,offset)=>{const [year,number]=month.split('-').map(Number);return monthKey(new Date(year,number-1+offset,1))}
const dateForMonth=month=>{const [year,number]=month.split('-').map(Number);return new Date(year,number-1,1)}
const statusLabel=status=>status==='Awaiting instructor'?'With instructor':status==='Awaiting admin'?'Pending final':status

export default function AdminBookingCalendar({reservations,facility,selectedDate,onSelectDate,month,onMonthChange}){
 const first=dateForMonth(month)
 const offset=first.getDay()
 const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate()
 const filtered=reservations.filter(row=>!['Cancelled','Rejected'].includes(row.status)&&(facility==='All facilities'||row.facility===facility))
 const byDate=new Map()
 for(const booking of filtered){const list=byDate.get(booking.date)||[];list.push(booking);byDate.set(booking.date,list)}
 const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>{const day=index-offset+1;return day>0&&day<=days?day:null})
 const today=manilaToday()
 const monthLabel=first.toLocaleDateString('en-PH',{month:'long',year:'numeric'})
 return <section className="admin-booking-calendar" aria-label="Booking calendar"><div className="admin-booking-calendar-head"><div><h3>{monthLabel}</h3><p>Select a date to see its bookings below.</p></div><div className="admin-booking-calendar-nav"><button type="button" aria-label="Previous month" onClick={()=>onMonthChange(shiftMonth(month,-1))}>‹</button><button type="button" onClick={()=>{const now=manilaToday();onMonthChange(now.slice(0,7));onSelectDate(now)}}>Today</button><button type="button" aria-label="Next month" onClick={()=>onMonthChange(shiftMonth(month,1))}>›</button></div></div><div className="admin-booking-calendar-grid" role="grid" aria-label={monthLabel}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(name=><div className="admin-booking-calendar-weekday" key={name} role="columnheader">{name}</div>)}{cells.map((day,index)=>{if(!day)return <div className="admin-booking-calendar-empty" key={`empty-${index}`} role="gridcell"/>;const date=dayKey(month,day),bookings=(byDate.get(date)||[]).sort((a,b)=>a.start.localeCompare(b.start));return <div className={'admin-booking-calendar-day'+(date===today?' is-today':'')+(date===selectedDate?' is-selected':'')} role="gridcell" key={date}><button type="button" aria-label={`${date}, ${bookings.length} ${bookings.length===1?'booking':'bookings'}`} aria-pressed={date===selectedDate} onClick={()=>onSelectDate(date)}><span className="admin-booking-calendar-number">{day}</span>{bookings.length>0&&<span className="admin-booking-calendar-count">{bookings.length} {bookings.length===1?'booking':'bookings'}</span>}{bookings.slice(0,2).map(booking=><span className="admin-booking-calendar-event" data-status={booking.status} key={booking.id} title={`${booking.start}–${booking.end} · ${booking.facility} · ${statusLabel(booking.status)}`}><b>{booking.start}</b> {booking.facility}</span>)}{bookings.length>2&&<span className="admin-booking-calendar-more">+{bookings.length-2} more</span>}</button></div>})}</div></section>
}
