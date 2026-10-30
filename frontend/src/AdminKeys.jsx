import { useEffect, useState } from 'react'
import { passwordHint, passwordIssue } from './password-policy'

export default function AdminKeys({ request, canManageAdmins = false }) {
 const [keys, setKeys] = useState([]), [error, setError] = useState(''), [notice, setNotice] = useState('')
 const [busy, setBusy] = useState(false), [revealed, setRevealed] = useState({})
 const [customKey, setCustomKey] = useState(''), [showCustomKey, setShowCustomKey] = useState(false)
 useEffect(() => { request('keys').then(setKeys).catch(e => setError(e.message)) }, [request])
 function generateKey() { const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-']; const pool = groups.join(''); const bytes = crypto.getRandomValues(new Uint8Array(32)); const characters = groups.map((group, index) => group[bytes[index] % group.length]); for (let index = 4; index < 16; index++) characters.push(pool[bytes[index] % pool.length]); for (let index = characters.length - 1; index > 0; index--) { const swap = bytes[16 + index] % (index + 1); [characters[index], characters[swap]] = [characters[swap], characters[index]] } setCustomKey(characters.join('')); setNotice('Random key generated. Create the key to save it.') }
 async function create(e) {
  e.preventDefault(); const form = e.currentTarget, fields = Object.fromEntries(new FormData(form))
  if (!canManageAdmins) fields.role = 'instructor'
  const issue = passwordIssue(fields.key)
  if (issue) { setError(issue); return }
  setBusy(true); setError(''); setNotice('')
  try { const saved = await request('keys', { method: 'POST', body: JSON.stringify(fields) }); setKeys(current => [...current, { ...saved, key: fields.key }]); form.reset(); setCustomKey(''); setShowCustomKey(false); setNotice('Access key created. Share it securely with the intended person.') }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function revoke(row) {
  if (!window.confirm(`Revoke access for ${row.name}?`)) return
  setBusy(true); setError(''); setNotice('')
  try { await request(`keys/${row.id}`, { method: 'DELETE' }); setKeys(current => current.filter(key => key.id !== row.id)); setNotice('Access revoked. This key can no longer sign in.') }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 return <section className="panel"><h2>{canManageAdmins ? 'Staff Access' : 'Instructor Access'}</h2><p>{canManageAdmins ? 'Create and manage administrator or instructor keys.' : 'Create a key for each instructor. Instructors can review requests and schedules; an administrator gives final approval.'} Instructors sign in at <a href="/instructor">/instructor</a>.</p>
  <form onSubmit={create}><fieldset disabled={busy}><label>Staff name<input name="name" required maxLength={80} autoComplete="off" /></label>
   {canManageAdmins ? <label>Access level<select name="role" required><option value="admin">Administrator</option><option value="instructor">Instructor</option></select><small>Administrators manage the full workspace; instructors review requests and schedules.</small></label> : <input type="hidden" name="role" value="instructor" />}
   <label>Custom access key<input name="key" value={customKey} onChange={e => setCustomKey(e.target.value)} type={showCustomKey ? 'text' : 'password'} required minLength={10} maxLength={32} autoComplete="new-password" /><small>{passwordHint}</small></label>
   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}><button type="button" className="secondary" onClick={generateKey}>Generate Random Key</button><button type="button" className="secondary" aria-pressed={showCustomKey} onClick={() => setShowCustomKey(!showCustomKey)}>{showCustomKey ? 'Hide Key' : 'Show Key'}</button></div><button className="primary" disabled={busy}>Create {canManageAdmins ? 'Staff' : 'Instructor'} Key</button></fieldset></form>
  {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
  <h3>Active {canManageAdmins ? 'Staff' : 'Instructor'} Keys</h3>{!keys.length && <p>No additional {canManageAdmins ? 'staff' : 'instructors'} yet.</p>}
  {keys.map(row => <div className="booking-toolbar" key={row.id}><div><strong>{row.name}</strong><p>{row.role === 'instructor' ? 'Instructor' : 'Administrator'} · Created {new Date(row.createdAt).toLocaleDateString()}</p>{row.key ? <><code style={{ overflowWrap: 'anywhere' }}>{revealed[row.id] ? row.key : '••••••••••••••••'}</code><button type="button" className="secondary" aria-expanded={!!revealed[row.id]} onClick={() => setRevealed({ ...revealed, [row.id]: !revealed[row.id] })}>{revealed[row.id] ? 'Hide Key' : 'Show Key'}</button></> : <p>This older key cannot be recovered. Revoke it and create a replacement.</p>}</div><button className="secondary" disabled={busy} onClick={() => revoke(row)}>Revoke Access</button></div>)}
 </section>
}
