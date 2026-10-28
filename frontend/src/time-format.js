// Times are stored as 24-hour HH:MM; people read them on a 12-hour clock.
export const timeLabel=value=>{
  const match=/^(\d{2}):(\d{2})$/.exec(value||'')
  if(!match)return ''
  const hour=Number(match[1])
  return `${hour%12||12}:${match[2]} ${hour<12?'AM':'PM'}`
}
export const timeRange=(start,end)=>[timeLabel(start),timeLabel(end)].filter(Boolean).join(' – ')
