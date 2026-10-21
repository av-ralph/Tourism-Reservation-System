import {sendBookingEmail} from './booking-email.js';

const booking={id:'11111111-1111-4111-8111-111111111111',name:'Student',email:'student@example.com',facility:'Hot Kitchen',date:'2099-10-10',start:'09:00',end:'10:00',instructorReviewedAt:'2099-10-01T01:00:00.000Z',reviewedAt:'2099-10-02T01:00:00.000Z',reviewNote:'Space unavailable'};

describe('booking status email',()=>{
 afterEach(()=>{delete process.env.RESEND_API_KEY;delete process.env.RESEND_FROM_EMAIL;vi.unstubAllGlobals();});
 it('skips sending until both Resend settings are configured',async()=>{
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect(await sendBookingEmail(booking,'instructor-approved')).toBe('not_configured');
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('sends the student a booking update without the private recovery code',async()=>{
  process.env.RESEND_API_KEY='re_test';process.env.RESEND_FROM_EMAIL='HM Laboratory <booking@example.org>';
  const fetchMock=vi.fn().mockResolvedValue(new Response('{}',{status:200}));vi.stubGlobal('fetch',fetchMock);
  expect(await sendBookingEmail(booking,'admin-rejected')).toBe('sent');
  const [url,options]=fetchMock.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers.Authorization).toBe('Bearer re_test');
  expect(options.headers['Idempotency-Key']).toContain(booking.id);
  const payload=JSON.parse(options.body);
  expect(payload).toMatchObject({to:['student@example.com'],subject:'Your HM laboratory request was declined'});
  expect(payload.text).toContain('Space unavailable');
  expect(payload.text).toContain(booking.id);
  expect(payload.text).not.toContain('recovery code');
 });
 it('reports delivery failure without throwing',async()=>{
  process.env.RESEND_API_KEY='re_test';process.env.RESEND_FROM_EMAIL='booking@example.org';
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{expect(await sendBookingEmail(booking,'admin-approved')).toBe('failed');}finally{spy.mockRestore();}
 });
});
