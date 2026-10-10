import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { RecordStore } from './record-store.js';
import type { Row, Store } from './record-store.js';
import { facilityCatalog } from './facility-catalog.js';

@Injectable()
export class AppService {
 private file=resolve(process.env.HM_DATA_FILE||'data/records.json');
 constructor(private readonly storage:RecordStore = new RecordStore()){}
 getHello(){return 'HM Laboratory reservation service';}
 async records(){const data=await this.storage.read();return {reservations:data.reservations,reports:data.reports,utilization:data.utilization,facilities:this.facilitiesFrom(data)};}
 private facilitiesFrom(data:Store){return [...facilityCatalog.map(f=>({...f,...data.facilities.find(row=>row.id===f.id)})),...data.facilities.filter(row=>!facilityCatalog.some(f=>f.id===row.id))].filter(f=>(f as Row).deleted!=='true');}
 async listFacilities(){return this.facilitiesFrom(await this.storage.read());}
 updateFacility(id:string,input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid facility.');return this.storage.mutate(data=>{const original=this.facilitiesFrom(data).find(f=>f.id===id);if(!original)throw new NotFoundException('Facility not found.');const fields=this.validateFacility({...original,...(input&&typeof input==='object'?input:{})});if(this.facilitiesFrom(data).some(f=>f.id!==id&&f.name.toLowerCase()===fields.name!.toLowerCase()))throw new ConflictException('A facility with this name already exists.');if(fields.name!==original.name&&[...data.reservations,...data.reports,...data.utilization].some(r=>r.facility===original.name))throw new ConflictException('Facilities with existing records cannot be renamed.');const updated={...original,...fields,updatedAt:new Date().toISOString()};data.facilities=data.facilities.filter(f=>f.id!==id);data.facilities.push(updated);return updated;});}
 private adminKey(): string {
  if(process.env.HM_ADMIN_KEY) return process.env.HM_ADMIN_KEY;
  if(process.env.VERCEL)throw new ServiceUnavailableException('Administrator access has not been configured.');
  const keyFile=resolve(dirname(this.file),'admin-access-key.txt');
  if(!existsSync(keyFile)){mkdirSync(dirname(keyFile),{recursive:true});writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600});}
  return readFileSync(keyFile,'utf8').trim();
 }
 authorizeAdmin(authorization?:string){const expected=Buffer.from(this.adminKey()), actual=Buffer.from((authorization||'').replace(/^Bearer /,''));if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new UnauthorizedException('Enter a valid administrator access key.');}
 userToken(token?:string){if(!token||!/^[-a-zA-Z0-9]{36}$/.test(token))throw new UnauthorizedException('User session is missing.');return token;}
 async userRecords(token?:string){const owner=this.userToken(token),data=await this.storage.read();return {reservations:data.reservations.filter(r=>r.owner===owner),reports:data.reports.filter(r=>r.owner===owner),utilization:data.utilization.filter(r=>r.owner===owner)};}
 async schedule(){const data=await this.storage.read();return data.reservations.filter(r=>!['Cancelled','Rejected'].includes(r.status!)).map(({id,facility,date,start,end,status})=>({id,facility,date,start,end,status}));}
 createForUser(kind:'reservations'|'reports'|'utilization',input:unknown,token?:string){const owner=this.userToken(token);return this.create(kind,input,owner);}
 cancelForUser(id:string,token?:string){const owner=this.userToken(token);return this.storage.mutate(data=>{const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');if(r.owner!==owner)throw new ForbiddenException('You can only cancel your own reservations.');if(['Rejected','Cancelled'].includes(r.status!))throw new BadRequestException('This request is already closed.');r.status='Cancelled';return {success:true};});}

 reviewReservation(id:string,input:unknown){return this.storage.mutate(data=>{
  if(!input||typeof input!=='object')throw new BadRequestException('Invalid review.');
  const {action,note,signatureConfirmed}=input as Record<string,unknown>;
  const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');
  if(!['Awaiting signature','Approved','Reserved'].includes(r.status!)||(action!=='Cancelled'&&r.status!=='Awaiting signature'))throw new BadRequestException('Only pending requests can be reviewed.');
  if(!['Approved','Rejected','Cancelled'].includes(String(action)))throw new BadRequestException('Invalid decision.');
  if(typeof note!=='string'||note.length>1000||(['Rejected','Cancelled'].includes(String(action))&&!note.trim()))throw new BadRequestException('Provide a rejection reason or a valid review note.');
  if(action==='Approved'&&this.facilitiesFrom(data).find(f=>f.name===r.facility)?.status==='Unavailable')throw new ConflictException('This facility is currently unavailable.');
  if(action==='Approved'&&signatureConfirmed!==true)throw new BadRequestException('Confirm the instructor signature before approval.');
  const updated={...r,status:String(action),reviewNote:note.trim(),reviewedAt:new Date().toISOString()};
  data.reservations=data.reservations.map(x=>x.id===id?updated:x);return updated;
 });}
 resolveReport(id:string,input:unknown){return this.storage.mutate(data=>{const r=data.reports.find(r=>r.id===id);if(!r)throw new NotFoundException('Report not found.');const note=(input as {note?:unknown})?.note;if(typeof note!=='string'||!note.trim()||note.length>1000)throw new BadRequestException('Enter resolution details.');if(r.status==='Resolved')throw new BadRequestException('Report is already resolved.');const updated={...r,status:'Resolved',resolution:note.trim(),resolvedAt:new Date().toISOString()};data.reports=data.reports.map(x=>x.id===id?updated:x);return updated;});}

 private validateRecord(kind:'reservations'|'reports'|'utilization',input:unknown,data:Store,excludeId?:string):Row{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid request.');
  const raw=input as Record<string,unknown>,r:Row={};
  const closedEdit=excludeId&&data.reservations.some(x=>x.id===excludeId&&['Cancelled','Rejected'].includes(x.status!));
  const keys=['facility','name','date',...(kind==='reports'?['type','details']:['start','end','purpose']),...(kind==='utilization'?['attendees']:[]),...(kind==='reservations'?['subject','instructor','equipment']:[])];
  for(const k of keys){const v=raw[k];if(typeof v!=='string'||!v.trim()||v.length>(['details','equipment'].includes(k)?2000:k==='purpose'?1000:100))throw new BadRequestException('Please provide a valid '+k+'.');r[k]=v.trim();}
  {
   if(raw.studentId!==undefined&&(typeof raw.studentId!=='string'||raw.studentId.length>40))throw new BadRequestException('ID number must be 40 characters or fewer.');
   r.studentId=typeof raw.studentId==='string'?raw.studentId.trim():'';
   if(typeof raw.email!=='string'||raw.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email.trim()))throw new BadRequestException('Please enter a valid email address.');
   r.email=raw.email.trim();
   if(kind==='reservations'){if(raw.termsAccepted!==true)throw new BadRequestException('Please agree to the Terms and Conditions before booking.');r.termsAccepted='true';r.termsAcceptedAt=new Date().toISOString();r.termsVersion='hm-laboratory-2026-10-09';}
  }
  if(!this.facilitiesFrom(data).some(f=>f.name===r.facility))throw new BadRequestException('Select a listed facility.');
  if(kind==='reservations'&&!closedEdit&&this.facilitiesFrom(data).find(f=>f.name===r.facility)?.status==='Unavailable')throw new ConflictException('This facility is currently unavailable. Please choose another space.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date!)||!Number.isFinite(Date.parse(r.date!))||new Date(r.date!).toISOString().slice(0,10)!==r.date)throw new BadRequestException('Invalid date.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
  const earliest = new Date(today+'T00:00:00Z'); earliest.setUTCDate(earliest.getUTCDate()+2);
  if(kind==='reservations'&&r.date!<earliest.toISOString().slice(0,10)&&(!excludeId||data.reservations.find(x=>x.id===excludeId)?.date!==r.date))throw new BadRequestException('Reservations must be made at least two days before the laboratory activity.');
  if(kind==='reports'&&r.date!>today)throw new BadRequestException('Incident date cannot be in the future.');
  if(kind==='utilization'&&r.date!>today)throw new BadRequestException('Utilization must describe a completed session.');
  if(kind!=='reports'){
   if(![r.start,r.end].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t!))||r.end!<=r.start!)throw new BadRequestException('End time must be after start time.');
   if(kind==='reservations'){
    const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    if(r.date===today&&r.start!<=now)throw new BadRequestException('Choose a future start time.');
    if(!closedEdit&&data.reservations.some(x=>x.id!==excludeId&&!['Cancelled','Rejected'].includes(x.status!)&&x.facility===r.facility&&x.date===r.date&&x.start!<r.end!&&x.end!>r.start!))throw new ConflictException('This facility is already reserved during that time. Choose another time.');
   }
  }
  if(kind==='reports'&&!['Damage','Loss'].includes(r.type!))throw new BadRequestException('Invalid report type.');
  if(kind==='utilization'&&(!/^\d+$/.test(r.attendees!)||Number(r.attendees)<1||Number(r.attendees)>500))throw new BadRequestException('Participants must be between 1 and 500.');
  return r;
 }
 create(kind:'reservations'|'reports'|'utilization',input:unknown,owner?:string){return this.storage.mutate(data=>{
  const r=this.validateRecord(kind,input,data);
  r.id=randomUUID();r.createdAt=new Date().toISOString();if(owner)r.owner=owner;if(kind==='reservations')r.status='Awaiting signature';if(kind==='reports')r.status='Open';data[kind].push(r);return r;
 });}
 private recordKind(kind:string):'reservations'|'reports'|'utilization'{if(!['reservations','reports','utilization'].includes(kind))throw new BadRequestException('Invalid record type.');return kind as 'reservations'|'reports'|'utilization';}
 adminCreate(kind:string,input:unknown){return this.create(this.recordKind(kind),input);}
 adminUpdate(kind:string,id:string,input:unknown){const type=this.recordKind(kind);return this.storage.mutate(data=>{const old=data[type].find(r=>r.id===id);if(!old)throw new NotFoundException('Record not found.');if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid record.');const r=this.validateRecord(type,{...old,...input as object,termsAccepted:old.termsAccepted==='true'},data,id);const updated:Row={...old,...r,updatedAt:new Date().toISOString()};if(type==='reservations'){updated.termsAcceptedAt=old.termsAcceptedAt!;updated.termsVersion=old.termsVersion!;}data[type]=data[type].map(row=>row.id===id?updated:row);return updated;});}
 adminDelete(kind:string,id:string){const type=this.recordKind(kind);return this.storage.mutate(data=>{if(!data[type].some(r=>r.id===id))throw new NotFoundException('Record not found.');data[type]=data[type].filter(r=>r.id!==id);return {success:true};});}
 createFacility(input:unknown){return this.storage.mutate(data=>{const fields=this.validateFacility(input);if(this.facilitiesFrom(data).some(f=>f.name.toLowerCase()===fields.name!.toLowerCase()))throw new ConflictException('A facility with this name already exists.');const row={...fields,id:randomUUID(),createdAt:new Date().toISOString()};data.facilities.push(row);return row;});}
 private validateFacility(input:unknown):Row{if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid facility.');const raw=input as Record<string,unknown>,row:Row={};for(const [key,max] of [['name',100],['category',100],['description',1000]] as const){if(typeof raw[key]!=='string'||!raw[key].trim()||raw[key].length>max)throw new BadRequestException('Provide a valid facility '+key+'.');row[key]=raw[key].trim();}if(!['Available','Unavailable'].includes(String(raw.status)))throw new BadRequestException('Choose a valid availability status.');row.status=String(raw.status);if(typeof raw.reason!=='string'||raw.reason.length>500||(row.status==='Unavailable'&&!raw.reason.trim()))throw new BadRequestException('Provide a reason when unavailable.');row.reason=raw.reason.trim();if(raw.photo!==undefined){if(typeof raw.photo!=='string'||raw.photo.length>220000||(raw.photo!==''&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(raw.photo)))throw new BadRequestException('Provide a valid JPEG facility photo under 165 KB.');row.photo=raw.photo;}return row;}
 deleteFacility(id:string){return this.storage.mutate(data=>{const facility=this.facilitiesFrom(data).find(f=>f.id===id);if(!facility)throw new NotFoundException('Facility not found.');if([...data.reservations,...data.reports,...data.utilization].some(r=>r.facility===facility.name))throw new ConflictException('This facility has existing records. Mark it unavailable instead.');data.facilities=data.facilities.filter(f=>f.id!==id);if(facilityCatalog.some(f=>f.id===id))data.facilities.push({...facility,deleted:'true'});return {success:true};});}
 cancel(id:string){return this.storage.mutate(data=>{const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');r.status='Cancelled';return {success:true};});}
}
