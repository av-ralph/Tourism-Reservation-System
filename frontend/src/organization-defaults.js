import college from './college-content.json'

export function splitPersonNameTitle(value){
 const text=String(value||'').trim()
 const namedRole=text.match(/^(.+?)\s+[–—]\s+(.+)$/)
 if(namedRole)return {name:namedRole[1],title:namedRole[2]}
 const leadingRole=text.match(/^([A-Za-z][A-Za-z &/]+)-\s+(.+)$/)
 return leadingRole?{name:leadingRole[2],title:leadingRole[1]}:{name:text,title:''}
}

export function defaultOrganization(){
 return college.organization.map(group=>({title:group.title,items:group.items.map(value=>({...splitPersonNameTitle(value),photo:''}))}))
}

export const emptyOrganizationSections=['The Founders','Faculty and Staff']

export function includeOrganizationSections(groups){
 return groups.filter(group=>group&&typeof group.title==='string').map(group=>({
  ...group,
  items:Array.isArray(group.items)?group.items.map(person=>({
   ...person,
   ...(typeof person.title==='string'?{}:splitPersonNameTitle(person.name)),
  })):[],
 }))
}
