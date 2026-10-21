import type {Row} from './record-store.js';
import nodemailer from 'nodemailer';

export type BookingEmailStatus='sent'|'not_configured'|'failed';
export type BookingEmailEvent='instructor-approved'|'instructor-declined'|'admin-approved'|'admin-rejected';

const subjects:Record<BookingEmailEvent,string>={
 'instructor-approved':'Your HM laboratory request passed instructor review',
 'instructor-declined':'Your HM laboratory request was declined',
 'admin-approved':'Your HM laboratory booking is approved',
 'admin-rejected':'Your HM laboratory request was declined',
};

export async function sendBookingEmail(row:Row,event:BookingEmailEvent):Promise<BookingEmailStatus>{
 const from=process.env.GMAIL_SMTP_USER?.trim(),password=process.env.GMAIL_SMTP_APP_PASSWORD?.trim();
 if(!from||!password)return 'not_configured';
 if(!row.email||!row.id)return 'failed';
 const state=event==='instructor-approved'
  ?'Your instructor has approved your request. The laboratory administrator will make the final decision.'
  :event==='admin-approved'
   ?'Your booking has been fully approved. You can download the completed utilization form from My bookings.'
   :'Your booking request was declined.';
 const reason=event.endsWith('declined')||event==='admin-rejected'?(row.reviewNote||row.instructorNote||'').trim():'';
 const text=[`Hello ${row.name||'student'},`,'',state,'',`Booking reference: ${row.id}`,`Space: ${row.facility||'Not recorded'}`,`Schedule: ${row.date||''} ${row.start||''}–${row.end||''}`,...(reason?[`Reason: ${reason}`]:[]),'','Check My bookings: https://hmreservation.vercel.app/','','Cristal e-College HM Laboratory'].join('\n');
 try{
  const transport=nodemailer.createTransport({service:'gmail',auth:{user:from,pass:password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});
  try{await transport.sendMail({from:`Cristal e-College HM Laboratory <${from}>`,to:row.email,subject:subjects[event],text});}
  finally{transport.close();}
  return 'sent';
 }catch(error){console.error(`Booking email delivery failed (${event}):`,error instanceof Error?error.message:'unknown error');return 'failed';}
}
