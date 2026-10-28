
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
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function clearMessage() {
    setMessage('')
    setFieldErrors({})
    setSuccess(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    clearMessage()

    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = phone.trim()

    const errors = {}

    if (cleanName.length < 3 || cleanName.length > 60) {
      errors.name = 'Name must be between 3 and 60 characters.'
    }
    if (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid email address of at most 100 characters.'
    }
    if (cleanPhone && !/^[0-9]{10}$/.test(cleanPhone)) {
      errors.phone = 'Phone number must contain exactly 10 digits.'
    }
    if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = 'Password must be 8 to 64 characters and include a letter and a digit.'
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'The passwords do not match.'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/register', {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
      })

      setSuccess(true)
      setMessage(
        response.data?.message ||
          'Account created successfully. You can now sign in.',
      )
    } catch (err) {
      const status = err.response?.status
      const errorData = err.response?.data?.error
      const code = errorData?.code
      const fields = errorData?.fields
      const serverMessage = errorData?.message

      if (status === 409 || code === 'EMAIL_ALREADY_EXISTS') {
        setMessage('An account with this email already exists.')
      } else if (code === 'VALIDATION_ERROR' && fields) {
        if (Array.isArray(fields)) {
          setFieldErrors(Object.fromEntries(fields.map(({ field, message }) => [field, message])))
        }
        setMessage(serverMessage || 'Please check your details and try again.')
      } else if (status === 404) {
        setMessage(
          'Registration endpoint not found. Please check the backend API route.',
        )
      } else if (!err.response) {
        setMessage(
          'Cannot connect to the server. Make sure the backend is running on port 5000.',
        )
      } else {
        setMessage(
          serverMessage ||
            'Unable to create your account. Please try again.',
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
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              clearMessage()
            }}
            minLength={3}
            maxLength={60}
            required
          />
          {fieldErrors.name && (
            <p id="register-name-error" className="form-error" role="alert">
              {fieldErrors.name}
            </p>
          )}

          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
            type="email"
            maxLength={100}
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              clearMessage()
            }}
            required
          />
          {fieldErrors.email && (
            <p id="register-email-error" className="form-error" role="alert">
              {fieldErrors.email}
            </p>
          )}

          <label htmlFor="register-phone">Phone number (optional)</label>
          <input
            id="register-phone"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? 'register-phone-error' : undefined}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            autoComplete="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              clearMessage()
            }}
          />
          {fieldErrors.phone && (
            <p id="register-phone-error" className="form-error" role="alert">
              {fieldErrors.phone}
            </p>
          )}

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              clearMessage()
            }}
            minLength={8}
            maxLength={64}
            required
          />
          {fieldErrors.password && (
            <p id="register-password-error" className="form-error" role="alert">
              {fieldErrors.password}
            </p>
          )}

          <label htmlFor="register-confirm-password">
            Confirm password
          </label>
          <input
            id="register-confirm-password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              clearMessage()
            }}
            minLength={8}
            maxLength={64}
            required
          />
          {fieldErrors.confirmPassword && (
            <p id="register-confirm-password-error" className="form-error" role="alert">
              {fieldErrors.confirmPassword}
            </p>
          )}

          {message && (
            <p
              className="form-error"
              role="alert"
            >
              {message}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
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
