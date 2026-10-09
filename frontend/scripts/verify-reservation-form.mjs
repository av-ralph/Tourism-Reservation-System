import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {unzipSync,strFromU8} from 'fflate'
import {fillReservationForm} from '../src/reservation-form.js'
const template=readFileSync(new URL('../public/documents/reservation-template.docx',import.meta.url))
const record={id:'test',createdAt:'2026-10-09T14:00:00Z',date:'2026-10-15',start:'09:00',end:'11:00',subject:'Food & Beverage',purpose:'Practice <plating> $&',facility:'Hot Kitchen',name:'Sample Student',email:'sample@example.com',studentId:'2026-001',instructor:'Sample Instructor',equipment:'2 | Mixing bowls\n4 | Measuring cups\nTray $& (quantity unspecified)'}
const original=unzipSync(template),result=unzipSync(fillReservationForm(template,record)),xml=strFromU8(result['word/document.xml'])
for(const key of Object.keys(original)) if(key!=='word/document.xml') assert.deepEqual(result[key],original[key],key+' preserved')
assert(!xml.includes('{{'))
for(const text of ['Food &amp; Beverage','Practice &lt;plating&gt; $&amp;','Hot Kitchen','Sample Student','Sample Instructor','sample@example.com','2026-001','Mixing bowls','Measuring cups','Tray $&amp; (quantity unspecified)'])assert(xml.includes(text),text)
assert.equal((xml.match(/<w:tr\b/g)||[]).length,(strFromU8(original['word/document.xml']).match(/<w:tr\b/g)||[]).length+21)
const long=fillReservationForm(template,{...record,studentId:'',equipment:Array.from({length:30},(_,i)=>`${i+1} | Item ${i+1}`).join('\n')})
assert(strFromU8(unzipSync(long)['word/document.xml']).includes('Item 30'))
console.log('Passed: original package/layout preservation, 22-row inventory, overflow rows, exact values, optional ID, XML escaping, and no unresolved fields.')
