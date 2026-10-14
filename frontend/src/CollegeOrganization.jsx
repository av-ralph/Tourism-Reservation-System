import './CollegeOrganization.css'

function PersonAvatar({photo}){
 return photo?<img className="organization-avatar" src={photo} alt="" loading="lazy" width="48" height="48"/>:<span className="organization-avatar organization-avatar-empty" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.3-3.5 2.7-5.5 6.5-5.5s6.2 2 6.5 5.5"/></svg></span>
}

export default function CollegeOrganization({groups}){
 return <section className="college-section college-organization"><h2>College organization</h2><p className="source-note">Meet the people who guide and support Cristal e-College.</p>{groups.map((group,index)=><details key={group.title+index}><summary>{group.title}</summary><ul className="organization-people">{group.items.map((person,personIndex)=><li key={person.name+personIndex}><PersonAvatar photo={person.photo}/><span>{person.name}</span></li>)}</ul></details>)}</section>
}
