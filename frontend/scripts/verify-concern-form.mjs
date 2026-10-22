import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {unzipSync,strFromU8} from 'fflate'
import {fillConcernForm,concernArea,concernItems} from '../src/concern-form.js'
const template=readFileSync(new URL('../public/documents/concern-template.docx',import.meta.url))
const report={id:'test',createdAt:'2026-10-09T14:00:00Z',date:'2026-10-08',facility:'Hot Kitchen',name:'Juan Dela Cruz',instructor:'Maria Santos',start:'08:00',end:'13:30',subject:'Kitchen Essentials',purpose:'Knife skills <practice> & plating',details:'Dropped during cleanup',type:'Damage',reportItems:JSON.stringify([{quantity:2,description:'Dinner plate',condition:'Broke'},{quantity:1,description:'Paring knife',condition:'Lost'},{quantity:3,description:'Sheet pan',condition:'Damaged'}])}
const xml=strFromU8(unzipSync(fillConcernForm(template,report))['word/document.xml'])
assert(!/\{\{[A-Z_]+\}\}/.test(xml),'every placeholder is filled')
for(const text of ['LOSS / DAMAGED ACKNOWLEDGEMENT','Oct 9, 2026','Oct 8, 2026','8:00 AM – 1:30 PM','Kitchen Essentials','Knife skills &lt;practice&gt; &amp; plating','JUAN DELA CRUZ','MARIA SANTOS','CRISTIAN JAY M. PECHON','Dinner plate','Paring knife','Sheet pan','Selected space: '])assert(xml.includes(text),text)
assert.equal((xml.match(/☑/g)||[]).length,1,'one area is checked')
assert(xml.slice(xml.indexOf('☑'),xml.indexOf('☑')+400).includes('Kitchen Area'),'kitchen area checked')
assert.equal((xml.match(/✓/g)||[]).length,3,'each item marks its condition')
assert.equal((xml.match(/<w:tr\b/g)||[]).length,1+2+3+10+4,'items table keeps ten rows')
const paraIds=xml.match(/w14:paraId="[0-9A-F]{8}"/g)||[]
assert.equal(new Set(paraIds).size,paraIds.length,'paragraph ids stay unique')
const many=strFromU8(unzipSync(fillConcernForm(template,{...report,reportItems:JSON.stringify(Array.from({length:14},(_,i)=>({quantity:1,description:`Item ${i+1}`,condition:'Damaged'})))}))['word/document.xml'])
assert(many.includes('Item 14'),'rows expand beyond the printed ten')
assert.deepEqual(concernItems({details:'Missing tray',type:'Loss'}),[{quantity:'',description:'Missing tray',condition:'Lost'}],'older reports still fill one row')
assert.equal(concernArea('Lunara Mini-Hotel Room'),'ROOMS')
assert.equal(concernArea('Computer Laboratory MH 302'),null)
const unlisted=strFromU8(unzipSync(fillConcernForm(template,{...report,facility:'Computer Laboratory MH 302'}))['word/document.xml'])
assert(!unlisted.includes('☑')&&unlisted.includes('Computer Laboratory MH 302'),'spaces without an area box are named')
console.log('Loss / damage acknowledgement form checks passed.')
