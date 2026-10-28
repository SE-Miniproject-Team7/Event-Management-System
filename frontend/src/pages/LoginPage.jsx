
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'

function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function clearMessage() {
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setMessage('Please enter your email address and password.')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        email: cleanEmail,
        password,
      })

      const loggedInUser = response.data?.user

      if (!loggedInUser) {
        setMessage('Login response was unexpected. Please try again.')
        return
      }

      // Update the user state in App.jsx.
      onLoginSuccess?.(loggedInUser)

      // Return to a valid local destination, or go home.
      const requestedPath = location.state?.from
      const destination =
        typeof requestedPath === 'string' &&
        requestedPath.startsWith('/') &&
        !requestedPath.startsWith('//')
          ? requestedPath
          : '/'

      navigate(destination, { replace: true })
    } catch (err) {
      const status = err.response?.status
      const errorData = err.response?.data?.error
      const code = errorData?.code
      const serverMessage = errorData?.message

      if (!err.response) {
        setMessage(
          'Cannot connect to the server. Make sure the backend is running on port 5000.',
        )
      } else if (status === 401 || code === 'INVALID_CREDENTIALS') {
        setMessage('Incorrect email or password. Please try again.')
      } else if (status === 423 || code === 'ACCOUNT_LOCKED') {
        setMessage(
          serverMessage ||
            'Your account is temporarily locked. Please try again later.',
        )
      } else if (status === 404) {
        setMessage('Login endpoint not found. Please check the backend API route.')
      } else {
        setMessage(serverMessage || 'Unable to sign in. Please try again.')
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
        Sign in to your Event Management System account.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            clearMessage()
          }}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            clearMessage()
          }}
          required
        />

        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  )
}

export default LoginPage
