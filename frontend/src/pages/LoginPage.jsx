
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      })

      navigate('/', { replace: true })
    } catch (err) {
      const status = err.response?.status
      const code = err.response?.data?.error?.code
      const message = err.response?.data?.message

      if (status === 423 || code === 'ACCOUNT_LOCKED') {
        setError(message || 'Your account is temporarily locked. Please try again later.')
      } else if (status === 401) {
        setError('Email or password is incorrect.')
      } else {
        setError(message || 'Unable to sign in. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Sign in</h1>
      <p className="auth-description">
        Sign in to continue to Event Management System.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <label htmlFor="login-password">Password</label>
        <div className="password-field">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </section>
  )
}

export default LoginPage
