
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'

function EventDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [registrationError, setRegistrationError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadEvent() {
      try {
        const response = await api.get(`/events/${id}`)

        if (!cancelled) {
          setEvent(response.data.event)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              'Unable to load this event. Please try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEvent()

    return () => {
      cancelled = true
    }
  }, [id])

  async function handleRegister() {
    setRegistering(true)
    setRegistrationMessage('')
    setRegistrationError('')

    try {
      const response = await api.post(`/events/${id}/registrations`)
      const result = response.data

      if (result.status === 'Waitlisted') {
        setRegistrationMessage(
          `You have been added to the waitlist. Your position is ${
            result.waitlistPosition ?? 'not available'
          }.`,
        )
      } else {
        setRegistrationMessage(
          `Registration successful! Your registration code is ${
            result.regCode || 'not available'
          }.`,
        )
      }
    } catch (err) {
      const status = err.response?.status
      const code = err.response?.data?.error?.code
      const message =
        err.response?.data?.error?.message ||
        'Registration failed. Please try again.'

      if (status === 401) {
        navigate('/login', { state: { from: `/events/${id}` } })
        return
      }

      if (status === 403) {
        setRegistrationError(
          'Only attendee accounts can register for events. Please sign in with an attendee account.',
        )
      } else if (status === 409 && code === 'DUPLICATE_REGISTRATION') {
        setRegistrationError('You are already registered for this event.')
      } else if (status === 409 && code === 'EVENT_CLOSED') {
        setRegistrationError('Registration for this event is closed.')
      } else {
        setRegistrationError(message)
      }
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return <p role="status">Loading event details...</p>
  }

  if (error || !event) {
    return (
      <section className="event-details-page">
        <h1>Event unavailable</h1>
        <p role="alert">{error || 'This event could not be found.'}</p>
        <Link to="/events">Back to events</Link>
      </section>
    )
  }

  return (
    <section className="event-details-page">
      <Link to="/events">&larr; Back to events</Link>

      <p className="eyebrow">EVENT DETAILS</p>
      <h1>{event.title}</h1>

      <p>{event.description || 'No description available.'}</p>
      <p>
        <strong>Venue:</strong> {event.venue || 'To be announced'}
      </p>

      <p>
        <strong>Starts:</strong>{' '}
        {event.startAt
          ? new Date(event.startAt).toLocaleString()
          : 'To be announced'}
      </p>

      <p>
        <strong>Ends:</strong>{' '}
        {event.endAt
          ? new Date(event.endAt).toLocaleString()
          : 'To be announced'}
      </p>

      <p>
        <strong>Seats remaining:</strong> {responseSeats(event)}
      </p>

      <button
        type="button"
        onClick={handleRegister}
        disabled={registering}
      >
        {registering ? 'Registering...' : 'Register for Event'}
      </button>

      {registrationMessage && (
        <p role="status">{registrationMessage}</p>
      )}

      {registrationError && (
        <p role="alert">{registrationError}</p>
      )}
    </section>
  )
}

function responseSeats(event) {
  return event.remainingSeats ?? 'Not available'
}

export default EventDetailsPage
