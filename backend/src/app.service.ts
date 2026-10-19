import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID, randomBytes, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { RecordStore } from './record-store.js';
import type { Row, Store } from './record-store.js';
import { facilityCatalog } from './facility-catalog.js';
import { inventoryCatalog } from './inventory-catalog.js';

@Injectable()
export class AppService {
 private file=resolve(process.env.HM_DATA_FILE||'data/records.json');
 constructor(private readonly storage:RecordStore = new RecordStore()){}
 getHello(){return 'HM Laboratory reservation service';}
 private reservationStatus(row:Row){return row.status==='Awaiting signature'?(row.instructorDecision==='Approved'?'Awaiting admin':row.instructorDecision==='Declined'?'Rejected':'Awaiting instructor'):row.status;}
 private publicReservation(row:Row):Row{const result:Row={...row,status:this.reservationStatus(row)!};delete result.owner;delete result.recoveryHash;delete result.owners;return result;}
 private ownsReservation(row:Row,owner:string){if(row.owner===owner)return true;try{return (JSON.parse(row.owners||'[]') as unknown[]).includes(owner)}catch{return false}}
 async records(data?:Store){data??=await this.storage.read();return {reservations:data.reservations.map(row=>this.publicReservation(row)),reports:data.reports,utilization:data.utilization,facilities:this.facilitiesFrom(data)};}
 async adminRecords(authorization?:string){const data=await this.storage.read();const identity=await this.adminIdentity(authorization,data);if(identity.role==='instructor')throw new ForbiddenException('Instructor keys cannot access administrator actions.');return {...await this.records(data),...identity};}
 async publicContact(){
  const data=await this.storage.read();
  const contactName='cristian jay m. pechon';
  const matches=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-PH')===contactName;
  const admins=data.adminKeys.filter(key=>key.role!=='instructor').map(key=>({key,profile:data.adminProfiles.find(row=>row.id===this.staffProfileId(key.hash)||row.id==='profile-'+key.hash)})).filter(entry=>entry.profile?.photo);
  const contact=admins.find(entry=>matches(entry.key.name||'')||matches(entry.profile?.name||''));
  return {photo:contact?.profile?.photo||(admins.length===1?admins[0].profile?.photo:'')||''};
 }
 async adminInventory(){return this.inventoryFrom(await this.storage.read());}
 private inventoryFrom(data:Store){return [...inventoryCatalog.map(item=>({...item,...data.inventory.find(row=>row.id===item.id)})),...data.inventory.filter(row=>!inventoryCatalog.some(item=>item.id===row.id))].filter(item=>item.deleted!=='true');}
 async listInventory(){return this.inventoryFrom(await this.storage.read()).filter(item=>item.status==='Available'&&Number(item.quantity)>0).map(({id,name,category,model,quantity,unit})=>({id,name,category,model,quantity,unit:unit==='not recorded'?'item':unit}));}
 private validateInventory(input:unknown):Row{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid inventory item.');
  const raw=input as Record<string,unknown>, row:Row={};
  for(const [key,max] of [['name',120],['category',100],['unit',30]] as const){if(typeof raw[key]!=='string'||!raw[key].trim()||raw[key].length>max)throw new BadRequestException('Enter a valid '+key+'.');row[key]=raw[key].trim();}
  for(const [key,max] of [['model',120],['serial',120],['notes',500]] as const){if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>max))throw new BadRequestException('Invalid '+key+'.');row[key]=typeof raw[key]==='string'?raw[key].trim():'';}
  if(!/^(0|[1-9]\d{0,4})$/.test(String(raw.quantity)))throw new BadRequestException('Quantity must be a whole number from 0 to 99999.');
  row.quantity=String(raw.quantity);
  if(!['Draft','Available','Unavailable'].includes(String(raw.status)))throw new BadRequestException('Choose Draft, Available, or Unavailable.');
  if(raw.status==='Available'&&Number(row.quantity)===0)throw new BadRequestException('Available items need a quantity above zero.');
  if(raw.status==='Available'&&row.unit==='not recorded'&&!(typeof raw.id==='string'&&inventoryCatalog.some(item=>item.id===raw.id&&Number(item.reportActualQuantity)>0)))throw new BadRequestException('Set a verified unit before making this item available.');
  row.status=String(raw.status);return row;
 }
 createInventory(input:unknown){return this.storage.mutate(data=>{const row={...this.validateInventory(input),id:randomUUID(),createdAt:new Date().toISOString()};data.inventory.push(row);return row;});}
 updateInventory(id:string,input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid inventory item.');return this.storage.mutate(data=>{const old=this.inventoryFrom(data).find(row=>row.id===id);if(!old)throw new NotFoundException('Inventory item not found.');const row={...old,...this.validateInventory({...old,...input}),updatedAt:new Date().toISOString()};data.inventory=data.inventory.filter(item=>item.id!==id);data.inventory.push(row);return row;});}
 deleteInventory(id:string){return this.storage.mutate(data=>{const old=this.inventoryFrom(data).find(row=>row.id===id);if(!old)throw new NotFoundException('Inventory item not found.');if(data.reservations.some(r=>r.inventorySelection?.includes('"'+id+'"')))throw new ConflictException('This item is used in a reservation. Mark it unavailable instead.');data.inventory=data.inventory.filter(row=>row.id!==id);if(inventoryCatalog.some(row=>row.id===id))data.inventory.push({...old,deleted:'true'});return {success:true};});}
 private facilitiesFrom(data:Store){return [...facilityCatalog.map(f=>({...f,...data.facilities.find(row=>row.id===f.id)})),...data.facilities.filter(row=>!facilityCatalog.some(f=>f.id===row.id))].filter(f=>(f as Row).deleted!=='true');}
 async listFacilities(){return this.facilitiesFrom(await this.storage.read()).map(f=>{const row=f as Row;const {photo,...details}=row;return {...details,photo:photo?`/api/facilities/${encodeURIComponent(row.id!)}/photo?v=${createHash('sha256').update(photo).digest('hex').slice(0,16)}`:''};});}
 async listInstructors(){return (await this.storage.read()).adminKeys.filter(row=>row.role==='instructor').map(row=>({id:row.id,name:row.name})).sort((a,b)=>a.name!.localeCompare(b.name!));}
 async facilityPhoto(id:string){const facility=this.facilitiesFrom(await this.storage.read()).find(f=>f.id===id) as Row|undefined;if(!facility?.photo)throw new NotFoundException('Facility photo not found.');return Buffer.from(facility.photo.split(',')[1]!,'base64');}
 async collegeOrganization(){const row=(await this.storage.read()).organization.find(item=>item.id==='college-organization');return {groups:row?JSON.parse(row.content!):null};}
 async saveCollegeOrganization(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid college organization.');
  const groups=(input as Record<string,unknown>).groups;
  if(!Array.isArray(groups)||groups.length<1||groups.length>20)throw new BadRequestException('Add between 1 and 20 organization groups.');
  let people=0;
  const titles=new Set<string>();
  const cleaned=groups.map(group=>{
   if(!group||typeof group!=='object'||Array.isArray(group))throw new BadRequestException('Invalid organization group.');
   const raw=group as Record<string,unknown>,title=raw.title;
   if(typeof title!=='string'||!title.trim()||title.trim().length>120)throw new BadRequestException('Enter a group name of up to 120 characters.');
   if(titles.has(title.trim().toLowerCase()))throw new BadRequestException('Organization group names must be unique.');
   titles.add(title.trim().toLowerCase());
   const mayBeEmpty=['The Founders','Faculty and Staff'].includes(title.trim());
   if(!Array.isArray(raw.items)||(!mayBeEmpty&&raw.items.length<1)||raw.items.length>30)throw new BadRequestException('Each group needs between 1 and 30 people, except The Founders and Faculty and Staff.');
   people+=raw.items.length;
   const items=raw.items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new BadRequestException('Invalid organization person.');
    const person=item as Record<string,unknown>,name=person.name,photo=person.photo;
    if(typeof name!=='string'||!name.trim()||name.trim().length>160)throw new BadRequestException('Enter each person’s name and role, up to 160 characters.');
    if(typeof photo!=='string'||photo.length>30000||(photo!==''&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo)))throw new BadRequestException('Choose a valid JPEG portrait under 22 KB.');
    return {name:name.trim(),photo};
   });
   return {title:title.trim(),items};
  });
  if(people>150||JSON.stringify(cleaned).length>850000)throw new BadRequestException('The organization list is too large.');
  await this.storage.mutate(data=>{const old=data.organization.find(row=>row.id==='college-organization');data.organization=[{id:'college-organization',content:JSON.stringify(cleaned),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}];});
  return {groups:cleaned};
 }

 updateFacility(id:string,input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid facility.');return this.storage.mutate(data=>{const original=this.facilitiesFrom(data).find(f=>f.id===id);if(!original)throw new NotFoundException('Facility not found.');const fields=this.validateFacility({...original,...(input&&typeof input==='object'?input:{})});if(this.facilitiesFrom(data).some(f=>f.id!==id&&f.name.toLowerCase()===fields.name!.toLowerCase()))throw new ConflictException('A facility with this name already exists.');if(fields.name!==original.name&&[...data.reservations,...data.reports,...data.utilization].some(r=>r.facility===original.name))throw new ConflictException('Facilities with existing records cannot be renamed.');const updated={...original,...fields,updatedAt:new Date().toISOString()};data.facilities=data.facilities.filter(f=>f.id!==id);data.facilities.push(updated);return updated;});}
 private adminKey(): string {
  if(process.env.HM_ADMIN_KEY) return process.env.HM_ADMIN_KEY;
  if(process.env.VERCEL)throw new ServiceUnavailableException('Administrator access has not been configured.');
  const keyFile=resolve(dirname(this.file),'admin-access-key.txt');
  if(!existsSync(keyFile)){mkdirSync(dirname(keyFile),{recursive:true});writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600});}
  return readFileSync(keyFile,'utf8').trim();
 }
 private keyHash(key:string){return createHash('sha256').update(key).digest('hex');}
 private validateStaffPassword(key:unknown){
  if(typeof key!=='string'||key.length<10||key.length>32||!/^[A-Za-z0-9!@#$%^&*_-]+$/.test(key)||!/[a-z]/.test(key)||!/[A-Z]/.test(key)||!/[0-9]/.test(key)||!/[!@#$%^&*_-]/.test(key))throw new BadRequestException('Use 10–32 characters with an uppercase letter, a lowercase letter, a number, and a symbol (! @ # $ % ^ & * _ -).');
  return key;
 }
 async authorizeStaff(authorization?:string,data?:Store){
  const value=(authorization||'').replace(/^Bearer /,''),expected=Buffer.from(this.adminKey()),actual=Buffer.from(value);
  if(actual.length===expected.length&&timingSafeEqual(actual,expected))return 'superadmin';
  if(!value||value.length>256)throw new UnauthorizedException('Enter a valid administrator access key.');
  const hash=this.keyHash(value),records=data??await this.storage.read();
  const staff=records.adminKeys.find(row=>row.hash===hash);
  if(staff)return staff.role==='instructor'?'instructor':'admin';
  throw new UnauthorizedException('Enter a valid administrator access key.');
 }
 async authorizeAdmin(authorization?:string){const role=await this.authorizeStaff(authorization);if(role==='instructor')throw new ForbiddenException('Instructor keys cannot access administrator actions.');return role;}
 async authorizeInstructor(authorization?:string){const role=await this.authorizeStaff(authorization);if(role!=='instructor')throw new ForbiddenException('Enter an instructor access key.');return role;}
 // hm_records.id is VARCHAR(36); a full SHA-256 hex digest would exceed it.
 private staffProfileId(hash:string){return 'profile-'+hash.slice(0,28);}
 private profileId(role:string,authorization?:string){return role==='superadmin'?'super-admin-profile':this.staffProfileId(this.keyHash((authorization||'').replace(/^Bearer /,'')));}
 async adminIdentity(authorization?:string,data?:Store){
  data??=await this.storage.read();
  const role=await this.authorizeStaff(authorization,data),hash=this.keyHash((authorization||'').replace(/^Bearer /,''));
  const profile=data.adminProfiles.find(row=>row.id===this.profileId(role,authorization)||row.id==='profile-'+hash);
  const admin=data.adminKeys.find(row=>row.hash===hash);
  if(role!=='superadmin'&&!admin)throw new UnauthorizedException('Enter a valid administrator access key.');
  return {role,adminName:profile?.name||(role==='superadmin'?'Super admin':admin!.name),adminPhoto:profile?.photo||'',adminEmail:profile?.email||''};
 }
 async updateAdminProfile(authorization:string|undefined,input:unknown){
  const role=await this.authorizeStaff(authorization);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid profile.');
  const {name,email,photo}=input as Record<string,unknown>;
  if(typeof name!=='string'||!name.trim()||name.length>80)throw new BadRequestException('Enter a name of up to 80 characters.');
  if(typeof email!=='string'||email.length>254||(email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new BadRequestException('Enter a valid email address or leave it blank.');
  if(typeof photo!=='string'||photo.length>220000||(photo!==''&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo)))throw new BadRequestException('Choose a valid JPEG profile photo under 165 KB.');
  const id=this.profileId(role,authorization);
  await this.storage.mutate(data=>{if(role!=='superadmin'&&!data.adminKeys.some(row=>this.staffProfileId(row.hash)===id))throw new UnauthorizedException('Admin access has been revoked.');const hash=this.keyHash((authorization||'').replace(/^Bearer /,''));data.adminProfiles=data.adminProfiles.filter(row=>row.id!==id&&row.id!=='profile-'+hash);data.adminProfiles.push({id,name:name.trim(),email:email.trim(),photo,updatedAt:new Date().toISOString()});});
  return {role,adminName:name.trim(),adminPhoto:photo,adminEmail:email.trim()};
 }
 async changeStaffKey(authorization:string|undefined,input:unknown){
  const role=await this.authorizeStaff(authorization);
  if(role==='superadmin')throw new ForbiddenException('The super administrator key is managed in server settings.');
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Enter your current and new access keys.');
  const {currentKey,newKey}=input as Record<string,unknown>;
  if(typeof currentKey!=='string'||typeof newKey!=='string')throw new BadRequestException('Enter your current and new access keys.');
  const value=(authorization||'').replace(/^Bearer /,'');
  if(currentKey!==value)throw new UnauthorizedException('Your current access key is incorrect.');
  this.validateStaffPassword(newKey);
  if(newKey===currentKey)throw new BadRequestException('Choose a different access key.');
  const oldHash=this.keyHash(currentKey),newHash=this.keyHash(newKey);
  if(newHash===this.keyHash(this.adminKey()))throw new ConflictException('This access key is already in use.');
  await this.storage.mutate(data=>{
   const row=data.adminKeys.find(entry=>entry.hash===oldHash&&entry.role===role);
   if(!row)throw new UnauthorizedException('Your access key is no longer valid.');
   if(data.adminKeys.some(entry=>entry.hash===newHash))throw new ConflictException('This access key is already in use.');
   const profile=data.adminProfiles.find(entry=>entry.id===this.staffProfileId(oldHash)||entry.id==='profile-'+oldHash);
   if(profile)profile.id=this.staffProfileId(newHash);
   row.hash=newHash;
   row.encryptedKey=this.encryptAdminKey(newKey);
   row.updatedAt=new Date().toISOString();
  });
  return {success:true};
 }
 async authorizeSuperAdmin(authorization?:string){if(await this.authorizeAdmin(authorization)!=='superadmin')throw new ForbiddenException('Only the super admin can manage access keys.');}
 private encryptAdminKey(key:string){
  const iv=randomBytes(12),secret=createHash('sha256').update(this.adminKey()).digest(),cipher=createCipheriv('aes-256-gcm',secret,iv);
  const encrypted=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(value=>value.toString('base64')).join('.');
 }
 private decryptAdminKey(value?:string){
  if(!value)return null;
  try{const [iv,tag,encrypted]=value.split('.').map(part=>Buffer.from(part,'base64')),secret=createHash('sha256').update(this.adminKey()).digest(),decipher=createDecipheriv('aes-256-gcm',secret,iv!);decipher.setAuthTag(tag!);return Buffer.concat([decipher.update(encrypted!),decipher.final()]).toString('utf8');}catch{return null;}
 }
 async listAdminKeys(){return (await this.storage.read()).adminKeys.map(({id,name,role,createdAt,encryptedKey})=>({id,name,role:role||'admin',createdAt,key:this.decryptAdminKey(encryptedKey)}));}
 async listStaffKeys(authorization?:string){const role=await this.authorizeAdmin(authorization);const keys=await this.listAdminKeys();return role==='superadmin'?keys:keys.filter(row=>row.role==='instructor');}
 async createStaffKey(input:unknown,authorization?:string){const role=await this.authorizeAdmin(authorization);if(role!=='superadmin'&&(!input||typeof input!=='object'||Array.isArray(input)||(input as Record<string,unknown>).role!=='instructor'))throw new ForbiddenException('Administrators can create instructor keys only.');return this.createAdminKey(input);}
 async revokeStaffKey(id:string,authorization?:string){const role=await this.authorizeAdmin(authorization);return this.revokeAdminKey(id,role);}
 async instructorRecords(authorization?:string){const data=await this.storage.read(),identity=await this.adminIdentity(authorization,data);if(identity.role!=='instructor')throw new ForbiddenException('Enter an instructor access key.');const hash=this.keyHash((authorization||'').replace(/^Bearer /,'')),instructor=data.adminKeys.find(row=>row.hash===hash);return {...identity,reservations:data.reservations.filter(row=>!row.instructorKeyId||row.instructorKeyId===instructor?.id).map(row=>{const reservation=this.publicReservation(row);delete reservation.owner;return reservation;}),facilities:this.facilitiesFrom(data).map(facility=>{const details={...facility} as Row;delete details.photo;return details;})};}
 private validateSignature(value:unknown){
  if(!Array.isArray(value)||value.length<1||value.length>80)throw new BadRequestException('Draw your signature before approving the request.');
  let count=0,length=0,minX=600,maxX=0,minY=180,maxY=0;
  for(const stroke of value){
   if(!Array.isArray(stroke)||stroke.length<2||stroke.length>700)throw new BadRequestException('Draw a complete signature before approving.');
   count+=stroke.length;
   if(count>8000)throw new BadRequestException('The signature is too detailed. Clear it and try again.');
   for(let index=0;index<stroke.length;index++){
    const point=stroke[index];
    if(!Array.isArray(point)||point.length!==2||!point.every((coordinate:unknown)=>typeof coordinate==='number'&&Number.isInteger(coordinate))||point[0]<0||point[0]>600||point[1]<0||point[1]>180)throw new BadRequestException('Signature points are invalid. Clear it and try again.');
    minX=Math.min(minX,point[0]);maxX=Math.max(maxX,point[0]);minY=Math.min(minY,point[1]);maxY=Math.max(maxY,point[1]);
    if(index)length+=Math.hypot(point[0]-stroke[index-1][0],point[1]-stroke[index-1][1]);
   }
  }
  if(count<8||maxX-minX<25||maxY-minY<8||length<75)throw new BadRequestException('Draw a fuller signature before approving the request.');
  return JSON.stringify(value);
 }
 async reviewAsInstructor(id:string,input:unknown,authorization?:string){
  const identity=await this.adminIdentity(authorization);
  if(identity.role!=='instructor')throw new ForbiddenException('Enter an instructor access key.');
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid instructor review.');
  const {decision,note,signature}=input as Record<string,unknown>;
  if(!['Approved','Declined'].includes(String(decision)))throw new BadRequestException('Choose approve or decline.');
  if(typeof note!=='string'||note.length>1000||(decision==='Declined'&&!note.trim()))throw new BadRequestException('Explain why the request was declined.');
  const validatedSignature=decision==='Approved'?this.validateSignature(signature):'';
  return this.storage.mutate(data=>{
   const reservation=data.reservations.find(row=>row.id===id);
   if(!reservation)throw new NotFoundException('Reservation not found.');
   const hash=this.keyHash((authorization||'').replace(/^Bearer /,'')),instructor=data.adminKeys.find(row=>row.hash===hash);
   if(reservation.instructorKeyId&&reservation.instructorKeyId!==instructor?.id)throw new ForbiddenException('This request belongs to another instructor.');
   if(this.reservationStatus(reservation)!=='Awaiting instructor')throw new ConflictException('Only requests awaiting instructor review can be reviewed.');
   reservation.instructorDecision=String(decision);reservation.instructorNote=note.trim();reservation.instructorReviewedBy=identity.adminName;reservation.instructorReviewedAt=new Date().toISOString();
   reservation.instructorSignature=validatedSignature;
   reservation.status=decision==='Approved'?'Awaiting admin':'Rejected';
   if(decision==='Declined')reservation.reviewNote=note.trim();
   return {id:reservation.id,status:reservation.status,instructorDecision:reservation.instructorDecision,instructorNote:reservation.instructorNote,instructorReviewedBy:reservation.instructorReviewedBy,instructorReviewedAt:reservation.instructorReviewedAt};
  });
 }
 createAdminKey(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid access key details.');
  const {name,key}=input as Record<string,unknown>;
  const role=(input as Record<string,unknown>).role??'admin';
  if(!['admin','instructor'].includes(String(role)))throw new BadRequestException('Choose an administrator or instructor role.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw new BadRequestException('Enter a staff name of up to 80 characters.');
  const validatedKey=this.validateStaffPassword(key);
  const hash=this.keyHash(validatedKey);
  if(hash===this.keyHash(this.adminKey()))throw new ConflictException('This access key is already in use.');
  return this.storage.mutate(data=>{
   if(data.adminKeys.some(row=>row.hash===hash||row.name!.toLowerCase()===name.trim().toLowerCase()))throw new ConflictException('This admin name or key is already in use.');
   const row={id:randomUUID(),name:name.trim(),hash,role:String(role),encryptedKey:this.encryptAdminKey(validatedKey),createdAt:new Date().toISOString()};data.adminKeys.push(row);
   return {id:row.id,name:row.name,role:row.role,createdAt:row.createdAt};
  });
 }
 revokeAdminKey(id:string,callerRole:'admin'|'superadmin'='superadmin'){return this.storage.mutate(data=>{const row=data.adminKeys.find(row=>row.id===id);if(!row)throw new NotFoundException('Staff key not found.');if(callerRole!=='superadmin'&&row.role!=='instructor')throw new ForbiddenException('Administrators can revoke instructor keys only.');data.adminProfiles=data.adminProfiles.filter(profile=>profile.id!==this.staffProfileId(row.hash)&&profile.id!=='profile-'+row.hash);data.adminKeys=data.adminKeys.filter(entry=>entry.id!==id);return {success:true};});}
 userToken(token?:string){if(!token||!/^[-a-zA-Z0-9]{36}$/.test(token))throw new UnauthorizedException('User session is missing.');return token;}
 async userRecords(token?:string){const owner=this.userToken(token),data=await this.storage.read();return {reservations:data.reservations.filter(r=>this.ownsReservation(r,owner)).map(row=>this.publicReservation(row)),reports:data.reports.filter(r=>r.owner===owner),utilization:data.utilization.filter(r=>r.owner===owner)};}
 async schedule(){const data=await this.storage.read();return data.reservations.filter(row=>!['Cancelled','Rejected'].includes(this.reservationStatus(row)!)).map(row=>({id:row.id,facility:row.facility,date:row.date,start:row.start,end:row.end,status:this.reservationStatus(row)}));}
 createForUser(kind:'reservations'|'reports'|'utilization',input:unknown,token?:string){const owner=this.userToken(token);return this.create(kind,input,owner,kind==='reservations');}
 cancelForUser(id:string,token?:string){const owner=this.userToken(token);return this.storage.mutate(data=>{const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');if(!this.ownsReservation(r,owner))throw new ForbiddenException('You can only cancel your own reservations.');if(['Rejected','Cancelled'].includes(this.reservationStatus(r)!))throw new BadRequestException('This request is already closed.');r.status='Cancelled';return {success:true};});}
 recoverReservation(input:unknown,token?:string){const owner=this.userToken(token);if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Enter a booking reference and private recovery code.');const {id,code}=input as Record<string,unknown>;if(typeof id!=='string'||typeof code!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f]{32}$/i.test(code))throw new BadRequestException('Enter a valid booking reference and recovery code.');return this.storage.mutate(data=>{const row=data.reservations.find(reservation=>reservation.id===id);const hash=createHash('sha256').update(code.toLowerCase()).digest('hex');if(!row?.recoveryHash||!timingSafeEqual(Buffer.from(row.recoveryHash,'hex'),Buffer.from(hash,'hex')))throw new NotFoundException('Booking reference or recovery code not found.');let owners:string[];try{owners=JSON.parse(row.owners||'[]')}catch{owners=[]}if(!this.ownsReservation(row,owner)){owners.push(owner);row.owners=JSON.stringify(owners)}return this.publicReservation(row)});}

 async reviewReservation(id:string,input:unknown,authorization?:string){const identity=await this.adminIdentity(authorization);return this.storage.mutate(data=>{
  if(!input||typeof input!=='object')throw new BadRequestException('Invalid review.');
  const {action,note,signatureConfirmed,adminSignature,laboratoryEntries}=input as Record<string,unknown>;
  const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');
  const stage=this.reservationStatus(r);
  if(!['Awaiting instructor','Awaiting admin','Approved','Reserved'].includes(stage!)||(action!=='Cancelled'&&stage!=='Awaiting admin'))throw new BadRequestException('Only requests endorsed by an instructor can receive a final admin decision.');
  if(!['Approved','Rejected','Cancelled'].includes(String(action)))throw new BadRequestException('Invalid decision.');
  if(typeof note!=='string'||note.length>1000||(['Rejected','Cancelled'].includes(String(action))&&!note.trim()))throw new BadRequestException('Provide a rejection reason or a valid review note.');
  if(action==='Approved'&&this.facilitiesFrom(data).find(f=>f.name===r.facility)?.status==='Unavailable')throw new ConflictException('This facility is currently unavailable.');
  if(action==='Approved'&&r.instructorDecision!=='Approved')throw new BadRequestException('An instructor must endorse this request before final approval.');
  if(action==='Approved'&&signatureConfirmed!==true)throw new BadRequestException('Confirm the instructor signature before approval.');
  if(action==='Approved'&&r.inventorySelection){
   let selected:{id:string;quantity:number}[];
   try{selected=JSON.parse(r.inventorySelection)}catch{throw new BadRequestException('The reservation equipment list is invalid. Edit it before approval.');}
   for(const pick of selected){
    const item=this.inventoryFrom(data).find(row=>row.id===pick.id&&row.status==='Available');
    if(!item)throw new ConflictException('A requested equipment item is unavailable. Edit the form before approval.');
    const reserved=data.reservations.filter(row=>row.id!==id&&!['Cancelled','Rejected'].includes(this.reservationStatus(row)!)&&row.date===r.date&&row.start!<r.end!&&row.end!>r.start!).reduce((total,row)=>{try{return total+(JSON.parse(row.inventorySelection||'[]') as {id:string;quantity:number}[]).filter(entry=>entry.id===pick.id).reduce((sum,entry)=>sum+entry.quantity,0)}catch{return total}},0);
    if(pick.quantity+reserved>Number(item.quantity))throw new ConflictException(`${item.name} has insufficient stock for this request. Edit the form before approval.`);
   }
  }
  const validatedSignature=action==='Approved'?this.validateSignature(adminSignature):'';
  const updated:Row={...r,status:String(action),reviewNote:note.trim(),reviewedAt:new Date().toISOString()};
  if(action==='Approved'){updated.adminSignature=validatedSignature;updated.adminReviewedBy=identity.adminName;updated.adminReviewedAt=updated.reviewedAt;updated.laboratoryEntries=this.validateLaboratoryEntries(laboratoryEntries,r);}
  else {delete updated.adminSignature;delete updated.adminReviewedBy;delete updated.adminReviewedAt;}
  data.reservations=data.reservations.map(x=>x.id===id?updated:x);return updated;
 });}
 private validateLaboratoryEntries(value:unknown,reservation:Row){
  let requestedQuantities:number[]=[];
  try{const selected=JSON.parse(reservation.inventorySelection||'[]');if(Array.isArray(selected)&&selected.length)requestedQuantities=selected.map(entry=>Number(entry.quantity));}catch{/* Legacy text-only equipment list. */}
  if(!requestedQuantities.length)requestedQuantities=String(reservation.equipment||'').split(/\r?\n/).filter(line=>line.trim()&&line.trim()!=='None').map(line=>Number(line.match(/^\s*(\d+)\s*\|/)?.[1]||0));
  if(value===undefined)value=requestedQuantities.map(()=>({released:'',remarks:'',returned:'',condition:''}));
  if(!Array.isArray(value)||value.length!==requestedQuantities.length||value.length>500)throw new BadRequestException('The laboratory table does not match the requested equipment. Reopen the form and try again.');
  const entries=value.map((entry:unknown,index:number)=>{
   if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new BadRequestException('Enter valid laboratory table details.');
   const row=entry as Record<string,unknown>;
   const released=String(row.released??'').trim(),remarks=String(row.remarks??'').trim(),returned=String(row.returned??'').trim(),condition=String(row.condition??'').trim();
   if(released&&!/^[1-9]\d{0,5}$/.test(released))throw new BadRequestException(`Row ${index+1}: quantity released must be a positive whole number.`);
   if(released&&requestedQuantities[index]>0&&Number(released)>requestedQuantities[index])throw new BadRequestException(`Row ${index+1}: quantity released exceeds the requested quantity.`);
   if(remarks.length>120)throw new BadRequestException(`Row ${index+1}: remarks must be 120 characters or fewer.`);
   if(returned&&(!/^\d{4}-\d{2}-\d{2}$/.test(returned)||Number.isNaN(Date.parse(returned))||new Date(returned).toISOString().slice(0,10)!==returned))throw new BadRequestException(`Row ${index+1}: enter a valid return date.`);
   if(!['','Good order','Lost','Damaged'].includes(condition))throw new BadRequestException(`Row ${index+1}: choose a valid condition.`);
   return {released,remarks,returned,condition};
  });
  return JSON.stringify(entries);
 }
 updateReservationLaboratory(id:string,input:unknown){return this.storage.mutate(data=>{
  const reservation=data.reservations.find(row=>row.id===id);if(!reservation)throw new NotFoundException('Reservation not found.');
  if(!['Awaiting admin','Approved'].includes(this.reservationStatus(reservation)!))throw new BadRequestException('Laboratory details can only be edited during or after final review.');
  reservation.laboratoryEntries=this.validateLaboratoryEntries((input as {entries?:unknown})?.entries,reservation);
  reservation.updatedAt=new Date().toISOString();return reservation;
 });}
 updateReservationItems(id:string,input:unknown){return this.storage.mutate(data=>{
  const reservation=data.reservations.find(row=>row.id===id);if(!reservation)throw new NotFoundException('Reservation not found.');
  if(['Cancelled','Rejected'].includes(this.reservationStatus(reservation)!))throw new BadRequestException('Closed reservations cannot be edited.');
  const raw=(input as {items?:unknown})?.items;if(!Array.isArray(raw))throw new BadRequestException('Choose a valid equipment list.');
  if(raw.length>this.inventoryFrom(data).length)throw new BadRequestException('Too many equipment items were selected.');
  const seen=new Set<string>(),selection:{id:string;quantity:number;name:string}[]=[];
  for(const entry of raw){
   if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new BadRequestException('Invalid equipment item.');
   const {id,quantity}=entry as {id?:unknown;quantity?:unknown};
   if(typeof id!=='string'||typeof quantity!=='number'||!Number.isSafeInteger(quantity)||quantity<1||seen.has(id))throw new BadRequestException('Choose each equipment item once with a positive whole-number quantity.');
   const item=this.inventoryFrom(data).find(row=>row.id===id&&row.status==='Available');
   if(!item)throw new ConflictException('A selected item is unavailable. Remove it or refresh the inventory.');
   const reserved=data.reservations.filter(row=>row.id!==reservation.id&&!['Cancelled','Rejected'].includes(this.reservationStatus(row)!)&&row.date===reservation.date&&row.start!<reservation.end!&&row.end!>reservation.start!).reduce((total,row)=>{try{return total+(JSON.parse(row.inventorySelection||'[]') as {id:string;quantity:number}[]).filter(pick=>pick.id===id).reduce((sum,pick)=>sum+pick.quantity,0)}catch{return total}},0);
   if(quantity+reserved>Number(item.quantity))throw new ConflictException(`${item.name} has only ${Math.max(0,Number(item.quantity)-reserved)} ${item.unit} available at that time.`);
   seen.add(id);selection.push({id,quantity,name:item.name});
  }
  const previous=reservation.inventorySelection||'';
  const next=JSON.stringify(selection);
  if(previous===next)return reservation;
  reservation.inventorySelection=next;
  reservation.equipment=selection.map(item=>`${item.quantity} | ${item.name}`).join('\n')||'None';
  reservation.updatedAt=new Date().toISOString();reservation.status='Awaiting instructor';
  for(const field of ['instructorDecision','instructorNote','instructorReviewedBy','instructorReviewedAt','instructorSignature','reviewNote','reviewedAt','adminSignature','adminReviewedBy','adminReviewedAt','laboratoryEntries'])delete reservation[field];
  return reservation;
 });}
 resolveReport(id:string,input:unknown){return this.storage.mutate(data=>{const r=data.reports.find(r=>r.id===id);if(!r)throw new NotFoundException('Report not found.');const note=(input as {note?:unknown})?.note;if(typeof note!=='string'||!note.trim()||note.length>1000)throw new BadRequestException('Enter resolution details.');if(r.status==='Resolved')throw new BadRequestException('Report is already resolved.');const updated={...r,status:'Resolved',resolution:note.trim(),resolvedAt:new Date().toISOString()};data.reports=data.reports.map(x=>x.id===id?updated:x);return updated;});}

 private validateRecord(kind:'reservations'|'reports'|'utilization',input:unknown,data:Store,excludeId?:string,requireInstructor=false):Row{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid request.');
  const raw=input as Record<string,unknown>,r:Row={};
  const closedEdit=excludeId&&data.reservations.some(x=>x.id===excludeId&&['Cancelled','Rejected'].includes(x.status!));
  const keys=['facility','name','date',...(kind==='reports'?['type','details']:['start','end','purpose']),...(kind==='utilization'?['attendees']:[]),...(kind==='reservations'?['subject','instructor','equipment']:[])];
  for(const k of keys){const v=raw[k];if(typeof v!=='string'||!v.trim()||v.length>(k==='equipment'?100000:k==='details'?2000:k==='purpose'?1000:100))throw new BadRequestException('Please provide a valid '+k+'.');r[k]=v.trim();}
  {
   if(raw.studentId!==undefined&&(typeof raw.studentId!=='string'||raw.studentId.length>40))throw new BadRequestException('ID number must be 40 characters or fewer.');
   r.studentId=typeof raw.studentId==='string'?raw.studentId.trim():'';
   if(typeof raw.email!=='string'||raw.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email.trim()))throw new BadRequestException('Please enter a valid email address.');
   r.email=raw.email.trim();
   if(kind==='reservations'){if(raw.termsAccepted!==true)throw new BadRequestException('Please agree to the Terms and Conditions before booking.');r.termsAccepted='true';r.termsAcceptedAt=new Date().toISOString();r.termsVersion='hm-laboratory-2026-10-09';}
  }
  if(kind==='reservations'){
   const selected=data.adminKeys.find(row=>row.role==='instructor'&&row.name!.toLowerCase()===r.instructor!.toLowerCase());
   if(requireInstructor&&!selected)throw new BadRequestException('Choose a listed instructor before sending this request.');
   r.instructorKeyId=selected?.id||'';
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
    if(!closedEdit&&data.reservations.some(x=>x.id!==excludeId&&!['Cancelled','Rejected'].includes(this.reservationStatus(x)!)&&x.facility===r.facility&&x.date===r.date&&x.start!<r.end!&&x.end!>r.start!))throw new ConflictException('This facility is already reserved during that time. Choose another time.');
   }
  }
  if(kind==='reports'&&!['Damage','Loss'].includes(r.type!))throw new BadRequestException('Invalid report type.');
  if(kind==='utilization'&&(!/^\d+$/.test(r.attendees!)||Number(r.attendees)<1||Number(r.attendees)>500))throw new BadRequestException('Participants must be between 1 and 500.');
  return r;
 }
 create(kind:'reservations'|'reports'|'utilization',input:unknown,owner?:string,requireInstructor=false){return this.storage.mutate(data=>{
  const r=this.validateRecord(kind,input,data,undefined,requireInstructor);
  if(kind==='reservations'&&owner){
   const raw=(input as Record<string,unknown>).inventoryItems;
   if(!Array.isArray(raw))throw new BadRequestException('Choose listed inventory items.');
   const selected=new Set<string>(),lines:string[]=[],selection:{id:string;quantity:number;name:string}[]=[];
   for(const entry of raw){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new BadRequestException('Invalid equipment selection.');
    const item=entry as Record<string,unknown>,id=item.id,quantity=Number(item.quantity);
    if(typeof id!=='string'||!Number.isSafeInteger(quantity)||quantity<1||selected.has(id))throw new BadRequestException('Choose each equipment item once with a valid quantity.');
    const available=this.inventoryFrom(data).find(row=>row.id===id&&row.status==='Available');
    if(!available)throw new BadRequestException('An equipment item is no longer available. Please refresh the list.');
    const reserved=data.reservations.filter(row=>!['Cancelled','Rejected'].includes(this.reservationStatus(row)!)&&row.date===r.date&&row.start!<r.end!&&row.end!>r.start!).reduce((total,row)=>{try{return total+(JSON.parse(row.inventorySelection||'[]') as {id:string;quantity:number}[]).filter(pick=>pick.id===id).reduce((sum,pick)=>sum+pick.quantity,0)}catch{return total}},0);
    if(quantity+reserved>Number(available.quantity))throw new ConflictException(`${available.name} has only ${Math.max(0,Number(available.quantity)-reserved)} ${available.unit} available at that time.`);
    selected.add(id);selection.push({id,quantity,name:available.name});lines.push(`${quantity} | ${available.name}`);
   }
   r.equipment=lines.join('\n')||'None';r.inventorySelection=JSON.stringify(selection);
  }
  r.id=randomUUID();r.createdAt=new Date().toISOString();if(owner)r.owner=owner;if(kind==='reservations')r.status='Awaiting instructor';if(kind==='reports')r.status='Open';const recoveryCode=kind==='reservations'&&owner?randomBytes(16).toString('hex'):undefined;if(recoveryCode)r.recoveryHash=createHash('sha256').update(recoveryCode).digest('hex');data[kind].push(r);return {...this.publicReservation(r),...(recoveryCode?{recoveryCode}:{})};
 });}
 private recordKind(kind:string):'reservations'|'reports'|'utilization'{if(!['reservations','reports','utilization'].includes(kind))throw new BadRequestException('Invalid record type.');return kind as 'reservations'|'reports'|'utilization';}
 adminCreate(kind:string,input:unknown){const type=this.recordKind(kind);return this.create(type,input,undefined,type==='reservations');}
 adminUpdate(kind:string,id:string,input:unknown){const type=this.recordKind(kind);return this.storage.mutate(data=>{const old=data[type].find(r=>r.id===id);if(!old)throw new NotFoundException('Record not found.');if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid record.');const r=this.validateRecord(type,{...old,...input as object,termsAccepted:old.termsAccepted==='true'},data,id);const updated:Row={...old,...r,updatedAt:new Date().toISOString()};if(type==='reservations'){
   updated.termsAcceptedAt=old.termsAcceptedAt!;updated.termsVersion=old.termsVersion!;
   const signedFields=['facility','name','email','studentId','date','start','end','purpose','subject','instructor','equipment'];
   if(old.instructorDecision==='Approved'&&signedFields.some(field=>old[field]!==updated[field])){
    updated.status='Awaiting instructor';
    for(const field of ['instructorDecision','instructorNote','instructorReviewedBy','instructorReviewedAt','instructorSignature','reviewNote','reviewedAt','adminSignature','adminReviewedBy','adminReviewedAt','laboratoryEntries'])delete updated[field];
   }
   if(old.equipment!==updated.equipment)delete updated.inventorySelection;
  }data[type]=data[type].map(row=>row.id===id?updated:row);return updated;});}
 adminDelete(kind:string,id:string){const type=this.recordKind(kind);return this.storage.mutate(data=>{if(!data[type].some(r=>r.id===id))throw new NotFoundException('Record not found.');data[type]=data[type].filter(r=>r.id!==id);return {success:true};});}
 createFacility(input:unknown){return this.storage.mutate(data=>{const fields=this.validateFacility(input);if(this.facilitiesFrom(data).some(f=>f.name.toLowerCase()===fields.name!.toLowerCase()))throw new ConflictException('A facility with this name already exists.');const row={...fields,id:randomUUID(),createdAt:new Date().toISOString()};data.facilities.push(row);return row;});}
 private validateFacility(input:unknown):Row{if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid facility.');const raw=input as Record<string,unknown>,row:Row={};for(const [key,max] of [['name',100],['category',100],['description',1000]] as const){if(typeof raw[key]!=='string'||!raw[key].trim()||raw[key].length>max)throw new BadRequestException('Provide a valid facility '+key+'.');row[key]=raw[key].trim();}if(!['Available','Unavailable'].includes(String(raw.status)))throw new BadRequestException('Choose a valid availability status.');row.status=String(raw.status);if(typeof raw.reason!=='string'||raw.reason.length>500||(row.status==='Unavailable'&&!raw.reason.trim()))throw new BadRequestException('Provide a reason when unavailable.');row.reason=raw.reason.trim();if(raw.photo!==undefined){if(typeof raw.photo!=='string'||raw.photo.length>220000||(raw.photo!==''&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(raw.photo)))throw new BadRequestException('Provide a valid JPEG facility photo under 165 KB.');row.photo=raw.photo;}return row;}
 deleteFacility(id:string){return this.storage.mutate(data=>{const facility=this.facilitiesFrom(data).find(f=>f.id===id);if(!facility)throw new NotFoundException('Facility not found.');if([...data.reservations,...data.reports,...data.utilization].some(r=>r.facility===facility.name))throw new ConflictException('This facility has existing records. Mark it unavailable instead.');data.facilities=data.facilities.filter(f=>f.id!==id);if(facilityCatalog.some(f=>f.id===id))data.facilities.push({...facility,deleted:'true'});return {success:true};});}
 cancel(id:string){return this.storage.mutate(data=>{const r=data.reservations.find(r=>r.id===id);if(!r)throw new NotFoundException('Reservation not found.');r.status='Cancelled';return {success:true};});}
}
