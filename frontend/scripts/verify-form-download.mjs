import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {unzipSync,strFromU8} from 'fflate'
import {downloadReservationForm} from '../src/reservation-form.js'

const template=readFileSync(new URL('../public/documents/reservation-template.docx',import.meta.url))
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
const record={id:'download-test',date:'2026-10-15',name:'Test Requester',email:'test@example.com',facility:'Dining Area',instructor:'Assigned Instructor',equipment:'2 | Plates'}
let responseMode='failure',fetches=0,draws=0
const downloads=[],blobs=[],revocations=[]
const saved={fetch:globalThis.fetch,document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL}
try{
  globalThis.fetch=async()=>{
    fetches++
    if(responseMode==='failure')return {ok:false}
    return {ok:true,arrayBuffer:async()=>responseMode==='html'?new TextEncoder().encode('<html>Fallback page</html>'):template}
  }
  globalThis.setTimeout=(callback)=>{callback();return 0}
  URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:download-test'}
  URL.revokeObjectURL=url=>revocations.push(url)
  globalThis.document={body:{appendChild(){}},createElement(tag){
    if(tag==='a')return {click(){downloads.push({name:this.download,url:this.href})},remove(){}}
    assert.equal(tag,'canvas')
    return {getContext:()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){draws++}}),toDataURL:()=>`data:image/png;base64,${png}`}
  }}
  await assert.rejects(downloadReservationForm(record),/could not be downloaded/)
  assert.equal(downloads.length,0)
  responseMode='html'
  await assert.rejects(downloadReservationForm(record),/could not be downloaded/)
  assert.equal(downloads.length,0)
  responseMode='success'
  await downloadReservationForm(record)
  assert.equal(fetches,3,'Failed responses must not poison the cached template')
  assert.equal(downloads[0].name,'HM-Utilization-2026-10-15-download-test.docx')
  assert.equal(blobs[0].type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const unsigned=strFromU8(unzipSync(new Uint8Array(await blobs[0].arrayBuffer()))['word/document.xml'])
  assert(unsigned.includes('ASSIGNED INSTRUCTOR'))
  assert(!unsigned.includes('rIdInstructorSignature'))
  const strokes=[[[10,40],[25,20],[40,50],[60,15],[80,60],[100,20],[130,50],[160,30]]]
  await downloadReservationForm({...record,instructorSignature:JSON.stringify(strokes),instructorReviewedBy:'Signing Instructor',instructorReviewedAt:'2026-10-15T01:00:00Z'})
  assert.equal(fetches,3,'Successful downloads reuse the loaded template')
  assert(draws>0)
  const signed=unzipSync(new Uint8Array(await blobs[1].arrayBuffer()))
  assert.deepEqual(signed['word/media/instructor-signature.png'],new Uint8Array(Buffer.from(png,'base64')))
  assert(strFromU8(signed['word/document.xml']).includes('SIGNING INSTRUCTOR'))
  for(const signature of ['broken json','{}','[]','[[[1,null]]]']){
    await assert.rejects(downloadReservationForm({...record,instructorSignature:signature}),/saved instructor signature/)
  }
  assert.equal(downloads.length,2,'Invalid signatures must never create an unsigned download')
  assert.equal(revocations.length,2,'Download object URLs are cleaned up')
  console.log('Passed: failed fetch, HTML fallback, retry, template cache, DOCX filename/type, unsigned and signed download, signature validation, URL cleanup.')
}finally{
  globalThis.fetch=saved.fetch
  globalThis.document=saved.document
  globalThis.setTimeout=saved.setTimeout
  URL.createObjectURL=saved.create
  URL.revokeObjectURL=saved.revoke
}
