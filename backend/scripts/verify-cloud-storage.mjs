import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {RecordStore} from '../dist/record-store.js';
const id=randomUUID(),store=new RecordStore(),second=new RecordStore(),cleanup=new PrismaClient({log:[]});
let passed=false;
try{
 assert.equal(store.mode,'tidb');await store.initialize();
 await store.mutate(data=>{data.utilization.push({id,facility:'Hot Kitchen',date:'2000-01-01',name:'Temporary database verification',email:'verification@example.com',studentId:'',start:'09:00',end:'10:00',attendees:'1',purpose:'Temporary connection test',createdAt:new Date().toISOString()});});
 assert.equal((await second.read()).utilization.find(row=>row.id===id)?.purpose,'Temporary connection test');
 await store.mutate(data=>{const row=data.utilization.find(row=>row.id===id);assert.ok(row);row.purpose='Transaction update verified';});
 assert.equal((await second.read()).utilization.find(row=>row.id===id)?.purpose,'Transaction update verified');passed=true;
}catch{console.error('Cloud write verification failed. No credentials were printed.');process.exitCode=1;}
finally{
 try{await cleanup.hmRecord.deleteMany({where:{id,kind:'utilization'}});if(passed)console.log('TiDB storage insert, transaction update, and read from a separate backend instance passed. The temporary verification record was removed.');}catch{console.error('Temporary verification record cleanup could not be confirmed.');process.exitCode=1;}
 await store.onModuleDestroy();await second.onModuleDestroy();await cleanup.$disconnect();
}
