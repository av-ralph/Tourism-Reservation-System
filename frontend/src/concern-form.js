import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import {escapeXml,dateLabel,uniqueRowIds} from './reservation-form.js'
import {timeRange} from './time-format.js'
export function concernItems(report){
  try{
    const items=JSON.parse(report.reportItems||'[]')
    if(Array.isArray(items)&&items.length)return items.map(item=>({quantity:String(item.quantity??''),description:String(item.description??''),condition:String(item.condition??'')}))
  }catch{ /* Older reports only have the incident description. */ }
  return report.details?[{quantity:'',description:report.details,condition:report.type==='Loss'?'Lost':'Damaged'}]:[]
}
export function concernArea(facility){
  const name=String(facility||'').trim().toLowerCase()
  if(name==='bar area')return 'BAR'
  if(name==='dining area')return 'DINING'
  if(name==='front office area')return 'FRONT_OFFICE'
  if(name==='hot kitchen'||name==='cold kitchen')return 'KITCHEN'
  if(name==='laundry area')return 'LAUNDRY'
  if(['mini function room','harmonia mini-hotel','harmonia mini-hotel room','lunara mini-hotel','lunara mini-hotel room'].includes(name))return 'ROOMS'
  return null
}
export function fillConcernForm(template,report){
  const files=unzipSync(template)
  if(!files['word/document.xml'])throw new Error('The form template is not a valid Word document.')
  let xml=strFromU8(files['word/document.xml'])
  const rowPattern=/<w:tr\b[^>]*>(?:(?!<\/w:tr>)[\s\S])*?\{\{ITEM_QUANTITY\}\}(?:(?!<\/w:tr>)[\s\S])*?<\/w:tr>/
  const row=xml.match(rowPattern)?.[0]
  if(!row)throw new Error('The concern form template is unavailable.')
  const items=concernItems(report)
  xml=xml.replace(rowPattern,()=>Array.from({length:Math.max(10,items.length)},(_,i)=>{
    const item=items[i]||{}
    const values={ITEM_QUANTITY:item.quantity,ITEM_DESCRIPTION:item.description,ITEM_BROKE:item.condition==='Broke'?'✓':'',ITEM_LOST:item.condition==='Lost'?'✓':'',ITEM_DAMAGED:item.condition==='Damaged'?'✓':'',ITEM_REPLACED:''}
    return Object.entries(values).reduce((result,[key,value])=>result.replaceAll(`{{${key}}}`,()=>escapeXml(value)),uniqueRowIds(row,i))
  }).join(''))
  const checkedArea=concernArea(report.facility)
  for(const area of ['BAR','DINING','FRONT_OFFICE','KITCHEN','LAUNDRY','ROOMS'])xml=xml.replaceAll(`{{CHECK_${area}}}`,()=>area===checkedArea?'☑':'☐')
  const values={
    FILED_DATE:dateLabel(report.createdAt),FACILITY:report.facility,USAGE_DATE:dateLabel(report.date),
    SUBJECT:report.subject,USAGE_TIME:timeRange(report.start,report.end),PURPOSE:report.purpose,
    STUDENT_NAME:String(report.name||'').toLocaleUpperCase('en-PH'),INSTRUCTOR_NAME:String(report.instructor||'').toLocaleUpperCase('en-PH'),
    IN_CHARGE_NAME:'CRISTIAN JAY M. PECHON',
  }
  for(const [key,value] of Object.entries(values))xml=xml.replaceAll('{{'+key+'}}',()=>escapeXml(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">'))
  files['word/document.xml']=strToU8(xml)
  return zipSync(files)
}
let templatePromise
export async function downloadConcernForm(report){
  try{
    templatePromise||=fetch('/documents/concern-template.docx?v=2').then(async response=>{
      if(!response.ok)throw new Error('The form template could not be loaded.')
      return new Uint8Array(await response.arrayBuffer())
    }).catch(error=>{templatePromise=undefined;throw error})
    const bytes=fillConcernForm(await templatePromise,report)
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))
    const link=document.createElement('a');link.href=url;link.download=`HM-Loss-Damage-${report.date||'undated'}-${report.id||'form'}.docx`.replace(/[<>:"/\\|?*]/g,'-');document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),30000)
  }catch(error){
    templatePromise=undefined
    throw new Error('The filled form could not be downloaded. Please try again.',{cause:error})
  }
}
