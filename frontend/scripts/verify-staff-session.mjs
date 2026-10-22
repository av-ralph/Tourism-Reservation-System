import assert from 'node:assert/strict'
import {loadStaffSession,saveStaffSession,clearStaffSession,staffSessionName} from '../src/staff-session.js'

const storage=()=>{
 const values=new Map()
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
}
globalThis.localStorage=storage()
globalThis.sessionStorage=storage()

for(const role of ['admin','instructor']){
 const name=staffSessionName(role)
 sessionStorage.setItem(name,'legacy-key')
 assert.equal(loadStaffSession(role),'legacy-key')
 assert.equal(localStorage.getItem(name),'legacy-key','an existing signed-in tab migrates to persistent storage')
 assert.equal(sessionStorage.getItem(name),null)
 saveStaffSession(role,'new-key')
 assert.equal(loadStaffSession(role),'new-key','a new password replaces the persisted session')
 clearStaffSession(role)
 assert.equal(loadStaffSession(role),'','explicit sign-out clears persistent and legacy sessions')
}
console.log('Passed: admin and instructor sessions persist, migrate, rotate, and clear on sign-out.')
