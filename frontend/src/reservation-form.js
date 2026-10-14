import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import {drawSignature,SIGNATURE_WIDTH,SIGNATURE_HEIGHT} from './signature-utils'
const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]))
const dateLabel = value => value ? new Date(value.length === 10 ? value + 'T00:00:00+08:00' : value).toLocaleDateString('en-PH', {timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}) : ''
export function reservationInventory(equipment) {
  const lines = String(equipment || 'None').split(/\r?\n/).filter(line => line.trim())
  return lines.map(line => {
    // Only an explicit quantity | description supplies a quantity. Preserve other text verbatim.
    const match = line.match(/^\s*(\d+(?:\.\d+)?(?:\s+[A-Za-z.]+)?)\s*\|\s*(.+)$/)
    return match ? {quantity:match[1],description:match[2]} : {quantity:'',description:line}
  })
}
export function fillReservationForm(template, reservation, signatureImage) {
  const files = unzipSync(template)
  let xml = strFromU8(files['word/document.xml'])
  const rowPattern = /<w:tr\b[^>]*>(?:(?!<\/w:tr>)[\s\S])*?\{\{ITEM_QUANTITY\}\}(?:(?!<\/w:tr>)[\s\S])*?<\/w:tr>/
  const row = xml.match(rowPattern)?.[0]
  if (!row) throw new Error('The reservation form template is unavailable.')
  const inventory = reservationInventory(reservation.equipment)
  xml = xml.replace(rowPattern, () => Array.from({length:Math.max(22,inventory.length)}, (_,i) => row.replace('{{ITEM_QUANTITY}}',()=>escapeXml(inventory[i]?.quantity)).replace('{{ITEM_DESCRIPTION}}',()=>escapeXml(inventory[i]?.description))).join(''))
  const values = {
    FILED_DATE:dateLabel(reservation.createdAt), USAGE_DATE:dateLabel(reservation.date),
    SUBJECT:reservation.subject, USAGE_TIME:`${reservation.start} – ${reservation.end}`,
    PURPOSE:`${reservation.purpose}\nFacility: ${reservation.facility}`,
    CONTACT_DETAILS:`Requested by: ${reservation.name} | Email: ${reservation.email}${reservation.studentId ? ' | ID: '+reservation.studentId : ''}`,
  }
  for (const [key,value] of Object.entries(values)) xml=xml.replaceAll('{{'+key+'}}',()=>escapeXml(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">'))
  let signatureRun=''
  if(signatureImage){
    const cx=1828800,cy=548640
    signatureRun=`<w:r><w:br/><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="999" name="Instructor signature"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Instructor signature"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdInstructorSignature"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    const rels='word/_rels/document.xml.rels'
    files[rels]=strToU8(strFromU8(files[rels]).replace('</Relationships>','<Relationship Id="rIdInstructorSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/instructor-signature.png"/></Relationships>'))
    files['word/media/instructor-signature.png']=signatureImage
  }
  xml=xml.replaceAll('{{INSTRUCTOR}}',()=>escapeXml(reservation.instructor)+(signatureRun?`</w:t></w:r>${signatureRun}<w:r><w:t>`:''))
  files['word/document.xml']=strToU8(xml)
  return zipSync(files)
}
function renderSignature(value){
  if(!value)return null
  let strokes
  try{strokes=JSON.parse(value)}catch{return null}
  if(!Array.isArray(strokes))return null
  const canvas=document.createElement('canvas');canvas.width=SIGNATURE_WIDTH;canvas.height=SIGNATURE_HEIGHT
  drawSignature(canvas.getContext('2d'),strokes)
  const base64=canvas.toDataURL('image/png').split(',')[1]
  return Uint8Array.from(atob(base64),char=>char.charCodeAt(0))
}
let templatePromise
export async function downloadReservationForm(reservation) {
  try {
    templatePromise ||= fetch('/documents/reservation-template.docx').then(async response => {
      if (!response.ok) throw new Error('The form template could not be loaded.')
      return new Uint8Array(await response.arrayBuffer())
    }).catch(error=>{templatePromise=undefined;throw error})
    const bytes=fillReservationForm(await templatePromise,reservation,renderSignature(reservation.instructorSignature))
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))
    const link=document.createElement('a');link.href=url;link.download=`HM-Reservation-${reservation.date}-${reservation.id}.docx`;link.click()
    setTimeout(()=>URL.revokeObjectURL(url),30000)
  } catch { throw new Error('Your booking is saved, but the form could not be downloaded. Try the Download filled form button again.') }
}
