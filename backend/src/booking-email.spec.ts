import nodemailer from 'nodemailer';
import {sendBookingEmail} from './booking-email.js';
import {createBookingEmail} from './booking-email-template.js';

vi.mock('nodemailer',()=>({default:{createTransport:vi.fn()}}));

const booking={id:'11111111-1111-4111-8111-111111111111',name:'Student',email:'student@example.com',facility:'Hot Kitchen',date:'2099-10-10',start:'09:00',end:'10:00',reviewNote:'Space unavailable'};

describe('booking status email',()=>{
 afterEach(()=>{delete process.env.GMAIL_SMTP_USER;delete process.env.GMAIL_SMTP_APP_PASSWORD;vi.clearAllMocks();});
 it('skips sending until both Gmail settings are configured',async()=>{
  expect(await sendBookingEmail(booking,'instructor-approved')).toBe('not_configured');
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
 });
 it('sends the student a booking update without the private recovery code',async()=>{
  process.env.GMAIL_SMTP_USER='sender@gmail.com';process.env.GMAIL_SMTP_APP_PASSWORD='test-app-password';
  const sendMail=vi.fn().mockResolvedValue({messageId:'test'}),close=vi.fn();
  vi.mocked(nodemailer.createTransport).mockReturnValue({sendMail,close} as never);
  expect(await sendBookingEmail(booking,'admin-rejected')).toBe('sent');
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({service:'gmail',auth:{user:'sender@gmail.com',pass:'test-app-password'}}));
  const payload=sendMail.mock.calls[0][0];
  expect(payload).toMatchObject({to:'student@example.com',subject:'Your HM Laboratory request was declined'});
  expect(payload.text).toContain('Space unavailable');
  expect(payload.text).toContain(booking.id);
  expect(payload.text).not.toContain('recovery code');
  expect(payload.html).toContain('https://hmreservation.vercel.app/cec.png');
  expect(payload.html).toContain('https://hmreservation.vercel.app/hm-logo.webp');
  expect(payload.html).toContain('Space unavailable');
  expect(close).toHaveBeenCalled();
 });
 it('uses the correct status and safely renders student supplied details for every decision',()=>{
  const unsafe={...booking,name:'<Student & Co>',facility:'Hot <Kitchen>',reviewNote:'Use <another> space'};
  for(const event of ['instructor-approved','instructor-declined','admin-approved','admin-rejected'] as const){
   const email=createBookingEmail(unsafe,event);
   expect(email.html).toContain('&lt;Student &amp; Co&gt;');
   expect(email.html).toContain('Hot &lt;Kitchen&gt;');
   expect(email.html).not.toContain('<Student & Co>');
   expect(email.html).not.toContain('recovery code');
   expect(email.text).toContain(booking.id);
  }
  expect(createBookingEmail(unsafe,'instructor-approved').html).toContain('Pending Final Approval');
  expect(createBookingEmail(unsafe,'admin-approved').html).toContain('download your completed utilization form');
  expect(createBookingEmail(unsafe,'admin-rejected').html).toContain('Use &lt;another&gt; space');
 });
 it('shows 12-hour times and can email the endorsing instructor',async()=>{
  expect(createBookingEmail({...booking,start:'13:30',end:'17:05'},'admin-approved').text).toContain('2099-10-10 · 1:30 PM – 5:05 PM');
  process.env.GMAIL_SMTP_USER='sender@gmail.com';process.env.GMAIL_SMTP_APP_PASSWORD='test-app-password';
  const sendMail=vi.fn().mockResolvedValue({messageId:'test'}),close=vi.fn();
  vi.mocked(nodemailer.createTransport).mockReturnValue({sendMail,close} as never);
  expect(await sendBookingEmail({...booking,instructor:'Arvin S. Ode'},'staff-admin-approved','arvin@example.com')).toBe('sent');
  const payload=sendMail.mock.calls[0][0];
  expect(payload).toMatchObject({to:'arvin@example.com',subject:'A request you endorsed is approved'});
  expect(payload.text).toContain('Hello Arvin S. Ode,');
  expect(payload.text).toContain('Requested by: Student');
  expect(payload.text).toContain('https://hmreservation.vercel.app/instructor');
  expect(createBookingEmail({...booking,instructor:'Arvin S. Ode'},'staff-admin-rejected').text).toContain('Reason: Space unavailable');
 });
 it('reports delivery failure without throwing',async()=>{
  process.env.GMAIL_SMTP_USER='sender@gmail.com';process.env.GMAIL_SMTP_APP_PASSWORD='test-app-password';
  const close=vi.fn();vi.mocked(nodemailer.createTransport).mockReturnValue({sendMail:vi.fn().mockRejectedValue(new Error('SMTP unavailable')),close} as never);
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{expect(await sendBookingEmail(booking,'admin-approved')).toBe('failed');expect(close).toHaveBeenCalled();}finally{spy.mockRestore();}
 });
});
