
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange() {
    setMessage('')
    setSuccess(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setMessage('The passwords do not match.')
      return
    }

    if (password.length < 8 || password.length > 128) {
      setMessage('Password must be between 8 and 128 characters.')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      })

      setSuccess(true)
      setMessage(
        response.data?.message ||
          'Account created successfully. You can now sign in.',
      )
    } catch (err) {
      const status = err.response?.status
      const code = err.response?.data?.error?.code
      const fields = err.response?.data?.error?.fields
      const serverMessage = err.response?.data?.error?.message

      if (status === 409 || code === 'EMAIL_ALREADY_EXISTS') {
        setMessage('An account with this email already exists.')
      } else if (code === 'VALIDATION_ERROR' && fields) {
        setMessage(Object.values(fields).join(' '))
      } else {
        setMessage(
          serverMessage || 'Unable to create your account. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">JOIN EMS</p>
      <h1>Create an account</h1>
      <p className="auth-description">
        Create your attendee account to get started.
      </p>

      {success ? (
        <>
          <p className="form-success" role="status">
            {message}
          </p>
          <button
            className="auth-submit"
            type="button"
            onClick={() => navigate('/login')}
          >
            Go to sign in
          </button>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              handleChange()
            }}
            maxLength={100}
            required
          />

          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              handleChange()
            }}
            required
          />

          <label htmlFor="register-phone">Phone number (optional)</label>
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              handleChange()
            }}
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              handleChange()
            }}
            minLength={8}
            maxLength={128}
            required
          />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              handleChange()
            }}
            minLength={8}
            maxLength={128}
            required
          />

          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating accountΓÇª' : 'Create account'}
          </button>
        </form>
      )}

      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}

export default RegisterPage
