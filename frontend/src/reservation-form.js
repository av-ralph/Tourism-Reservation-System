import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
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
export function fillReservationForm(template, reservation) {
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
    INSTRUCTOR:reservation.instructor,
  }
  for (const [key,value] of Object.entries(values)) xml=xml.replaceAll('{{'+key+'}}',()=>escapeXml(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">'))
  files['word/document.xml']=strToU8(xml)
  return zipSync(files)
}
let templatePromise
export async function downloadReservationForm(reservation) {
  try {
    templatePromise ||= fetch('/documents/reservation-template.docx').then(async response => {
      if (!response.ok) throw new Error('The form template could not be loaded.')
      return new Uint8Array(await response.arrayBuffer())
    }).catch(error=>{templatePromise=undefined;throw error})
    const bytes=fillReservationForm(await templatePromise,reservation)
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))
    const link=document.createElement('a');link.href=url;link.download=`HM-Reservation-${reservation.date}-${reservation.id}.docx`;link.click()
    setTimeout(()=>URL.revokeObjectURL(url),30000)
  } catch { throw new Error('Your booking is saved, but the form could not be downloaded. Try the Download filled form button again.') }
}
