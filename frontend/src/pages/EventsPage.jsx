
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'

function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const filterValues = {
    category: searchParams.get('category') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    available: searchParams.get('available') === 'true',
  }
  const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const searchKey = searchParams.toString()

  useEffect(() => {
    let cancelled = false
    api.get('/categories')
      .then((response) => {
        if (!cancelled) setCategories(response.data.items || [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      setLoading(true)
      setError('')

      try {
        const params = Object.fromEntries(new URLSearchParams(searchKey).entries())

        const response = await api.get('/events', { params })

        if (!cancelled) {
          setEvents(response.data.items || [])
          setTotal(response.data.total || 0)
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
  }, [searchKey])


  function updateFilters(updates, resetPage = true) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === false || value == null) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const next = event.currentTarget.elements.q.value.trim()

    if (next) {
      updateFilters({ q: next })
    } else {
      updateFilters({ q: '' })
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
          key={searchKey}
          name="q"
          defaultValue={searchParams.get('q') || ''}
        />
        <button type="submit">Search</button>
      </form>

      <div className="events-filters" aria-label="Filter events">
        <label>
          Category
          <select aria-label="Category" value={filterValues.category}
            onChange={(event) => updateFilters({ category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input aria-label="From date" type="date" value={filterValues.from}
            onChange={(event) => updateFilters({ from: event.target.value })} />
        </label>
        <label>
          To
          <input aria-label="To date" type="date" value={filterValues.to}
            onChange={(event) => updateFilters({ to: event.target.value })} />
        </label>
        <label className="available-filter">
          <input type="checkbox" checked={filterValues.available}
            onChange={(event) => updateFilters({ available: event.target.checked })} />
          Seats available
        </label>
      </div>

      {loading && <p role="status">Loading eventsâ€¦</p>}
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
                  ? new Date(item.startAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
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

      {!loading && !error && total > 0 && (
        <nav className="event-pagination" aria-label="Event pages">
          <button type="button" className="secondary-button" disabled={page <= 1}
            onClick={() => updateFilters({ page: page - 1 }, false)}>Previous</button>
          <span>Page {page} of {Math.ceil(total / 10)} · {total} events</span>
          <button type="button" className="secondary-button" disabled={page * 10 >= total}
            onClick={() => updateFilters({ page: page + 1 }, false)}>Next</button>
        </nav>
      )}
    </section>
  )
}

export default EventsPage
