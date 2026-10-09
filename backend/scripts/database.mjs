import 'dotenv/config';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {PrismaClient} from '@prisma/client';
const action=process.argv[2]||'check';
let client,store;
try{
 const {RecordStore,storageMode}=await import('../dist/record-store.js');
 if(storageMode()!=='tidb')throw new Error('Set DATABASE_URL to your TiDB Connect > Prisma connection string and HM_STORAGE=tidb in backend/.env.');
 if(action==='deploy'){
  try{await promisify(execFile)(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:process.cwd(),env:process.env,timeout:120000,maxBuffer:1024*1024});console.log('HM database migrations deployed. No existing records were deleted.');}
  catch{throw new Error('Migration deployment failed. Check database credentials, network access, and permissions. Credentials are not printed.');}
 }else if(action==='import'){
  store=new RecordStore();const result=await store.importLocal();console.log(`Imported ${result.imported} local records. Existing IDs were skipped; the local file was preserved.`);
 }else if(action==='check'){
  client=new PrismaClient({log:[]});await client.$connect();await client.$queryRaw`SELECT 1`;
  const count=await client.hmRecord.count();console.log(`TiDB connection and HM tables verified. Stored records: ${count}.`);
 }else throw new Error('Choose check, deploy, or import.');
}catch(error){
 const message=String(error?.message||'');
 if(message.startsWith('Set ')||message.startsWith('TiDB connection requires')||message.startsWith('Replace the placeholder')||message.startsWith('Migration deployment failed'))console.error(message);
 else console.error('Database operation failed. Check DATABASE_URL, TLS, network access, and migration status. Credentials are not printed.');
 process.exitCode=1;
}finally{await client?.$disconnect();await store?.onModuleDestroy();}
