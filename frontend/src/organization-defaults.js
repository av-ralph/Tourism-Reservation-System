import college from './college-content.json'

export function defaultOrganization(){
 return college.organization.map(group=>({title:group.title,items:group.items.map(name=>({name,photo:''}))}))
}
