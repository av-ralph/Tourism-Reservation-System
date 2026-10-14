import { useEffect, useState } from 'react'

export default function AdminKeys({ request, canManageAdmins = false }) {
 const [keys, setKeys] = useState([]), [error, setError] = useState(''), [notice, setNotice] = useState('')
 const [busy, setBusy] = useState(false), [revealed, setRevealed] = useState({})
 const [customKey, setCustomKey] = useState(''), [showCustomKey, setShowCustomKey] = useState(false)
 useEffect(() => { request('keys').then(setKeys).catch(e => setError(e.message)) }, [request])
 function generateKey() { const bytes = crypto.getRandomValues(new Uint8Array(32)); setCustomKey(Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')); setNotice('Random key generated. Create the key to save it.') }
 async function create(e) {
  e.preventDefault(); const form = e.currentTarget, fields = Object.fromEntries(new FormData(form))
  if (!canManageAdmins) fields.role = 'instructor'
  setBusy(true); setError(''); setNotice('')
  try { await request('keys', { method: 'POST', body: JSON.stringify(fields) }); setKeys(await request('keys')); form.reset(); setCustomKey(''); setShowCustomKey(false); setNotice('Access key created. Share it securely with the intended person.') }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function revoke(row) {
  if (!window.confirm(`Revoke access for ${row.name}?`)) return
  setBusy(true); setError(''); setNotice('')
  try { await request(`keys/${row.id}`, { method: 'DELETE' }); setKeys(await request('keys')); setNotice('Access revoked. This key can no longer sign in.') }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 return <section className="panel"><h2>{canManageAdmins ? 'Staff access' : 'Instructor access'}</h2><p>{canManageAdmins ? 'Create and manage administrator or instructor keys.' : 'Create a key for each instructor. Instructors can review requests and schedules; an administrator gives final approval.'} Instructors sign in at <a href="/instructor">/instructor</a>.</p>
  <form onSubmit={create}><fieldset disabled={busy}><label>Staff name<input name="name" required maxLength={80} autoComplete="off" /></label>
   {canManageAdmins ? <label>Access level<select name="role" required><option value="admin">Administrator — full workspace</option><option value="instructor">Instructor — requests and schedule</option></select></label> : <input type="hidden" name="role" value="instructor" />}
   <label>Custom access key<input name="key" value={customKey} onChange={e => setCustomKey(e.target.value)} type={showCustomKey ? 'text' : 'password'} required minLength={16} maxLength={128} pattern="[A-Za-z0-9_-]+" autoComplete="new-password" /><small>Use 16–128 letters, numbers, hyphens, or underscores.</small></label>
   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}><button type="button" className="secondary" onClick={generateKey}>Generate random key</button><button type="button" className="secondary" aria-pressed={showCustomKey} onClick={() => setShowCustomKey(!showCustomKey)}>{showCustomKey ? 'Hide key' : 'Show key'}</button></div><button className="primary" disabled={busy}>Create {canManageAdmins ? 'staff' : 'instructor'} key</button></fieldset></form>
  {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
  <h3>Active {canManageAdmins ? 'staff' : 'instructor'} keys</h3>{!keys.length && <p>No additional {canManageAdmins ? 'staff' : 'instructors'} yet.</p>}
  {keys.map(row => <div className="booking-toolbar" key={row.id}><div><strong>{row.name}</strong><p>{row.role === 'instructor' ? 'Instructor' : 'Administrator'} · Created {new Date(row.createdAt).toLocaleDateString()}</p>{row.key ? <><code style={{ overflowWrap: 'anywhere' }}>{revealed[row.id] ? row.key : '••••••••••••••••'}</code><button type="button" className="secondary" aria-expanded={!!revealed[row.id]} onClick={() => setRevealed({ ...revealed, [row.id]: !revealed[row.id] })}>{revealed[row.id] ? 'Hide key' : 'Show key'}</button></> : <p>This older key cannot be recovered. Revoke it and create a replacement.</p>}</div><button className="secondary" disabled={busy} onClick={() => revoke(row)}>Revoke access</button></div>)}
 </section>
}
