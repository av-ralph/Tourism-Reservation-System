const names={admin:'hm-admin-session',instructor:'hm-instructor-session'}

export const staffSessionName=role=>names[role]

export function loadStaffSession(role){
 const name=staffSessionName(role)
 try{
  const saved=localStorage.getItem(name)
  if(saved)return saved
  const previous=sessionStorage.getItem(name)
  if(previous){localStorage.setItem(name,previous);sessionStorage.removeItem(name)}
  return previous||''
 }catch{
  try{return sessionStorage.getItem(name)||''}catch{return ''}
 }
}

export function saveStaffSession(role,key){
 const name=staffSessionName(role)
 let persisted=false
 try{localStorage.setItem(name,key);persisted=true}catch{/* Fall back to this tab. */}
 try{if(persisted)sessionStorage.removeItem(name);else sessionStorage.setItem(name,key)}
 catch{/* The current tab remains signed in. */}
}

export function clearStaffSession(role){
 const name=staffSessionName(role)
 try{localStorage.removeItem(name)}catch{/* Storage may be disabled. */}
 try{sessionStorage.removeItem(name)}catch{/* Storage may be disabled. */}
}
