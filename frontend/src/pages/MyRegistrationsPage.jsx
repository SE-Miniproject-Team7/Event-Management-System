import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function MyRegistrationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cancellingId, setCancellingId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadRegistrations() {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/registrations/me')
        if (!cancelled) {
          setItems(response.data.items || [])
          setCurrentTime(Date.now())
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              'Unable to load your registrations. Please try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRegistrations()
    return () => { cancelled = true }
  }, [refreshKey])

  async function cancelRegistration(item) {
    const eventName = item.event?.title || 'this event'
    if (!window.confirm(`Cancel your registration for ${eventName}?`)) return

    setCancellingId(item._id)
    setError('')
    setMessage('')
    try {
      await api.delete(`/registrations/${item._id}`)
      setMessage(`Your registration for ${eventName} was cancelled.`)
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Unable to cancel this registration. Please try again.',
      )
    } finally {
      setCancellingId('')
    }
  }

  return (
    <section className="my-registrations-page">
      <div className="management-heading">
        <p className="eyebrow">ATTENDEE</p>
        <h1>My registrations</h1>
        <p>Review your event registrations, waitlist positions, and check-in passes.</p>
      </div>

      {loading && <p role="status">Loading your registrations…</p>}
      {error && <p className="event-message error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="event-empty">
          <h2>No registrations yet</h2>
          <p>Explore upcoming events and register for one to see it here.</p>
          <Link to="/events">Explore events</Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="registration-list">
          {items.map((item) => {
            const event = item.event
            const canCancel = ['Confirmed', 'Waitlisted'].includes(item.status) &&
              event?.startAt && currentTime > 0 && new Date(event.startAt).getTime() > currentTime
            const statusClass = item.status.toLowerCase().replace(/[^a-z]+/g, '-')

            return (
              <li className="registration-card" key={item._id}>
                <div className="registration-card__details">
                  <h2>{event?.title || 'Event unavailable'}</h2>
                  <p><strong>Starts:</strong> <time dateTime={event?.startAt}>{formatDate(event?.startAt)} (IST)</time></p>
                  {event?.venue && <p><strong>Venue:</strong> {event.venue}</p>}
                  <p>
                    <strong>Status:</strong>{' '}
                    <span className={`registration-status ${statusClass}`}>{item.status}</span>
                  </p>
                  {item.status === 'Waitlisted' && (
                    <p><strong>Waitlist position:</strong> {item.waitlistPosition ?? 'Unavailable'}</p>
                  )}
                  {item.regCode && <p><strong>Registration code:</strong> {item.regCode}</p>}
                  {canCancel && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={cancellingId === item._id}
                      onClick={() => cancelRegistration(item)}
                    >
                      {cancellingId === item._id ? 'Cancelling…' : `Cancel registration for ${event.title}`}
                    </button>
                  )}
                </div>
                {item.regCode && ['Confirmed', 'Checked-in'].includes(item.status) && (
                  <QRCodeSVG
                    value={item.regCode}
                    title={`Check-in QR code for ${event?.title || 'event'}`}
                    size={112}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default MyRegistrationsPage
