import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import {drawSignature,fitSignatureStrokes,signatureIsMeaningful,SIGNATURE_WIDTH,SIGNATURE_HEIGHT} from './signature-utils.js'
import {extractSignatureImage} from './signature-image.js'
// Strip characters that XML 1.0 cannot represent, including pasted control characters.
const escapeXml = value => Array.from(String(value ?? '')).filter(char => {
  const code=char.codePointAt(0)
  return code===9||code===10||code===13||(code>=32&&code<=0xd7ff)||(code>=0xe000&&code<=0xfffd)||(code>=0x10000&&code<=0x10ffff)
}).join('').replace(/[&<>"'{}]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;','{':'&#123;','}':'&#125;'}[char]))
const dateLabel = value => {
  if(!value)return ''
  const date=new Date(value.length===10?value+'T00:00:00+08:00':value)
  return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})
}
export function reservationInventory(equipment) {
  const lines = String(equipment || 'None').split(/\r?\n/).filter(line => line.trim())
  return lines.map(line => {
    // Only an explicit quantity | description supplies a quantity. Preserve other text verbatim.
    const match = line.match(/^\s*(\d+(?:\.\d+)?(?:\s+[A-Za-z.]+)?)\s*\|\s*(.+)$/)
    return match ? {quantity:match[1],description:match[2]} : {quantity:'',description:line}
  })
}
export function reservationItems(reservation) {
  try {
    const selected=JSON.parse(reservation.inventorySelection||'[]')
    if(Array.isArray(selected)&&selected.length&&selected.every(item=>Number.isSafeInteger(item.quantity)&&item.quantity>0&&typeof item.name==='string'&&item.name.trim()))
      return selected.map(item=>({quantity:String(item.quantity),description:item.name}))
  } catch { /* Older bookings only have the equipment summary. */ }
  return reservationInventory(reservation.equipment)
}
export function reservationLaboratoryEntries(reservation){
 try{const entries=JSON.parse(reservation.laboratoryEntries||'[]');return Array.isArray(entries)?entries:[]}catch{return []}
}
function uniqueRowIds(source,index){let id=0;return source.replace(/w14:paraId="[0-9A-Fa-f]{8}"/g,()=>`w14:paraId="${(0xF0000000+index*256+id++).toString(16).toUpperCase()}"`)}
export function reservationArea(facility) {
  const name=String(facility||'').trim().toLowerCase()
  if(name==='bar area')return 'BAR'
  if(name==='dining area')return 'DINING'
  if(name==='front office area')return 'FRONT_OFFICE'
  if(name==='hot kitchen')return 'HOT_KITCHEN'
  if(name==='cold kitchen')return 'COLD_KITCHEN'
  if(name==='laundry area')return 'LAUNDRY'
  if(name==='mini function room')return 'MINI_FUNCTION'
  if(name==='harmonia mini-hotel'||name==='harmonia mini-hotel room')return 'HARMONIA'
  if(name==='lunara mini-hotel'||name==='lunara mini-hotel room')return 'LUNARA'
  if(name==='computer laboratory mh 302')return 'COMPUTER'
  return null
}
export function fillReservationForm(template, reservation, signatureImage, adminSignatureImage) {
  const files = unzipSync(template)
  if(!files['word/document.xml'])throw new Error('The form template is not a valid Word document.')
  let xml = strFromU8(files['word/document.xml'])
  const rowPattern = /<w:tr\b[^>]*>(?:(?!<\/w:tr>)[\s\S])*?\{\{ITEM_QUANTITY\}\}(?:(?!<\/w:tr>)[\s\S])*?<\/w:tr>/
  const row = xml.match(rowPattern)?.[0]
  if (!row) throw new Error('The reservation form template is unavailable.')
  const inventory = reservationItems(reservation)
  const laboratory=reservationLaboratoryEntries(reservation)
  xml = xml.replace(rowPattern, () => Array.from({length:Math.max(12,inventory.length)}, (_,i) => {
    const entry=laboratory[i]||{}
    const values={ITEM_QUANTITY:inventory[i]?.quantity,ITEM_DESCRIPTION:inventory[i]?.description,LAB_RELEASED:entry.released,LAB_REMARKS:entry.remarks,LAB_RETURNED:entry.returned?dateLabel(entry.returned):'',LAB_GOOD:entry.condition==='Good order'?'✓':'',LAB_LOST:entry.condition==='Lost'?'✓':'',LAB_DAMAGED:entry.condition==='Damaged'?'✓':''}
    return Object.entries(values).reduce((result,[key,value])=>result.replaceAll(`{{${key}}}`,()=>escapeXml(value)),uniqueRowIds(row,i))
  }).join(''))
  const checkedArea=reservationArea(reservation.facility)
  for(const area of ['BAR','DINING','FRONT_OFFICE','HOT_KITCHEN','COLD_KITCHEN','LAUNDRY','MINI_FUNCTION','HARMONIA','LUNARA','COMPUTER'])xml=xml.replaceAll(`{{CHECK_${area}}}`,()=>area===checkedArea?'☑':'☐')
  const values = {
    FILED_DATE:dateLabel(reservation.createdAt), USAGE_DATE:dateLabel(reservation.date),
    SUBJECT:reservation.subject, USAGE_TIME:[reservation.start,reservation.end].filter(Boolean).join(' – '),
    PURPOSE:reservation.purpose,
    REQUESTER_NAME:reservation.name,
    REQUESTER_EMAIL:[reservation.email,reservation.studentId ? 'ID: '+reservation.studentId : ''].filter(Boolean).join(' | '),
    CONTACT_DETAILS:reservation.adminOverride==='true'?'Instructor review waived by administrator; reason recorded with the booking.':'',
    SIGNED_DATE:signatureImage?dateLabel(reservation.instructorReviewedAt):'__________________',
    ADMIN_SIGNED_DATE:adminSignatureImage?dateLabel(reservation.adminReviewedAt):'__________________',
  }
  for (const [key,value] of Object.entries(values)) xml=xml.replaceAll('{{'+key+'}}',()=>escapeXml(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">'))
  let signatureRun=''
  if(signatureImage){
    const cx=1828800,cy=548640
    signatureRun=`<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="999" name="Instructor signature"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Instructor signature"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdInstructorSignature"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    const rels='word/_rels/document.xml.rels'
    files[rels]=strToU8(strFromU8(files[rels]).replace('</Relationships>','<Relationship Id="rIdInstructorSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/instructor-signature.png"/></Relationships>'))
    files['word/media/instructor-signature.png']=signatureImage
  }
  xml=xml.replaceAll('{{INSTRUCTOR}}',()=>escapeXml(String(reservation.adminOverride==='true'?'INSTRUCTOR REVIEW WAIVED':signatureImage?(reservation.instructorReviewedBy||reservation.instructor):reservation.instructor||'').toLocaleUpperCase('en-PH')))
  xml=xml.replaceAll('{{ADMIN_NAME}}',()=>escapeXml(String(adminSignatureImage?reservation.adminReviewedBy||'Cristian Jay M. Pechon':'Cristian Jay M. Pechon').toLocaleUpperCase('en-PH')))
  xml=xml.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?\{\{SIGNATURE\}\}(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/,()=>signatureRun||'<w:r><w:t> </w:t></w:r>')
  let adminRun=''
  if(adminSignatureImage){
    adminRun=signatureRun.replaceAll('Instructor signature','Administrator signature').replaceAll('rIdInstructorSignature','rIdAdminSignature')
    if(!signatureImage){
      adminRun=`<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1828800" cy="548640"/><wp:docPr id="1000" name="Administrator signature"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="2" name="Administrator signature"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdAdminSignature"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1828800" cy="548640"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    }
    adminRun=adminRun.replace('id="999"','id="1000"').replace('id="1"','id="2"')
    const rels='word/_rels/document.xml.rels'
    files[rels]=strToU8(strFromU8(files[rels]).replace('</Relationships>','<Relationship Id="rIdAdminSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/admin-signature.png"/></Relationships>'))
    files['word/media/admin-signature.png']=adminSignatureImage
  }
  xml=xml.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?\{\{ADMIN_SIGNATURE\}\}(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/,()=>adminRun||'<w:r><w:t> </w:t></w:r>')
  files['word/document.xml']=strToU8(xml)
  return zipSync(files)
}
async function renderSignature(value,label='instructor'){
  if(!value)return null
  let strokes
  try{strokes=JSON.parse(value)}catch{throw new Error(`The saved ${label} signature cannot be read. Please contact the laboratory office.`)}
  if(strokes?.type==='image'){
    if(!signatureIsMeaningful(strokes))throw new Error(`The saved ${label} signature image is invalid. Please contact the laboratory office.`)
    try{
      const original=Uint8Array.from(atob(strokes.data.slice('data:image/png;base64,'.length)),char=>char.charCodeAt(0))
      const cleaned=await extractSignatureImage(new Blob([original],{type:'image/png'}))
      return Uint8Array.from(atob(cleaned.data.slice('data:image/png;base64,'.length)),char=>char.charCodeAt(0))
    }catch{throw new Error(`The saved ${label} signature background could not be removed. Please ask the signer to upload a clear image.`)}
  }
  if(!Array.isArray(strokes)||!strokes.every(stroke=>Array.isArray(stroke)&&stroke.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)))||!signatureIsMeaningful(strokes))throw new Error(`The saved ${label} signature is invalid. Please contact the laboratory office.`)
  const canvas=document.createElement('canvas');canvas.width=SIGNATURE_WIDTH;canvas.height=SIGNATURE_HEIGHT
  drawSignature(canvas.getContext('2d'),fitSignatureStrokes(strokes))
  const base64=canvas.toDataURL('image/png').split(',')[1]
  return Uint8Array.from(atob(base64),char=>char.charCodeAt(0))
}
let templatePromise
export async function downloadReservationForm(reservation) {
  try {
    templatePromise ||= fetch('/documents/reservation-template.docx?v=20').then(async response => {
      if (!response.ok) throw new Error('The form template could not be loaded.')
      return new Uint8Array(await response.arrayBuffer())
    }).catch(error=>{templatePromise=undefined;throw error})
    const template=await templatePromise
    const [instructorSignature,adminSignature]=await Promise.all([renderSignature(reservation.instructorSignature),renderSignature(reservation.adminSignature,'administrator')])
    const bytes=fillReservationForm(template,reservation,instructorSignature,adminSignature)
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))
    const link=document.createElement('a');link.href=url;link.download=`HM-Utilization-${reservation.date||'undated'}-${reservation.id||'form'}.docx`.replace(/[<>:"/\\|?*]/g,'-');document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),30000)
  } catch (error) {
    templatePromise=undefined
    throw new Error(error.message?.startsWith('The saved ')?error.message:'The filled form could not be downloaded. Please try again.',{cause:error})
  }
}
