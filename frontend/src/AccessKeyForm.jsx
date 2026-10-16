import { useState } from 'react'
import { passwordHint, passwordIssue } from './password-policy'

export default function AccessKeyForm({ request, onChanged }) {
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [notice, setNotice] = useState('')
 const [show, setShow] = useState(false)

 async function change(event) {
  event.preventDefault()
  if (busy) return
  const form = event.currentTarget
  const { currentKey, newKey, confirmKey } = Object.fromEntries(new FormData(form))
  setError(''); setNotice('')
  const issue = passwordIssue(newKey)
  if (issue) { setError(issue); return }
  if (newKey !== confirmKey) { setError('The new keys do not match.'); return }
  if (newKey === currentKey) { setError('Choose a different access key.'); return }
  setBusy(true)
  try {
   await request('access-key', { method: 'PATCH', body: JSON.stringify({ currentKey, newKey }) })
   onChanged(newKey)
   form.reset()
   setShow(false)
   setNotice('Access key updated. Use the new key the next time you sign in.')
  } catch (failure) { setError(failure.message) }
  finally { setBusy(false) }
 }

 return <section className="panel staff-password-panel"><h2>Change access key</h2><p>Choose a password you can remember. Your current key stops working as soon as this change is saved.</p>
  <form onSubmit={change}><fieldset disabled={busy}>
   <label>Current access key<input name="currentKey" type={show ? 'text' : 'password'} required autoComplete="current-password" maxLength={256} /></label>
   <label>New access key<input name="newKey" type={show ? 'text' : 'password'} required minLength={10} maxLength={32} autoComplete="new-password" aria-describedby="staff-password-hint" /></label>
   <small id="staff-password-hint">{passwordHint}</small>
   <label>Confirm new access key<input name="confirmKey" type={show ? 'text' : 'password'} required minLength={10} maxLength={32} autoComplete="new-password" /></label>
   <label className="staff-password-reveal"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> Show access keys</label>
   <button className="primary" disabled={busy}>{busy ? 'Updating…' : 'Update access key'}</button>
  </fieldset></form>
  {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
 </section>
}
