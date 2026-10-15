import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {unzipSync,strFromU8} from 'fflate'
import {fillReservationForm} from '../src/reservation-form.js'
const template=readFileSync(new URL('../public/documents/reservation-template.docx',import.meta.url))
const record={id:'test',createdAt:'2026-10-09T14:00:00Z',date:'2026-10-15',start:'09:00',end:'11:00',subject:'Food & Beverage',purpose:'Practice <plating> $&',facility:'Hot Kitchen',name:'Sample Student',email:'sample@example.com',studentId:'2026-001',instructor:'Sample Instructor',equipment:'2 | Mixing bowls\n4 | Measuring cups\nTray $& (quantity unspecified)'}
const original=unzipSync(template),result=unzipSync(fillReservationForm(template,record)),xml=strFromU8(result['word/document.xml'])
for(const key of Object.keys(original)) if(key!=='word/document.xml') assert.deepEqual(result[key],original[key],key+' preserved')
assert(!xml.includes('{{'))
for(const text of ['Food &amp; Beverage','Practice &lt;plating&gt; $&amp;','Hot Kitchen','Sample Student','Sample Instructor','sample@example.com','2026-001','Mixing bowls','Measuring cups','Tray $&amp; (quantity unspecified)'])assert(xml.includes(text),text)
assert.equal((xml.match(/<w:tr\b/g)||[]).length,(strFromU8(original['word/document.xml']).match(/<w:tr\b/g)||[]).length+11)
const long=fillReservationForm(template,{...record,studentId:'',equipment:Array.from({length:30},(_,i)=>`${i+1} | Item ${i+1}`).join('\n')})
assert(strFromU8(unzipSync(long)['word/document.xml']).includes('Item 30'))
const signed=unzipSync(fillReservationForm(template,{...record,instructorReviewedBy:'Actual Approver',instructorReviewedAt:'2026-10-14T16:30:00Z'},new Uint8Array([137,80,78,71])))
const signedXml=strFromU8(signed['word/document.xml'])
assert(signedXml.includes('Actual Approver'))
assert(!signedXml.includes('Sample Instructor'))
assert(signedXml.indexOf('rIdInstructorSignature')<signedXml.indexOf('Actual Approver'))
assert(!signedXml.includes('{{'))
assert(strFromU8(signed['word/_rels/document.xml.rels']).includes('media/instructor-signature.png'))
assert.equal((xml.match(/<w:tblHeader\b/g)||[]).length,3)
const missingXml=strFromU8(unzipSync(fillReservationForm(template,{createdAt:'bad date',purpose:'A\u0000B'}))['word/document.xml'])
assert(!missingXml.includes('Invalid Date'))
assert(!missingXml.includes('undefined'))
assert(!missingXml.includes('\u0000'))
assert(missingXml.includes('AB'))
assert.throws(()=>fillReservationForm(new Uint8Array([1,2,3]),record))
const literalXml=strFromU8(unzipSync(fillReservationForm(template,{...record,subject:'Literal {{INSTRUCTOR}}',equipment:'1 | {{SIGNATURE}}'}))['word/document.xml'])
assert(literalXml.includes('Literal &#123;&#123;INSTRUCTOR&#125;&#125;'))
assert(literalXml.includes('&#123;&#123;SIGNATURE&#125;&#125;'))
if(process.argv.includes('--samples')){
  const out=new URL('../../.form-work/utilization-review/',import.meta.url)
  mkdirSync(out,{recursive:true})
  writeFileSync(new URL('standard.docx',out),fillReservationForm(template,record))
  writeFileSync(new URL('overflow.docx',out),long)
}
console.log('Passed: preserved package parts, 12-row inventory, 30-item overflow, exact values, optional fields, XML escaping, invalid data, repeated headers, and signer identity/placement.')
