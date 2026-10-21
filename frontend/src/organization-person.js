export function splitPersonNameTitle(value){
 const text=String(value||'').trim()
 const namedRole=text.match(/^(.+?)\s+[–—]\s+(.+)$/)
 if(namedRole)return {name:namedRole[1],title:namedRole[2]}
 const hyphenated=text.match(/^(.+?)-\s+(.+)$/)
 if(!hyphenated)return {name:text,title:''}
 const first=hyphenated[1].trim(),second=hyphenated[2].trim()
 const roleFirst=/\b(?:laboratory|office|in-charge|assistant|coordinator|director|manager|dean|registrar|officer|head)\b/i.test(first)
 return roleFirst?{name:second,title:first}:{name:first,title:second}
}

export function normalizeOrganizationPerson(person){
 const legacy=splitPersonNameTitle(person.name)
 return {...person,name:legacy.name,title:typeof person.title==='string'&&person.title.trim()?person.title.trim():legacy.title}
}
