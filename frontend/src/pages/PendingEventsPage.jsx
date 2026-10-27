
import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'

function PendingEventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState({})

  const loadEvents = useCallback(async () => {
    setError('')

    try {
      const response = await api.get('/events/pending')
      setEvents(response.data.items || [])
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Could not load pending events. Sign in with an Admin account and try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchPendingEvents() {
      try {
        const response = await api.get('/events/pending')

        if (!cancelled) {
          setEvents(response.data.items || [])
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              'Could not load pending events. Sign in with an Admin account and try again.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPendingEvents()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleDecision(eventId, decision) {
    setError('')
    setMessage('')

    const reason = (rejectionReasons[eventId] || '').trim()

    if (decision === 'reject' && reason.length < 10) {
      setError('For rejection, enter a reason of at least 10 characters.')
      return
    }

    setBusyId(eventId)

    try {
      await api.patch(`/events/${eventId}/approval`, {
        decision,
        ...(decision === 'reject' ? { reason } : {}),
      })

      setEvents((current) =>
        current.filter((event) => event._id !== eventId),
      )

      setMessage(
        decision === 'approve'
          ? 'Event approved and published.'
          : 'Event rejected.',
      )
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Could not update this event. Please try again.',
      )
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="management-page">
      <div className="management-heading">
        <p className="eyebrow">ADMIN WORKSPACE</p>
        <h1>Pending event approvals</h1>
        <p>
          Review event details before publishing them to the public event list.
        </p>
      </div>

      <div className="management-toolbar">
        <span>
          {events.length} pending {events.length === 1 ? 'event' : 'events'}
        </span>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setLoading(true)
            loadEvents()
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {message && (
        <p className="management-message success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="management-message error" role="alert">
          {error}
        </p>
      )}

      {loading && <p role="status">Loading pending events…</p>}

      {!loading && !error && events.length === 0 && (
        <div className="management-empty">
          <h2>No pending events</h2>
          <p>New event submissions will appear here for review.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="pending-event-list">
          {events.map((event) => (
            <article className="pending-event-card" key={event._id}>
              <div className="pending-event-top">
                <div>
                  <span className="pending-status">Pending approval</span>
                  <h2>{event.title}</h2>
                </div>

                <span className="pending-capacity">
                  Capacity: {event.capacity}
                </span>
              </div>

              <p className="pending-event-description">
                {event.description}
              </p>

              <dl className="pending-event-details">
                <div>
                  <dt>Venue</dt>
                  <dd>{event.venue || 'Not specified'}</dd>
                </div>

                <div>
                  <dt>Starts</dt>
                  <dd>
                    {event.startAt
                      ? new Date(event.startAt).toLocaleString()
                      : 'Not specified'}
                  </dd>
                </div>

                <div>
                  <dt>Ends</dt>
                  <dd>
                    {event.endAt
                      ? new Date(event.endAt).toLocaleString()
                      : 'Not specified'}
                  </dd>
                </div>

                <div>
                  <dt>Registration deadline</dt>
                  <dd>
                    {event.registrationDeadline
                      ? new Date(event.registrationDeadline).toLocaleString()
                      : 'Not specified'}
                  </dd>
                </div>
              </dl>

              <label className="rejection-reason">
                Rejection reason (required when rejecting)
                <textarea
                  rows={2}
                  minLength={10}
                  value={rejectionReasons[event._id] || ''}
                  onChange={(event) =>
                    setRejectionReasons((current) => ({
                      ...current,
                      [event._id]: event.target.value,
                    }))
                  }
                  placeholder="Explain why this event cannot be approved"
                />
              </label>

              <div className="pending-event-actions">
                <button
                  type="button"
                  onClick={() => handleDecision(event._id, 'approve')}
                  disabled={Boolean(busyId)}
                >
                  {busyId === event._id ? 'Processing…' : 'Approve event'}
                </button>

                <button
                  type="button"
                  className="reject-button"
                  onClick={() => handleDecision(event._id, 'reject')}
                  disabled={Boolean(busyId)}
                >
                  {busyId === event._id ? 'Processing…' : 'Reject event'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default PendingEventsPage
