import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const dir=await mkdtemp(resolve('data/workflow-test-'));
process.env.HM_STORAGE='file';process.env.HM_DATA_FILE=join(dir,'records.json');process.env.HM_ADMIN_KEY='workflow-test-admin';
const {NestFactory}=await import('@nestjs/core');const {AppModule}=await import('../dist/app.module.js');const {createServer}=await import('../../frontend/node_modules/vite/dist/node/index.js');const {default:config}=await import('../../frontend/vite.config.js');
let app,vite;let checks=0;
try{
 app=await NestFactory.create(AppModule,{logger:false});await app.listen(0,'127.0.0.1');const backend=await app.getUrl();
 vite=await createServer({root:resolve('../frontend'),configFile:resolve('../frontend/vite.config.js'),logLevel:'silent',server:{host:'127.0.0.1',port:0,strictPort:true,proxy:{'/api':{...config.server.proxy['/api'],target:backend}}}});await vite.listen();
 const base=`http://127.0.0.1:${vite.httpServer.address().port}/api`,one=randomUUID(),two=randomUUID();
 const admin={Authorization:'Bearer workflow-test-admin'},user={'X-User-Session':one},other={'X-User-Session':two};
 async function call(path,method='GET',body,headers={},expected=200){const response=await fetch(base+'/'+path,{method,headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let result;try{result=JSON.parse(text)}catch{throw new Error('API returned non-JSON for '+path)}assert.equal(response.status,expected,`${method} ${path}: ${result.message||''}`);checks++;return result;}
 const facilities=await call('facilities');assert.equal(facilities.length,10);const kitchen=facilities.find(f=>f.name==='Hot Kitchen');
 const booking={facility:kitchen.name,name:'Workflow Student',email:'workflow@example.com',date:'2099-10-10',start:'09:00',end:'10:00',subject:'Practical',instructor:'Workflow Instructor',purpose:'End-to-end test',equipment:'None',termsAccepted:true};
 await call('admin/records','GET',undefined,{},401);await call('records','GET',undefined,{},401);
 await call('reservations','POST',{...booking,email:''},user,400);await call('reservations','POST',{...booking,termsAccepted:false},user,400);
 const request=await call('reservations','POST',booking,user,201);assert.equal(request.studentId,'');assert.equal(request.status,'Awaiting signature');
 assert.equal((await call('records','GET',undefined,other)).reservations.length,0);
 await call('reservations','POST',booking,other,409);await call('reservations/'+request.id,'DELETE',undefined,other,403);
 const pending=(await call('admin/records','GET',undefined,admin)).reservations.find(r=>r.id===request.id);assert.equal(pending.email,booking.email);assert.ok(pending.termsAcceptedAt);
 const schedule=await call('schedule');for(const field of ['email','name','owner','studentId','equipment'])assert.equal(schedule[0][field],undefined);
 const closure={status:'Unavailable',reason:'Test maintenance',description:'Test kitchen description'};
 await call('admin/facilities/'+kitchen.id,'PATCH',closure,{},401);await call('admin/facilities/'+kitchen.id,'PATCH',{...closure,reason:''},admin,400);
 await call('admin/facilities/'+kitchen.id,'PATCH',closure,admin);assert.equal((await call('facilities')).find(f=>f.id===kitchen.id).status,'Unavailable');
 await call('reservations','POST',{...booking,start:'11:00',end:'12:00'},user,409);
 await call('admin/reservations/'+request.id,'PATCH',{action:'Approved',note:'',signatureConfirmed:true},admin,409);
 await call('admin/facilities/'+kitchen.id,'PATCH',{status:'Available',reason:'',description:kitchen.description},admin);
 await call('admin/reservations/'+request.id,'PATCH',{action:'Approved',note:'',signatureConfirmed:false},admin,400);
 await call('admin/reservations/'+request.id,'PATCH',{action:'Approved',note:'Signed form checked',signatureConfirmed:true},admin);
 assert.equal((await call('records','GET',undefined,user)).reservations[0].status,'Approved');
 await call('admin/reservations/'+request.id,'PATCH',{action:'Cancelled',note:''},admin,400);
 await call('admin/reservations/'+request.id,'PATCH',{action:'Cancelled',note:'Activity rescheduled'},admin);
 assert.equal((await call('records','GET',undefined,user)).reservations[0].status,'Cancelled');assert.equal((await call('schedule')).length,0);
 const rejected=await call('reservations','POST',booking,user,201);await call('admin/reservations/'+rejected.id,'PATCH',{action:'Rejected',note:'Alternative requested'},admin);
 const released=await call('reservations','POST',booking,user,201);await call('reservations/'+released.id,'DELETE',undefined,user);
 const report=await call('reports','POST',{facility:kitchen.name,name:'Workflow Student',email:'workflow@example.com',studentId:'Visitor',date:'2026-10-09',type:'Damage',details:'Test damaged item'},user,201);
 await call('admin/reports/'+report.id,'PATCH',{note:'Test replacement arranged'},admin);assert.equal((await call('records','GET',undefined,user)).reports[0].status,'Resolved');
 await call('utilization','POST',{...booking,studentId:'Visitor',date:'2026-10-08',attendees:'20'},user,201);
 assert.equal((await call('records','GET',undefined,user)).utilization.length,1);
 const attempts=await Promise.all([fetch(base+'/reservations',{method:'POST',headers:{'Content-Type':'application/json',...user},body:JSON.stringify({...booking,date:'2099-10-11'})}),fetch(base+'/reservations',{method:'POST',headers:{'Content-Type':'application/json',...other},body:JSON.stringify({...booking,date:'2099-10-11'})})]);assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);for(const res of attempts)await res.text();checks+=2;
 const backendPort=Number(new URL(backend).port);await app.close();app=await NestFactory.create(AppModule,{logger:false});await app.listen(backendPort,'127.0.0.1');
 const afterRestart=await call('admin/records','GET',undefined,admin);assert.equal(afterRestart.reports[0].resolution,'Test replacement arranged');assert.equal(afterRestart.facilities.find(f=>f.id===kitchen.id).status,'Available');assert.equal(afterRestart.utilization.length,1);
 console.log(`${checks} live API checks passed through the website: guest booking, required details/terms, optional ID, access protection, shared schedules, facility closure/reopening, approvals, admin/user cancellation, rejection, reports/resolution, visit records, concurrent conflicts, and restart persistence. Existing records were untouched.`);
}catch(error){console.error(error instanceof assert.AssertionError?error.message:'Workflow verification failed; no credentials or record data were printed.');process.exitCode=1;}
finally{await vite?.close();await app?.close();await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
