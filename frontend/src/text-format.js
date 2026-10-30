// Display helpers for stored text. Stored values stay as saved; only what people see is formatted.
const minorWords=new Set(['a','an','the','and','but','or','nor','for','so','yet','as','at','by','in','of','off','on','per','to','up','via','with','from','into'])

// Title Case for labels built from stored values (for example facility categories). Words that already
// contain capitals, such as HM or CeC, are kept as written.
export const titleCase=value=>String(value??'').split(/(\s+)/).map((word,index,words)=>{
  if(/\s/.test(word)||!word||/[A-Z]/.test(word.slice(1)))return word
  const first=index===0,last=index===words.length-1
  return !first&&!last&&minorWords.has(word.toLowerCase())?word.toLowerCase():word[0].toUpperCase()+word.slice(1)
}).join('')
