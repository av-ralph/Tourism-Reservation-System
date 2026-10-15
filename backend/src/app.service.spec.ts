import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppService} from './app.service.js';
describe('reservations',()=>{
 let dir:string,service:AppService;
 const booking={facility:'Hot Kitchen',name:'Test',studentId:'TEST',date:'2099-10-10',start:'09:00',end:'10:00',purpose:'Practice',subject:'Culinary',instructor:'Instructor',equipment:'None',email:'student@example.com',termsAccepted:true};
 const signature=[[[10,10],[24,30],[40,18],[57,42],[75,24],[94,49],[112,31],[130,55]]];
 beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'hm-test-'));process.env.HM_STORAGE='file';process.env.HM_DATA_FILE=join(dir,'records.json');service=new AppService();});
 afterEach(async()=>{delete process.env.HM_STORAGE;delete process.env.HM_DATA_FILE;await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
 it('restricts key management and persists revocation',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   expect(await service.authorizeAdmin('Bearer test-super-key')).toBe('superadmin');
   expect(await service.adminIdentity('Bearer test-super-key')).toMatchObject({role:'superadmin',adminName:'Super admin'});
   expect(()=>service.createAdminKey({name:'Staff',key:'short'})).toThrow();
   const row=await service.createAdminKey({name:'Staff',key:'staff-custom-key-123'});
   expect(await new AppService().authorizeAdmin('Bearer staff-custom-key-123')).toBe('admin');
   expect(await service.adminIdentity('Bearer staff-custom-key-123')).toMatchObject({role:'admin',adminName:'Staff'});
   await expect(service.authorizeSuperAdmin('Bearer staff-custom-key-123')).rejects.toThrow('Only the super admin');
   await expect(service.createAdminKey({name:'Other',key:'staff-custom-key-123'})).rejects.toThrow('already in use');
   expect((await new AppService().listAdminKeys())[0]?.key).toBe('staff-custom-key-123');
   const stored=await import('node:fs/promises').then(fs=>fs.readFile(join(dir,'records.json'),'utf8'));
   expect(stored).not.toContain('staff-custom-key-123');
   await service.updateAdminProfile('Bearer staff-custom-key-123',{name:'Staff member',email:'staff@example.com',photo:''});
   expect(await new AppService().adminIdentity('Bearer staff-custom-key-123')).toMatchObject({adminName:'Staff member',adminEmail:'staff@example.com'});
   expect(await service.adminIdentity('Bearer test-super-key')).toMatchObject({adminName:'Super admin'});
   await expect(service.updateAdminProfile('Bearer staff-custom-key-123',{name:'Staff',email:'invalid',photo:''})).rejects.toThrow('email');
   await expect(service.updateAdminProfile('Bearer staff-custom-key-123',{name:'Staff',email:'',photo:'https://invalid'})).rejects.toThrow('photo');
   await service.revokeAdminKey(row.id);
   await expect(service.authorizeAdmin('Bearer staff-custom-key-123')).rejects.toThrow('valid administrator');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('persists records across restart',async()=>{await service.create('reservations',booking);expect((await new AppService().records()).reservations).toHaveLength(1);});
 it('saves and validates the public college organization',async()=>{
  expect(await service.collegeOrganization()).toEqual({groups:null});
  const groups=[{title:'Laboratory team',items:[{name:'Example Person – Laboratory In-Charge',photo:''}]}];
  expect(await service.saveCollegeOrganization({groups})).toEqual({groups});
  expect(await new AppService().collegeOrganization()).toEqual({groups});
  const withHeadings=[{title:'The Founders',items:[]},...groups,{title:'Faculty and Staff',items:[]}];
  expect(await service.saveCollegeOrganization({groups:withHeadings})).toEqual({groups:withHeadings});
  await expect(service.saveCollegeOrganization({groups:[{title:'Other group',items:[]}]})).rejects.toThrow('between 1 and 30 people');
  await expect(service.saveCollegeOrganization({groups:[{title:'',items:groups[0].items}]})).rejects.toThrow('group name');
  await expect(service.saveCollegeOrganization({groups:[{title:'Laboratory team',items:[{name:'Example Person',photo:'https://example.com/photo.jpg'}]}]})).rejects.toThrow('JPEG portrait');
  expect(await new AppService().collegeOrganization()).toEqual({groups:withHeadings});
 });
 it('lets administrators manage instructor keys without granting administrator key access',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   const admin=await service.createStaffKey({name:'Office Admin',key:'office-admin-key-123',role:'admin'},'Bearer test-super-key');
   const adminAuth='Bearer office-admin-key-123';
   await expect(service.createStaffKey({name:'Another Admin',key:'another-admin-key-123',role:'admin'},adminAuth)).rejects.toThrow('instructor keys only');
   await expect(service.createStaffKey({name:'Default Admin',key:'default-admin-key-123'},adminAuth)).rejects.toThrow('instructor keys only');
   const instructor=await service.createStaffKey({name:'Instructor B',key:'instructor-b-key-123',role:'instructor'},adminAuth);
   expect((await service.adminRecords(adminAuth)).role).toBe('admin');
   await expect(service.adminRecords('Bearer instructor-b-key-123')).rejects.toThrow('Instructor keys cannot access');
   expect((await service.listStaffKeys(adminAuth)).map(row=>row.name)).toEqual(['Instructor B']);
   expect((await service.listStaffKeys('Bearer test-super-key')).map(row=>row.name)).toEqual(['Office Admin','Instructor B']);
   await expect(service.listStaffKeys('Bearer instructor-b-key-123')).rejects.toThrow('Instructor keys cannot access');
   await expect(service.createStaffKey({name:'Instructor C',key:'instructor-c-key-123',role:'instructor'},'Bearer instructor-b-key-123')).rejects.toThrow('Instructor keys cannot access');
   await expect(service.revokeStaffKey(admin.id,adminAuth)).rejects.toThrow('instructor keys only');
   await service.revokeStaffKey(instructor.id,adminAuth);
   await expect(service.authorizeInstructor('Bearer instructor-b-key-123')).rejects.toThrow('valid administrator');
   expect(await service.authorizeAdmin(adminAuth)).toBe('admin');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('separates instructor review from final admin approval',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Faculty A',key:'faculty-access-key-123',role:'instructor'});
   const key='Bearer faculty-access-key-123',reservation=await service.create('reservations',booking);
   expect((await service.instructorRecords(key)).reservations).toHaveLength(1);
   expect((await service.records()).reservations[0]?.status).toBe('Awaiting instructor');
   await expect(service.authorizeInstructor('Bearer test-super-key')).rejects.toThrow('instructor access key');
   await expect(service.authorizeAdmin(key)).rejects.toThrow('Instructor keys cannot access');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Declined',note:''},key)).rejects.toThrow('Explain why');
   await expect(service.reviewReservation(reservation.id!,{action:'Approved',note:'',signatureConfirmed:true})).rejects.toThrow('instructor');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature:[]},key)).rejects.toThrow('signature');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature:[[[10,10],[12,11]]]},key)).rejects.toThrow('signature');
   await service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature},key);
   expect((await service.records()).reservations[0]?.status).toBe('Awaiting admin');
   expect((await service.records()).reservations[0]?.instructorSignature).toBe(JSON.stringify(signature));
   expect((await service.reviewReservation(reservation.id!,{action:'Approved',note:'',signatureConfirmed:true})).status).toBe('Approved');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Declined',note:'Reason'},key)).rejects.toThrow('awaiting instructor');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('routes public requests to their selected instructor before admin review',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   const first=await service.createAdminKey({name:'Instructor One',key:'instructor-one-key-123',role:'instructor'});
   await service.createAdminKey({name:'Instructor Two',key:'instructor-two-key-123',role:'instructor'});
   const owner='12345678-1234-1234-1234-123456789012';
   await expect(service.createForUser('reservations',{...booking,instructor:'Unknown Instructor'},owner)).rejects.toThrow('listed instructor');
   const row=await service.createForUser('reservations',{...booking,instructor:'Instructor One'},owner);
   expect(row.instructorKeyId).toBe(first.id);
   expect((await service.instructorRecords('Bearer instructor-one-key-123')).reservations).toHaveLength(1);
   expect((await service.instructorRecords('Bearer instructor-two-key-123')).reservations).toHaveLength(0);
   await expect(service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer instructor-two-key-123')).rejects.toThrow('another instructor');
   await expect(service.reviewReservation(row.id!,{action:'Rejected',note:'Too early'})).rejects.toThrow('instructor');
   await service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer instructor-one-key-123');
   expect((await service.userRecords(owner)).reservations[0]?.status).toBe('Awaiting admin');
   expect((await service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true})).status).toBe('Approved');
   const changed=await service.adminUpdate('reservations',row.id!,{purpose:'Changed activity'});
   expect(changed).toMatchObject({status:'Awaiting instructor',purpose:'Changed activity'});
   expect(changed.instructorSignature).toBeUndefined();
   await expect(service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true})).rejects.toThrow('instructor');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('ends the flow when an instructor declines a request',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Instructor One',key:'instructor-one-key-123',role:'instructor'});
   const row=await service.create('reservations',{...booking,instructor:'Instructor One'});
   await service.reviewAsInstructor(row.id!,{decision:'Declined',note:'The lab is unsuitable.'},'Bearer instructor-one-key-123');
   expect((await service.records()).reservations[0]).toMatchObject({status:'Rejected',reviewNote:'The lab is unsuitable.'});
   await expect(service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true})).rejects.toThrow('instructor');
   await expect(service.create('reservations',{...booking,instructor:'Instructor One'})).resolves.toBeDefined();
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('blocks simultaneous overlapping bookings',async()=>{const results=await Promise.allSettled([service.create('reservations',booking),service.create('reservations',booking)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);});
 it('requires email and terms but permits omitted ID',async()=>{await expect(service.create('reservations',{...booking,email:''})).rejects.toThrow('email address');await expect(service.create('reservations',{...booking,termsAccepted:false})).rejects.toThrow('Terms and Conditions');const withoutId={...booking};delete (withoutId as Partial<typeof booking>).studentId;expect((await service.create('reservations',withoutId)).studentId).toBe('');});
 it('releases cancelled times and permits adjacent sessions',async()=>{const row=await service.create('reservations',booking);await service.create('reservations',{...booking,start:'10:00',end:'11:00'});await service.cancel(row.id!);await expect(service.create('reservations',booking)).resolves.toBeDefined();});
 it('admin CRUD preserves ownership and rejects conflicting edits',async()=>{await service.createAdminKey({name:'Instructor',key:'instructor-test-key-123',role:'instructor'});const first=await service.create('reservations',booking,'owner');const second=await service.adminCreate('reservations',{...booking,start:'10:00',end:'11:00'});await expect(service.adminUpdate('reservations',second.id!,{start:'09:30'})).rejects.toThrow('already reserved');const edited=await service.adminUpdate('reservations',first.id!,{purpose:'Updated practice',owner:'attacker',status:'Approved'});expect(edited.owner).toBe('owner');expect(edited.status).toBe('Awaiting instructor');expect(edited.purpose).toBe('Updated practice');await service.adminDelete('reservations',first.id!);expect((await service.records()).reservations).toHaveLength(1);await expect(service.adminDelete('reservations','missing')).rejects.toThrow('not found');});
 it('supports facility CRUD and prevents deleting referenced facilities',async()=>{await service.createAdminKey({name:'Instructor',key:'instructor-test-key-123',role:'instructor'});const facility=await service.createFacility({name:'Practice Room',category:'Events',description:'Practice space',status:'Available',reason:''});await service.adminCreate('reservations',{...booking,facility:facility.name});await expect(service.deleteFacility(facility.id!)).rejects.toThrow('existing records');await expect(service.createFacility({name:'practice room',category:'Events',description:'Duplicate',status:'Available',reason:''})).rejects.toThrow('already exists');const empty=await service.createFacility({name:'Empty Room',category:'Events',description:'Space',status:'Available',reason:''});await service.deleteFacility(empty.id!);expect((await service.listFacilities()).some(f=>f.id===empty.id)).toBe(false);});
 it('admin report and utilization edits validate input',async()=>{const report=await service.adminCreate('reports',{...booking,date:'2020-01-01',type:'Damage',details:'Broken tray'});await expect(service.adminUpdate('reports',report.id!,{email:'invalid'})).rejects.toThrow('email');await service.adminUpdate('reports',report.id!,{details:'Broken plate'});await service.adminDelete('reports',report.id!);const visit=await service.adminCreate('utilization',{...booking,date:'2020-01-01',attendees:'10'});await expect(service.adminUpdate('utilization',visit.id!,{attendees:'0'})).rejects.toThrow('Participants');await service.adminDelete('utilization',visit.id!);expect((await service.records()).utilization).toHaveLength(0);});
 it('validates facility photos and permits removal',async()=>{const base={name:'Photo Room',category:'Events',description:'A room',status:'Available',reason:''};await expect(service.createFacility({...base,photo:'data:image/svg+xml;base64,unsafe'})).rejects.toThrow('valid JPEG');await expect(service.createFacility({...base,photo:'x'.repeat(220001)})).rejects.toThrow('valid JPEG');const row=await service.createFacility({...base,photo:''});expect((await service.updateFacility(row.id!,{description:'New description'})).photo).toBe('');});
 it('returns lightweight versioned photo URLs and image bytes',async()=>{const photo='data:image/jpeg;base64,/9j/AA==';const row=await service.createFacility({name:'Cached Photo Room',category:'Events',description:'Room',status:'Available',reason:'',photo});const before=(await service.listFacilities()).find(f=>f.id===row.id)!;expect(before.photo).toMatch(/^\/api\/facilities\/.+\/photo\?v=/);expect(JSON.stringify(before)).not.toContain('base64');expect(await service.facilityPhoto(row.id!)).toEqual(Buffer.from('/9j/AA==','base64'));await service.updateFacility(row.id!,{photo:'data:image/jpeg;base64,/9j/AQ=='});const after=(await service.listFacilities()).find(f=>f.id===row.id)!;expect(after.photo).not.toBe(before.photo);await service.updateFacility(row.id!,{photo:''});await expect(service.facilityPhoto(row.id!)).rejects.toThrow('not found');});
});
