
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'

function EventDetailsPage() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  if (loading) return <p role="status">Loading event details...</p>

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
      <Link to="/events">← Back to events</Link>

      <p className="eyebrow">EVENT DETAILS</p>
      <h1>{event.title}</h1>

      <p>{event.description || 'No description available.'}</p>
      <p><strong>Venue:</strong> {event.venue || 'To be announced'}</p>
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
        <strong>Seats remaining:</strong>{' '}
        {responseSeats(event)}
      </p>
    </section>
  )
}

function responseSeats(event) {
  return event.remainingSeats ?? 'Not available'
}

export default EventDetailsPage
