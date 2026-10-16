import college from './college-content.json'

export function defaultOrganization(){
 return college.organization.map(group=>({title:group.title,items:group.items.map(name=>({name,photo:''}))}))
}

export const emptyOrganizationSections=['The Founders','Faculty and Staff']

export function includeOrganizationSections(groups){
 const result=groups.filter(group=>group&&typeof group.title==='string').map(group=>({...group,items:Array.isArray(group.items)?group.items:[]}))
 function place(title,anchor,after){
  const index=result.findIndex(group=>group.title.trim().toLowerCase()===title.toLowerCase())
  const group=index<0?{title,items:[]}:result.splice(index,1)[0]
  const anchorIndex=result.findIndex(item=>item.title.trim().toLowerCase()===anchor.toLowerCase())
  result.splice(anchorIndex<0?(after?result.length:0):anchorIndex+(after?1:0),0,group)
 }
 place('The Founders','Board of Trustees',false)
 place('Faculty and Staff','Technical, Staff & Assistant Positions',true)
 return result
}
