import type {Row} from './record-store.js';
import nodemailer from 'nodemailer';
import {createBookingEmail, type BookingEmailEvent} from './booking-email-template.js';

export type BookingEmailStatus='sent'|'not_configured'|'failed';
export type {BookingEmailEvent};

export async function sendBookingEmail(row:Row,event:BookingEmailEvent):Promise<BookingEmailStatus>{
 const from=process.env.GMAIL_SMTP_USER?.trim(),password=process.env.GMAIL_SMTP_APP_PASSWORD?.trim();
 if(!from||!password)return 'not_configured';
 if(!row.email||!row.id)return 'failed';
 try{
  const transport=nodemailer.createTransport({service:'gmail',auth:{user:from,pass:password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});
  try{await transport.sendMail({from:`Cristal e-College HM Laboratory <${from}>`,to:row.email,...createBookingEmail(row,event)});}
  finally{transport.close();}
  return 'sent';
 }catch(error){console.error(`Booking email delivery failed (${event}):`,error instanceof Error?error.message:'unknown error');return 'failed';}
}
