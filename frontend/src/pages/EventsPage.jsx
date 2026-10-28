
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'

function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      setLoading(true)
      setError('')

      try {
        const params = {}
        const search = searchParams.get('q')
        if (search) params.q = search

        const response = await api.get('/events', { params })

        if (!cancelled) {
          setEvents(response.data.items || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              'Unable to load events. Please try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEvents()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  function handleSubmit(event) {
    event.preventDefault()
    const next = query.trim()

    if (next) {
      setSearchParams({ q: next })
    } else {
      setSearchParams({})
    }
  }

  return (
    <section className="events-page">
      <div className="events-heading">
        <p className="eyebrow">DISCOVER EMS</p>
        <h1>Find your next event</h1>
        <p>Explore upcoming events and find something worth showing up for.</p>
      </div>

      <form className="event-search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="event-search">
          Search events
        </label>
        <input
          id="event-search"
          type="search"
          placeholder="Search by event name or description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p role="status">Loading events…</p>}
      {error && <p className="event-message error" role="alert">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="event-empty">
          <h2>No events found</h2>
          <p>Try another search, or check back later for upcoming events.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((item) => (
            <article className="event-card" key={item._id}>
              <p className="event-date">
                {item.startAt
                  ? new Date(item.startAt).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Date to be announced'}
              </p>
              <h2>{item.title}</h2>
              <p className="event-venue">{item.venue}</p>
              <p className="event-description">{item.description}</p>
              <p className="event-seats">
                {item.remainingSeats ?? item.capacity - item.seatsTaken} seats
                remaining
              </p>
              <Link className="event-details-link" to={`/events/${item._id}`}>
                View details
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default EventsPage
