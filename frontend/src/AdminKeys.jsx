import { useEffect, useState } from 'react'

export default function AdminKeys({request}) {

 const [revealed,setRevealed]=useState({})
 const [keys,setKeys]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')

 useEffect(()=>{request('keys').then(setKeys).catch(e=>setError(e.message))},[request])

 async function create(e){e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));setBusy(true);setError('');setNotice('');try{await request('keys',{method:'POST',body:JSON.stringify(fields)});setKeys(await request('keys'));form.reset();setNotice('Admin key created. Share the key securely with its administrator.')}catch(e){setError(e.message)}finally{setBusy(false)}}

 async function revoke(id){setBusy(true);setError('');try{await request('keys/'+id,{method:'DELETE'});setKeys(await request('keys'));setNotice('Access revoked. This key can no longer sign in.')}catch(e){setError(e.message)}finally{setBusy(false)}}

 return <section className="panel"><h2>Administrator access</h2><p>Create a separate key for each administrator. Only the super admin can manage access keys.</p><form onSubmit={create}><fieldset disabled={busy}><label>Administrator name<input name="name" required maxLength={80} autoComplete="off"/></label><label>Custom access key<input name="key" type="password" required minLength={16} maxLength={128} pattern="[A-Za-z0-9_-]+" autoComplete="new-password"/><small>16–128 letters, numbers, hyphens, or underscores. Only the super admin can reveal saved keys.</small></label><button className="primary" disabled={busy}>Create admin key</button></fieldset></form>{error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}<h3>Active admin keys</h3>{!keys.length&&<p>No additional administrators yet.</p>}{keys.map(row=><div className="booking-toolbar" key={row.id}><div><strong>{row.name}</strong><p>Created {new Date(row.createdAt).toLocaleDateString()}</p>{row.key?<><code style={{overflowWrap:'anywhere'}}>{revealed[row.id]?row.key:'••••••••••••••••'}</code><button type="button" className="secondary" aria-expanded={!!revealed[row.id]} onClick={()=>setRevealed({...revealed,[row.id]:!revealed[row.id]})}>{revealed[row.id]?'Hide key':'Show key'}</button></>:<p>This older key cannot be recovered. Revoke and create a replacement to enable viewing.</p>}</div><button className="secondary" disabled={busy} onClick={()=>{if(window.confirm('Revoke access for '+row.name+'?'))revoke(row.id)}}>Revoke access</button></div>)}</section>

}

