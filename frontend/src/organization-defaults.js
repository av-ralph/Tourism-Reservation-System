import college from './college-content.json'
import {splitPersonNameTitle,normalizeOrganizationPerson} from './organization-person.js'

export function defaultOrganization(){
 return college.organization.map(group=>({title:group.title,items:group.items.map(value=>({...splitPersonNameTitle(value),photo:''}))}))
}

export const emptyOrganizationSections=['The Founders','Faculty and Staff']

export function includeOrganizationSections(groups){
 return groups.filter(group=>group&&typeof group.title==='string').map(group=>({
  ...group,
  items:Array.isArray(group.items)?group.items.map(normalizeOrganizationPerson):[],
 }))
}
