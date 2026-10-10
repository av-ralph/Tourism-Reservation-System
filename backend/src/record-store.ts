import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
export type Row = Record<string,string>;
export type Store = {reservations:Row[];reports:Row[];utilization:Row[];facilities:Row[];adminKeys:Row[];adminProfiles:Row[]};
const empty=():Store=>({reservations:[],reports:[],utilization:[],facilities:[],adminKeys:[],adminProfiles:[]});
export function storageMode(): 'file'|'tidb' {
 if(process.env.VERCEL && (!process.env.DATABASE_URL || process.env.HM_STORAGE==='file'))throw new Error('The hosted backend requires TiDB credentials and HM_STORAGE=tidb.');
 const requested=process.env.HM_STORAGE;
 if(requested&& !['file','tidb'].includes(requested))throw new Error('HM_STORAGE must be file or tidb.');
 if(requested==='file')return 'file';
 const raw=process.env.DATABASE_URL||'';
 if(requested==='tidb'||(raw&&!/johndoe|randompassword|localhost:3306|USERNAME|PASSWORD|YOUR_/i.test(raw))){
  let url:URL;try{url=new URL(raw)}catch{throw new Error('Set a valid DATABASE_URL in backend/.env.');}
  if(url.protocol!=='mysql:'||!url.hostname||!url.username||!url.password||url.pathname.length<2||/johndoe|randompassword|USERNAME|PASSWORD|YOUR_/i.test(raw))throw new Error('Replace the placeholder DATABASE_URL with your TiDB connection string.');
  if(url.searchParams.get('sslaccept')!=='strict')throw new Error('TiDB connection requires sslaccept=strict.');
  return 'tidb';
 }
 return 'file';
}
@Injectable()
export class RecordStore implements OnModuleInit,OnModuleDestroy {
 readonly mode=storageMode();
 private file=resolve(process.env.HM_DATA_FILE||'data/records.json');
 private client:PrismaClient|undefined;
 private queue:Promise<unknown>=Promise.resolve();
 private ready:Promise<void>|undefined;
 async onModuleInit(){await this.initialize();}
 async initialize(){
  if(this.mode==='file')return;
  if(!this.ready)this.ready=(async()=>{this.client=new PrismaClient({log:[]});try{await this.client.$connect();await this.client.hmWriteLock.upsert({where:{id:'global'},create:{id:'global'},update:{}});}catch{await this.client.$disconnect();throw new Error('TiDB connection failed. Verify DATABASE_URL and run npm run db:deploy.')}})();
  await this.ready;
 }
 private fromRows(rows:{kind:string;payload:Prisma.JsonValue}[]):Store{
  const data=empty();for(const row of rows){if(['reservations','reports','utilization','facilities','adminKeys','adminProfiles'].includes(row.kind))data[row.kind as keyof Store].push(row.payload as Row);}return data;
 }
 async read():Promise<Store>{
  if(this.mode==='tidb'){await this.initialize();return this.fromRows(await this.client!.hmRecord.findMany({orderBy:[{createdAt:'asc'},{id:'asc'}]}));}
  await this.queue;return this.readFileStore();
 }
 private async localIO<T>(operation:()=>Promise<T>):Promise<T>{for(let attempt=0;;attempt++){try{return await operation();}catch(error){const code=(error as NodeJS.ErrnoException).code;if(!['EBUSY','EPERM'].includes(code||'')||attempt>=5)throw error;await delay(100*(attempt+1));}}}
 private async readFileStore():Promise<Store>{if(!existsSync(this.file))return empty();return {...empty(),...JSON.parse(await this.localIO(()=>readFile(this.file,'utf8')))} as Store;}
 async mutate<T>(change:(data:Store)=>T):Promise<T>{
  if(this.mode==='tidb'){
   await this.initialize();
   for(let attempt=0;attempt<3;attempt++){
    try{return await this.client!.$transaction(async tx=>{
     await tx.hmWriteLock.update({where:{id:'global'},data:{version:{increment:1}}});
     // Locking reads see the latest committed records after acquiring the global lock.
     const rows=await tx.$queryRaw<{kind:string;payload:Prisma.JsonValue}[]>`SELECT kind, payload FROM hm_records ORDER BY createdAt, id FOR UPDATE`;
     const data=this.fromRows(rows);
     const before=new Map(Object.values(data).flat().map(row=>[row.id,JSON.stringify(row)]));
     const result=change(data);
     for(const kind of ['reservations','reports','utilization','facilities','adminKeys','adminProfiles'] as const)for(const row of data[kind]){
      if(before.get(row.id)===JSON.stringify(row))continue;
      const record={kind,owner:row.owner||null,facility:row.facility||row.name||'Account',date:row.date||row.createdAt?.slice(0,10)||'2000-01-01',status:row.status||null,payload:row as Prisma.InputJsonValue,createdAt:row.createdAt?new Date(row.createdAt):new Date()};
      await tx.hmRecord.upsert({where:{id:row.id!},create:{id:row.id!,...record},update:record});
     }
     const remaining=new Set(Object.values(data).flat().map(row=>row.id));
     const removed=[...before.keys()].filter(id=>!remaining.has(id));
     if(removed.length)await tx.hmRecord.deleteMany({where:{id:{in:removed}}});
     return result;
    },{maxWait:10000,timeout:20000});}
    catch(error){if(!(error instanceof Prisma.PrismaClientKnownRequestError)||error.code!=='P2034'||attempt===2)throw error;}
   }
   throw new Error('Database transaction failed.');
  }
  const work=this.queue.then(async()=>{const data=await this.readFileStore();const result=change(data);mkdirSync(dirname(this.file),{recursive:true});await this.localIO(()=>writeFile(this.file,JSON.stringify(data,null,2),'utf8'));return result;});this.queue=work.catch(()=>undefined);return work;
 }
 async importLocal(){
  if(this.mode!=='tidb')throw new Error('Set HM_STORAGE=tidb to import local records.');
  const local=existsSync(this.file)?{...empty(),...JSON.parse(readFileSync(this.file,'utf8'))} as Store:empty();
  return this.mutate(data=>{let count=0;for(const kind of ['reservations','reports','utilization','facilities','adminKeys','adminProfiles'] as const)for(const row of local[kind]){if(data[kind].some(existing=>existing.id===row.id))continue;data[kind].push(row);count++;}return {imported:count};});
 }
 async onModuleDestroy(){await this.client?.$disconnect();}
}
