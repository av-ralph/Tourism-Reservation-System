import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppService} from './app.service.js';
describe('reservations',()=>{
 let dir:string,service:AppService;
 const booking={facility:'Hot Kitchen',name:'Test',studentId:'TEST',date:'2099-10-10',start:'09:00',end:'10:00',purpose:'Practice',subject:'Culinary',instructor:'Instructor',equipment:'None',email:'student@example.com',termsAccepted:true};
 beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'hm-test-'));process.env.HM_STORAGE='file';process.env.HM_DATA_FILE=join(dir,'records.json');service=new AppService();});
 afterEach(async()=>{delete process.env.HM_STORAGE;delete process.env.HM_DATA_FILE;await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
 it('persists records across restart',async()=>{await service.create('reservations',booking);expect((await new AppService().records()).reservations).toHaveLength(1);});
 it('blocks simultaneous overlapping bookings',async()=>{const results=await Promise.allSettled([service.create('reservations',booking),service.create('reservations',booking)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);});
 it('requires email and terms but permits omitted ID',async()=>{await expect(service.create('reservations',{...booking,email:''})).rejects.toThrow('email address');await expect(service.create('reservations',{...booking,termsAccepted:false})).rejects.toThrow('Terms and Conditions');const {studentId,...withoutId}=booking;expect((await service.create('reservations',withoutId)).studentId).toBe('');});
 it('releases cancelled times and permits adjacent sessions',async()=>{const row=await service.create('reservations',booking);await service.create('reservations',{...booking,start:'10:00',end:'11:00'});await service.cancel(row.id!);await expect(service.create('reservations',booking)).resolves.toBeDefined();});
});
