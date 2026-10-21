import './CollegeOrganization.css'
import {normalizeOrganizationPerson} from './organization-person'

function PersonAvatar({photo}){
 return photo?<img className="organization-avatar" src={photo} alt="" loading="lazy" width="48" height="48"/>:<span className="organization-avatar organization-avatar-empty" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.3-3.5 2.7-5.5 6.5-5.5s6.2 2 6.5 5.5"/></svg></span>
}

export default function CollegeOrganization({groups}){
 return <section className="college-section college-organization"><div className="organization-intro"><div><span className="organization-kicker">PEOPLE OF CeC</span><h2>College Organization</h2><p>Explore the people behind the college, from its founders and trustees to its academic and support teams.</p></div></div><div className="organization-groups">{groups.map((group,index)=><details key={group.title+index}><summary><span>{group.title}</span><span className="organization-group-count">{group.items.length?`${group.items.length} ${group.items.length===1?'person':'people'}`:'Profiles pending'}</span></summary>{group.items.length?<ul className="organization-people">{group.items.map((person,personIndex)=>{const {name,title}=normalizeOrganizationPerson(person);return <li key={person.name+personIndex}><PersonAvatar photo={person.photo}/><span className="organization-person-info"><strong>{name}</strong>{title&&<small>{title}</small>}</span></li>})}</ul>:<p className="organization-empty">Names and photos for this group will appear once confirmed by the college.</p>}</details>)}</div></section>
}
