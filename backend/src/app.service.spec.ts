import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppService} from './app.service.js';
describe('reservations',()=>{
 let dir:string,service:AppService;
 const booking={facility:'Hot Kitchen',name:'Test',studentId:'TEST',date:'2099-10-10',start:'09:00',end:'10:00',purpose:'Practice',subject:'Culinary',instructor:'Instructor',equipment:'None',inventoryItems:[],email:'student@example.com',termsAccepted:true};
 const signature=[[[10,10],[24,30],[40,18],[57,42],[75,24],[94,49],[112,31],[130,55]]];
 beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'hm-test-'));process.env.HM_STORAGE='file';process.env.HM_DATA_FILE=join(dir,'records.json');service=new AppService();});
 afterEach(async()=>{delete process.env.HM_STORAGE;delete process.env.HM_DATA_FILE;await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
 it('restricts key management and persists revocation',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   expect(await service.authorizeAdmin('Bearer test-super-key')).toBe('superadmin');
   expect(await service.adminIdentity('Bearer test-super-key')).toMatchObject({role:'superadmin',adminName:'Super admin'});
   expect(()=>service.createAdminKey({name:'Staff',key:'short'})).toThrow();
   const row=await service.createAdminKey({name:'Staff',key:'StaffCustom1!'});
   expect(await new AppService().authorizeAdmin('Bearer StaffCustom1!')).toBe('admin');
   expect(await service.adminIdentity('Bearer StaffCustom1!')).toMatchObject({role:'admin',adminName:'Staff'});
   await expect(service.authorizeSuperAdmin('Bearer StaffCustom1!')).rejects.toThrow('Only the super admin');
   await expect(service.createAdminKey({name:'Other',key:'StaffCustom1!'})).rejects.toThrow('already in use');
   expect((await new AppService().listAdminKeys())[0]?.key).toBe('StaffCustom1!');
   const stored=await import('node:fs/promises').then(fs=>fs.readFile(join(dir,'records.json'),'utf8'));
   expect(stored).not.toContain('StaffCustom1!');
   await service.updateAdminProfile('Bearer StaffCustom1!',{name:'Staff member',email:'staff@example.com',photo:''});
   expect(await new AppService().adminIdentity('Bearer StaffCustom1!')).toMatchObject({adminName:'Staff member',adminEmail:'staff@example.com'});
   expect(await service.adminIdentity('Bearer test-super-key')).toMatchObject({adminName:'Super admin'});
   await expect(service.updateAdminProfile('Bearer StaffCustom1!',{name:'Staff',email:'invalid',photo:''})).rejects.toThrow('email');
   await expect(service.updateAdminProfile('Bearer StaffCustom1!',{name:'Staff',email:'',photo:'https://invalid'})).rejects.toThrow('photo');
   await service.revokeAdminKey(row.id);
   await expect(service.authorizeAdmin('Bearer StaffCustom1!')).rejects.toThrow('valid administrator');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('persists records across restart',async()=>{await service.create('reservations',booking);expect((await new AppService().records()).reservations).toHaveLength(1);});
 it('shows a changed instructor display name in staff, student, and reservation views',async()=>{
  const instructor=await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});
  const owner='11111111-1111-4111-8111-111111111111';
  const reservation=await service.createForUser('reservations',booking,owner);
  await service.updateAdminProfile('Bearer InstructorTest1!',{name:'New Instructor Name',email:'',photo:''});
  const restarted=new AppService();
  expect(await restarted.listInstructors()).toContainEqual({id:instructor.id,name:'New Instructor Name'});
  expect((await restarted.listAdminKeys()).find(row=>row.id===instructor.id)?.name).toBe('New Instructor Name');
  expect((await restarted.records()).reservations.find(row=>row.id===reservation.id)?.instructor).toBe('New Instructor Name');
  expect((await restarted.userRecords(owner)).reservations.find(row=>row.id===reservation.id)?.instructor).toBe('New Instructor Name');
  const another=await restarted.createForUser('reservations',{...booking,facility:'Cold Kitchen',instructor:'New Instructor Name'},owner);
  expect(another.instructorKeyId).toBe(instructor.id);
 });
 it('recovers a guest booking on another device with a private code',async()=>{
  await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});
  const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
  const created=await service.createForUser('reservations',booking,first);
  expect(created.recoveryCode).toMatch(/^[0-9a-f]{32}$/);
  expect((await service.userRecords(second)).reservations).toHaveLength(0);
  await expect(service.recoverReservation({id:created.id,code:'0'.repeat(32)},second)).rejects.toThrow('not found');
  const recovered=await service.recoverReservation({id:created.id,code:created.recoveryCode},second);
  expect(recovered.id).toBe(created.id);
  expect(recovered.recoveryCode).toBeUndefined();
  expect((await service.userRecords(second)).reservations).toHaveLength(1);
  expect((await service.userRecords(first)).reservations).toHaveLength(1);
  expect(JSON.stringify(await service.records())).not.toContain(created.recoveryCode);
  expect(JSON.stringify(await service.records())).not.toContain('recoveryHash');
  await service.cancelForUser(created.id!,second);
  expect((await service.userRecords(first)).reservations[0]?.status).toBe('Cancelled');
 });
 it('publishes positive report stock and enforces available booking quantities',async()=>{
  const catalog=await service.adminInventory();
  const reported=catalog.find(item=>item.id==='report-0-3');
  const missingUnit=catalog.find(item=>item.status==='Available'&&item.unit==='not recorded');
  const zeroStock=catalog.find(item=>item.status==='Draft'&&Number(item.quantity)===0);
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   expect(reported?.status).toBe('Available');
   expect((await service.listInventory()).some(entry=>entry.id===reported!.id)).toBe(true);
   expect((await service.listInventory()).find(entry=>entry.id===missingUnit!.id)?.unit).toBe('item');
   expect((await service.listInventory()).some(entry=>entry.id===zeroStock!.id)).toBe(false);
   await expect(service.updateInventory(zeroStock!.id!,{status:'Available'})).rejects.toThrow('quantity above zero');
   await expect(service.createInventory({name:'Unspecified',category:'Kitchen',quantity:'1',unit:'not recorded',status:'Available'})).rejects.toThrow('verified unit');
   const item=await service.createInventory({name:'Test mixing bowl',category:'Kitchen',quantity:'2',unit:'pcs',status:'Available',notes:''});
   expect(await service.listInventory()).toContainEqual({id:item.id,name:'Test mixing bowl',category:'Kitchen',model:'',quantity:'2',unit:'pcs'});
   await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});
   const token='11111111-1111-4111-8111-111111111111';
   const request={...booking,inventoryItems:[{id:item.id,quantity:2}]};
   const saved=await service.createForUser('reservations',request,token);
   expect(saved.equipment).toBe('2 | Test mixing bowl');
   await expect(service.createForUser('reservations',{...request,start:'10:00',end:'11:00',inventoryItems:[{id:item.id,quantity:3}]},token)).rejects.toThrow('only');
   await expect(service.createForUser('reservations',{...request,facility:'Cold Kitchen',start:'09:30',end:'10:30',inventoryItems:[{id:item.id,quantity:1}]},token)).rejects.toThrow('only 0');
   await expect(service.deleteInventory(item.id)).rejects.toThrow('used in a reservation');
   await service.updateInventory(item.id,{status:'Unavailable'});
   expect((await service.listInventory()).some(entry=>entry.id===item.id)).toBe(false);
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('accepts more than 22 distinct available items in one request',async()=>{
  const items=(await service.listInventory()).slice(0,23);
  expect(items).toHaveLength(23);
  await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});
  const selection=items.map(item=>({id:item.id,quantity:1}));
  const saved=await service.createForUser('reservations',{...booking,inventoryItems:selection},'11111111-1111-4111-8111-111111111111');
  expect(JSON.parse(saved.inventorySelection||'[]')).toHaveLength(23);
  expect(JSON.parse(saved.inventorySelection||'[]')[22]).toMatchObject({id:items[22].id,quantity:1,name:items[22].name});
  expect(saved.equipment).toContain(items[22].name);
 });
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
   const admin=await service.createStaffKey({name:'Office Admin',key:'OfficeAdmin1!',role:'admin'},'Bearer test-super-key');
   const adminAuth='Bearer OfficeAdmin1!';
   await expect(service.createStaffKey({name:'Another Admin',key:'AnotherAdmin1!',role:'admin'},adminAuth)).rejects.toThrow('instructor keys only');
   await expect(service.createStaffKey({name:'Default Admin',key:'DefaultAdmin1!'},adminAuth)).rejects.toThrow('instructor keys only');
   const instructor=await service.createStaffKey({name:'Instructor B',key:'InstructorB1!',role:'instructor'},adminAuth);
   expect((await service.adminRecords(adminAuth)).role).toBe('admin');
   await expect(service.adminRecords('Bearer InstructorB1!')).rejects.toThrow('Instructor keys cannot access');
   expect((await service.listStaffKeys(adminAuth)).map(row=>row.name)).toEqual(['Instructor B']);
   expect((await service.listStaffKeys('Bearer test-super-key')).map(row=>row.name)).toEqual(['Office Admin','Instructor B']);
   await expect(service.listStaffKeys('Bearer InstructorB1!')).rejects.toThrow('Instructor keys cannot access');
   await expect(service.createStaffKey({name:'Instructor C',key:'InstructorC1!',role:'instructor'},'Bearer InstructorB1!')).rejects.toThrow('Instructor keys cannot access');
   await expect(service.revokeStaffKey(admin.id,adminAuth)).rejects.toThrow('instructor keys only');
   await service.revokeStaffKey(instructor.id,adminAuth);
   await expect(service.authorizeInstructor('Bearer InstructorB1!')).rejects.toThrow('valid administrator');
   expect(await service.authorizeAdmin(adminAuth)).toBe('admin');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('persists profile photos separately for administrators and instructors',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  const photo='data:image/jpeg;base64,/9j/AA==';
  try{
   await service.createStaffKey({name:'Office Admin',key:'OfficeAdmin1!',role:'admin'},'Bearer test-super-key');
   await service.createStaffKey({name:'Testing instructor',key:'InstructorB1!',role:'instructor'},'Bearer test-super-key');
   await service.updateAdminProfile('Bearer OfficeAdmin1!',{name:'Office Admin',email:'',photo});
   await service.updateAdminProfile('Bearer InstructorB1!',{name:'Testing instructor',email:'',photo});
   const restarted=new AppService();
   expect((await restarted.adminRecords('Bearer OfficeAdmin1!')).adminPhoto).toBe(photo);
   expect((await restarted.instructorRecords('Bearer InstructorB1!')).adminPhoto).toBe(photo);
   expect((await restarted.adminRecords('Bearer test-super-key')).adminPhoto).toBe('');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('shows Cristian Jay M. Pechon’s admin photo on the public contact card only',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  const photo='data:image/jpeg;base64,/9j/AA==';
  try{
   await service.createStaffKey({name:'Cristian Jay M. Pechon',key:'OfficeAdmin1!',role:'admin'},'Bearer test-super-key');
   await service.createStaffKey({name:'Other Instructor',key:'InstructorB1!',role:'instructor'},'Bearer test-super-key');
   await service.updateAdminProfile('Bearer test-super-key',{name:'Cristian Jay M. Pechon',email:'',photo});
   await service.updateAdminProfile('Bearer InstructorB1!',{name:'Cristian Jay M. Pechon',email:'',photo});
   expect(await service.publicContact()).toEqual({photo:''});
   await service.updateAdminProfile('Bearer OfficeAdmin1!',{name:'Cristian Jay M. Pechon',email:'',photo});
   expect(await service.publicContact()).toEqual({photo});
   expect(await service.publicContactPhoto()).toEqual(Buffer.from('/9j/AA==','base64'));
   await service.updateAdminProfile('Bearer OfficeAdmin1!',{name:'Cristian Jay M. Pechon',email:'',photo:''});
   expect(await service.publicContact()).toEqual({photo:''});
   await expect(service.publicContactPhoto()).rejects.toThrow('not been uploaded');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('uses the sole regular admin photo when the account name differs from the contact name',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  const photo='data:image/jpeg;base64,/9j/AA==';
  try{
   await service.createStaffKey({name:'HM Admin',key:'OfficeAdmin1!',role:'admin'},'Bearer test-super-key');
   await service.updateAdminProfile('Bearer OfficeAdmin1!',{name:'Laboratory Admin',email:'',photo});
   expect(await service.publicContact()).toEqual({photo});
   await service.createStaffKey({name:'Second Admin',key:'SecondAdmin1!',role:'admin'},'Bearer test-super-key');
   await service.updateAdminProfile('Bearer SecondAdmin1!',{name:'Second Admin',email:'',photo});
   expect(await service.publicContact()).toEqual({photo:''});
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('separates instructor review from final admin approval',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Faculty A',key:'FacultyAccess1!',role:'instructor'});
   const key='Bearer FacultyAccess1!',reservation=await service.create('reservations',booking);
   expect((await service.instructorRecords(key)).reservations).toHaveLength(1);
   expect((await service.records()).reservations[0]?.status).toBe('Awaiting instructor');
   await expect(service.authorizeInstructor('Bearer test-super-key')).rejects.toThrow('instructor access key');
   await expect(service.authorizeAdmin(key)).rejects.toThrow('Instructor keys cannot access');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Declined',note:''},key)).rejects.toThrow('Explain why');
   await expect(service.reviewReservation(reservation.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key')).rejects.toThrow('instructor');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature:[]},key)).rejects.toThrow('signature');
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature:[[[10,10],[12,11]]]},key)).rejects.toThrow('signature');
   await service.reviewAsInstructor(reservation.id!,{decision:'Approved',note:'Suitable activity',signature},key);
   expect((await service.records()).reservations[0]?.status).toBe('Awaiting admin');
   expect((await service.records()).reservations[0]?.instructorSignature).toBe(JSON.stringify(signature));
   await expect(service.reviewReservation(reservation.id!,{action:'Approved',note:'',signatureConfirmed:true},'Bearer test-super-key')).rejects.toThrow('signature');
   const approved=await service.reviewReservation(reservation.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key');
   expect(approved).toMatchObject({status:'Approved',adminReviewedBy:'Super admin',adminSignature:JSON.stringify(signature)});
   await expect(service.reviewAsInstructor(reservation.id!,{decision:'Declined',note:'Reason'},key)).rejects.toThrow('awaiting instructor');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('allows a documented admin exception without inventing an instructor signature',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Busy Instructor',key:'BusyTeacher1!',role:'instructor'});
   const owner='11111111-1111-4111-8111-111111111111';
   const request=await service.createForUser('reservations',{...booking,instructor:'Busy Instructor'},owner);
   const exception={action:'Approved',skipInstructorReview:true,note:'Instructor unavailable for the scheduled activity.',signatureConfirmed:true,adminSignature:signature};
   await expect(service.reviewReservation(request.id!,{...exception,note:''},'Bearer test-super-key')).rejects.toThrow('waived');
   await expect(service.reviewReservation(request.id!,{...exception,signatureConfirmed:false},'Bearer test-super-key')).rejects.toThrow('exception');
   await expect(service.reviewReservation(request.id!,exception,'Bearer BusyTeacher1!')).rejects.toThrow('administrator');
   const approved=await service.reviewReservation(request.id!,exception,'Bearer test-super-key');
   expect(approved).toMatchObject({status:'Approved',adminOverride:'true',adminOverrideReason:exception.note,adminReviewedBy:'Super admin'});
   expect(approved.instructorSignature).toBeUndefined();
   expect(approved.instructorReviewedBy).toBeUndefined();
   expect((await service.userRecords(owner)).reservations[0]?.adminOverride).toBe('true');
   await expect(service.reviewAsInstructor(request.id!,{decision:'Approved',note:'',signature},'Bearer BusyTeacher1!')).rejects.toThrow('awaiting instructor');
   const revised=await service.adminUpdate('reservations',request.id!,{purpose:'Changed activity'});
   expect(revised).toMatchObject({status:'Awaiting instructor'});
   expect(revised.adminOverride).toBeUndefined();
   expect(revised.adminSignature).toBeUndefined();
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('routes public requests to their selected instructor before admin review',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   const first=await service.createAdminKey({name:'Instructor One',key:'InstructorOne1!',role:'instructor'});
   await service.createAdminKey({name:'Instructor Two',key:'InstructorTwo1!',role:'instructor'});
   const owner='12345678-1234-1234-1234-123456789012';
   await expect(service.createForUser('reservations',{...booking,instructor:'Unknown Instructor'},owner)).rejects.toThrow('listed instructor');
   const row=await service.createForUser('reservations',{...booking,instructor:'Instructor One'},owner);
   expect(row.instructorKeyId).toBe(first.id);
   expect((await service.instructorRecords('Bearer InstructorOne1!')).reservations).toHaveLength(1);
   expect((await service.instructorRecords('Bearer InstructorTwo1!')).reservations).toHaveLength(0);
   await expect(service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer InstructorTwo1!')).rejects.toThrow('another instructor');
   await expect(service.reviewReservation(row.id!,{action:'Rejected',note:'Too early'},'Bearer test-super-key')).rejects.toThrow('instructor');
   await service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer InstructorOne1!');
   expect((await service.userRecords(owner)).reservations[0]?.status).toBe('Awaiting admin');
   expect((await service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key')).status).toBe('Approved');
   const changed=await service.adminUpdate('reservations',row.id!,{purpose:'Changed activity'});
   expect(changed).toMatchObject({status:'Awaiting instructor',purpose:'Changed activity'});
   expect(changed.instructorSignature).toBeUndefined();
   await expect(service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key')).rejects.toThrow('instructor');
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('ends the flow when an instructor declines a request',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Instructor One',key:'InstructorOne1!',role:'instructor'});
   const row=await service.create('reservations',{...booking,instructor:'Instructor One'});
   await service.reviewAsInstructor(row.id!,{decision:'Declined',note:'The lab is unsuitable.'},'Bearer InstructorOne1!');
   expect((await service.records()).reservations[0]).toMatchObject({status:'Rejected',reviewNote:'The lab is unsuitable.'});
   await expect(service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key')).rejects.toThrow('instructor');
   await expect(service.create('reservations',{...booking,instructor:'Instructor One'})).resolves.toBeDefined();
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('blocks simultaneous overlapping bookings',async()=>{const results=await Promise.allSettled([service.create('reservations',booking),service.create('reservations',booking)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);});
 it('lets an admin adjust equipment while enforcing stock and renewed approval',async()=>{
  process.env.HM_ADMIN_KEY='test-super-key';
  try{
   await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});
   const item=await service.createInventory({name:'Test plates',category:'Service',quantity:'2',unit:'pcs',status:'Available',notes:''});
   const row=await service.createForUser('reservations',{...booking,inventoryItems:[{id:item.id,quantity:1}]},'11111111-1111-4111-8111-111111111111');
   await expect(service.updateReservationItems(row.id!,{items:[{id:item.id,quantity:3}]})).rejects.toThrow('only 2');
   await service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer InstructorTest1!');
   await service.updateInventory(item.id,{status:'Unavailable'});
   await expect(service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key')).rejects.toThrow('unavailable');
   const changed=await service.updateReservationItems(row.id!,{items:[]});
   expect(changed).toMatchObject({status:'Awaiting instructor',equipment:'None',inventorySelection:'[]'});
   expect(changed.instructorSignature).toBeUndefined();
   await service.reviewAsInstructor(row.id!,{decision:'Approved',note:'',signature},'Bearer InstructorTest1!');
   const approved=await service.reviewReservation(row.id!,{action:'Approved',note:'',signatureConfirmed:true,adminSignature:signature},'Bearer test-super-key');
   expect(approved.adminSignature).toBe(JSON.stringify(signature));
   const replacement=await service.createInventory({name:'Replacement plates',category:'Service',quantity:'2',unit:'pcs',status:'Available',notes:''});
   const revised=await service.updateReservationItems(row.id!,{items:[{id:replacement.id,quantity:1}]});
   expect(revised.status).toBe('Awaiting instructor');
   expect(revised.adminSignature).toBeUndefined();
  }finally{delete process.env.HM_ADMIN_KEY;}
 });
 it('requires email and terms but permits omitted ID',async()=>{await expect(service.create('reservations',{...booking,email:''})).rejects.toThrow('email address');await expect(service.create('reservations',{...booking,termsAccepted:false})).rejects.toThrow('Terms and Conditions');const withoutId={...booking};delete (withoutId as Partial<typeof booking>).studentId;expect((await service.create('reservations',withoutId)).studentId).toBe('');});
 it('releases cancelled times and permits adjacent sessions',async()=>{const row=await service.create('reservations',booking);await service.create('reservations',{...booking,start:'10:00',end:'11:00'});await service.cancel(row.id!);await expect(service.create('reservations',booking)).resolves.toBeDefined();});
 it('admin CRUD preserves ownership and rejects conflicting edits',async()=>{await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});const first=await service.create('reservations',booking,'owner');const second=await service.adminCreate('reservations',{...booking,start:'10:00',end:'11:00'});await expect(service.adminUpdate('reservations',second.id!,{start:'09:30'})).rejects.toThrow('already reserved');const edited=await service.adminUpdate('reservations',first.id!,{purpose:'Updated practice',owner:'attacker',status:'Approved'});expect(edited.owner).toBe('owner');expect(edited.status).toBe('Awaiting instructor');expect(edited.purpose).toBe('Updated practice');await service.adminDelete('reservations',first.id!);expect((await service.records()).reservations).toHaveLength(1);await expect(service.adminDelete('reservations','missing')).rejects.toThrow('not found');});
 it('supports facility CRUD and prevents deleting referenced facilities',async()=>{await service.createAdminKey({name:'Instructor',key:'InstructorTest1!',role:'instructor'});const facility=await service.createFacility({name:'Practice Room',category:'Events',description:'Practice space',status:'Available',reason:''});await service.adminCreate('reservations',{...booking,facility:facility.name});await expect(service.deleteFacility(facility.id!)).rejects.toThrow('existing records');await expect(service.createFacility({name:'practice room',category:'Events',description:'Duplicate',status:'Available',reason:''})).rejects.toThrow('already exists');const empty=await service.createFacility({name:'Empty Room',category:'Events',description:'Space',status:'Available',reason:''});await service.deleteFacility(empty.id!);expect((await service.listFacilities()).some(f=>f.id===empty.id)).toBe(false);});
 it('admin report and utilization edits validate input',async()=>{const report=await service.adminCreate('reports',{...booking,date:'2020-01-01',type:'Damage',details:'Broken tray'});await expect(service.adminUpdate('reports',report.id!,{email:'invalid'})).rejects.toThrow('email');await service.adminUpdate('reports',report.id!,{details:'Broken plate'});await service.adminDelete('reports',report.id!);const visit=await service.adminCreate('utilization',{...booking,date:'2020-01-01',attendees:'10'});await expect(service.adminUpdate('utilization',visit.id!,{attendees:'0'})).rejects.toThrow('Participants');await service.adminDelete('utilization',visit.id!);expect((await service.records()).utilization).toHaveLength(0);});
 it('validates facility photos and permits removal',async()=>{const base={name:'Photo Room',category:'Events',description:'A room',status:'Available',reason:''};await expect(service.createFacility({...base,photo:'data:image/svg+xml;base64,unsafe'})).rejects.toThrow('valid JPEG');await expect(service.createFacility({...base,photo:'x'.repeat(220001)})).rejects.toThrow('valid JPEG');const row=await service.createFacility({...base,photo:''});expect((await service.updateFacility(row.id!,{description:'New description'})).photo).toBe('');});
 it('returns lightweight versioned photo URLs and image bytes',async()=>{const photo='data:image/jpeg;base64,/9j/AA==';const row=await service.createFacility({name:'Cached Photo Room',category:'Events',description:'Room',status:'Available',reason:'',photo});const before=(await service.listFacilities()).find(f=>f.id===row.id)!;expect(before.photo).toMatch(/^\/api\/facilities\/.+\/photo\?v=/);expect(JSON.stringify(before)).not.toContain('base64');expect(await service.facilityPhoto(row.id!)).toEqual(Buffer.from('/9j/AA==','base64'));await service.updateFacility(row.id!,{photo:'data:image/jpeg;base64,/9j/AQ=='});const after=(await service.listFacilities()).find(f=>f.id===row.id)!;expect(after.photo).not.toBe(before.photo);await service.updateFacility(row.id!,{photo:''});await expect(service.facilityPhoto(row.id!)).rejects.toThrow('not found');});
});
