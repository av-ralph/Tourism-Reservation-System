import college from './college-content.json'

export function defaultOrganization(){
 return college.organization.map(group=>({title:group.title,items:group.items.map(name=>({name,photo:''}))}))
}

export const emptyOrganizationSections=['The Founders','Faculty and Staff']

export function includeOrganizationSections(groups){
 const result=[...groups]
 if(!result.some(group=>group.title?.trim().toLowerCase()==='the founders')){
  const board=result.findIndex(group=>group.title?.trim().toLowerCase()==='board of trustees')
  result.splice(board<0?0:board,0,{title:'The Founders',items:[]})
 }
 if(!result.some(group=>group.title?.trim().toLowerCase()==='faculty and staff')){
  const technical=result.findIndex(group=>group.title?.trim().toLowerCase()==='technical, staff & assistant positions')
  result.splice(technical<0?result.length:technical+1,0,{title:'Faculty and Staff',items:[]})
 }
 return result
}
