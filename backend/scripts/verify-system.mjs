import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppService} from '../dist/app.service.js';
import {AppController} from '../dist/app.controller.js';
import {RecordStore,storageMode} from '../dist/record-store.js';
const dir=await mkdtemp(resolve('data/verification-'));
const previous={storage:process.env.HM_STORAGE,file:process.env.HM_DATA_FILE,key:process.env.HM_ADMIN_KEY,url:process.env.DATABASE_URL};
process.env.HM_STORAGE='file';process.env.HM_DATA_FILE=join(dir,'records.json');process.env.HM_ADMIN_KEY='local-test-key';
try{
 const service=new AppService(),api=new AppController(service),one=randomUUID(),two=randomUUID();
 const booking={facility:'Hot Kitchen',name:'Test Student',date:'2099-10-10',start:'09:00',end:'10:00',purpose:'Practice',subject:'Culinary',instructor:'Instructor',equipment:'None',email:'student@example.com',termsAccepted:true};
 await assert.rejects(api.records(),/session/);assert.throws(()=>api.adminRecords(),/access key/);
 await assert.rejects(api.reserve({...booking,email:'invalid'},one),/email address/);
 await assert.rejects(api.reserve({...booking,termsAccepted:false},one),/Terms and Conditions/);
 await assert.rejects(api.reserve({...booking,date:'2000-01-01'},one),/two days/);
 const results=await Promise.allSettled([api.reserve(booking,one),api.reserve(booking,two)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const row=results[0].value;assert.equal(row.studentId,'');assert.ok(row.termsAcceptedAt);
 assert.equal((await api.records(one)).reservations.length,1);assert.equal((await api.records(two)).reservations.length,0);
 await assert.rejects(api.cancel(row.id,two),/only cancel your own/);
 const publicRow=(await api.schedule())[0];for(const field of ['email','studentId','owner','name'])assert.equal(publicRow[field],undefined);
 await assert.rejects(api.review(row.id,{action:'Approved',note:'',signatureConfirmed:false},'Bearer local-test-key'),/signature/);
 await api.review(row.id,{action:'Approved',note:'Signature checked',signatureConfirmed:true},'Bearer local-test-key');
 assert.equal((await new AppService().userRecords(one)).reservations[0].status,'Approved');
 const adjacent=await api.reserve({...booking,start:'10:00',end:'11:00'},two);
 await api.review(adjacent.id,{action:'Rejected',note:'Change requested'},'Bearer local-test-key');await api.reserve({...booking,start:'10:00',end:'11:00'},one);
 const report=await api.report({facility:'Hot Kitchen',name:'Test',email:'test@example.com',studentId:'TEST',date:'2026-10-09',type:'Damage',details:'Test item'},one);
 await api.resolve(report.id,{note:'Replacement arranged'},'Bearer local-test-key');assert.equal((await api.records(one)).reports[0].status,'Resolved');
 await api.utilization({...booking,date:'2026-10-08',studentId:'TEST',attendees:'20'},one);assert.equal((await api.records(one)).utilization.length,1);
 await api.cancel(row.id,one);assert.equal((await api.records(one)).reservations[0].status,'Cancelled');
 assert.equal(new RecordStore().mode,'file');process.env.HM_STORAGE='tidb';process.env.DATABASE_URL='mysql://user:example@db.example:4000/hm';assert.throws(storageMode,/sslaccept=strict/);process.env.DATABASE_URL+='?sslaccept=strict';assert.equal(storageMode(),'tidb');
 console.log('System checks passed: contact/terms validation, optional ID, simultaneous conflict prevention, ownership, approval/rejection, cancellation, report resolution, utilization, restart persistence, and strict TLS configuration. Live TiDB connectivity is a separate check.');
}finally{
 for(const [envName,value] of [['HM_STORAGE',previous.storage],['HM_DATA_FILE',previous.file],['HM_ADMIN_KEY',previous.key],['DATABASE_URL',previous.url]]){if(value===undefined)delete process.env[envName];else process.env[envName]=value;}
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
