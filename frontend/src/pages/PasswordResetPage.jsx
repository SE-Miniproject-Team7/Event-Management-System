import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function PasswordResetPage({ reset = false }) {
  const [token, setToken] = useState(() => reset ? window.location.hash.slice(1) : '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    function updateLink() {
      setToken(reset ? window.location.hash.slice(1) : '')
      setMessage('')
      setError('')
    }
    window.addEventListener('hashchange', updateLink)
    return () => window.removeEventListener('hashchange', updateLink)
  }, [reset])
  async function submit(event) {
    event.preventDefault()
    setError('')
    if (reset && password !== confirmation) { setError('Passwords must match.'); return }
    setBusy(true)
    try {
      const response = await api.post(reset ? '/auth/reset-password' : '/auth/forgot-password',
        reset ? { token, newPassword: password } : { email })
      setMessage(response.data.message)
      setPassword('')
      setConfirmation('')
      if (reset) window.history.replaceState(null, '', window.location.pathname)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Unable to complete the request. Please try again.')
    } finally { setBusy(false) }
  }
  return <section className="auth-card">
    <h1>{reset ? 'Set a new password' : 'Forgot password'}</h1>
    {message ? <p role="status">{message}</p> : <form className="auth-form" onSubmit={submit}>
      {reset ? <>
        <p>Use 8–64 characters, including a letter and a digit.</p>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={password} onChange={e => setPassword(e.target.value)} />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      </> : <>
        <label htmlFor="reset-email">Email address</label>
        <input id="reset-email" type="email" autoComplete="email" required maxLength={100} value={email} onChange={e => setEmail(e.target.value)} />
      </>}
      {error && <p role="alert">{error}</p>}
      {reset && !/^[a-f0-9]{64}$/.test(token) && <p role="alert">Invalid reset link. Request a new one.</p>}
      <button className="auth-submit" disabled={busy || (reset && !/^[a-f0-9]{64}$/.test(token))}>{busy ? 'Please wait…' : reset ? 'Update password' : 'Send reset link'}</button>
    </form>}
    <p><Link to="/login">Sign in</Link> · <Link to="/forgot-password">Request a new link</Link></p>
  </section>
}
