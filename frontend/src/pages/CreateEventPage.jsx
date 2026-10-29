
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const initialForm = {
  title: '',
  description: '',
  venue: '',
  startAt: '',
  endAt: '',
  registrationDeadline: '',
  capacity: '50',
  categoryId: '',
}

function CreateEventPage() {
  const [form, setForm] = useState(initialForm)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const response = await api.get('/categories')
        if (!cancelled) {
          const items = response.data.items || []
          setCategories(items)

          if (items.length > 0) {
            setForm((current) => ({
              ...current,
              categoryId: current.categoryId || items[0]._id,
            }))
          }
        }
      } catch {
        if (!cancelled) {
          setError('Could not load categories. Please try again.')
        }
      } finally {
        if (!cancelled) setLoadingCategories(false)
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const start = new Date(form.startAt)
    const end = new Date(form.endAt)
    const deadline = new Date(form.registrationDeadline)
    const capacity = Number(form.capacity)

    if (form.title.trim().length < 3) {
      setError('Event title must contain at least 3 characters.')
      return
    }

    if (
      !form.description.trim() ||
      !form.venue.trim() ||
      !form.categoryId
    ) {
      setError('Please complete all required fields.')
      return
    }

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setError('The event end date and time must be after the start.')
      return
    }

    if (
      Number.isNaN(deadline.getTime()) ||
      deadline > start
    ) {
      setError(
        'The registration deadline must be on or before the event start.',
      )
      return
    }

    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      setError('Capacity must be a whole number from 1 to 10000.')
      return
    }

    setSubmitting(true)

    try {
      await api.post('/events', {
        title: form.title.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        categoryId: form.categoryId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        registrationDeadline: deadline.toISOString(),
        capacity,
      })

      setSuccess(
        'Event submitted successfully! It is waiting for admin approval.',
      )
      setForm(initialForm)
    } catch (err) {
      const details = err.response?.data?.error?.fields
      const detailMessage = Array.isArray(details)
        ? details.map((item) => item.message).join('. ')
        : ''

      setError(
        detailMessage ||
          err.response?.data?.error?.message ||
          'Could not submit the event. Make sure you are signed in with an Organizer account.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="management-page">
      <div className="management-heading">
        <p className="eyebrow">ORGANIZER WORKSPACE</p>
        <h1>Create an event</h1>
        <p>
          Enter your event details and submit them for admin approval.
          Your event will not be published until it is approved.
        </p>
      </div>

      {success && (
        <p className="management-message success" role="status">
          {success}
        </p>
      )}

      {error && (
        <p className="management-message error" role="alert">
          {error}
        </p>
      )}

      <form className="management-form" onSubmit={handleSubmit}>
        <label>
          Event title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            minLength={3}
            maxLength={150}
            required
            placeholder="e.g. Campus Tech Meetup"
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Describe your event"
          />
        </label>

        <label>
          Venue
          <input
            name="venue"
            value={form.venue}
            onChange={handleChange}
            required
            placeholder="Building, room, or address"
          />
        </label>

        <label>
          Category
          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            required
            disabled={loadingCategories || categories.length === 0}
          >
            <option value="">
              {loadingCategories
                ? 'Loading categories...'
                : 'Choose a category'}
            </option>

            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="management-form-grid">
          <label>
            Start date and time
            <input
              type="datetime-local"
              name="startAt"
              value={form.startAt}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            End date and time
            <input
              type="datetime-local"
              name="endAt"
              value={form.endAt}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <div className="management-form-grid">
          <label>
            Registration deadline
            <input
              type="datetime-local"
              name="registrationDeadline"
              value={form.registrationDeadline}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Capacity
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={handleChange}
              min="1"
              max="10000"
              step="1"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={
            submitting ||
            loadingCategories ||
            categories.length === 0
          }
        >
          {submitting ? 'Submitting...' : 'Submit for approval'}
        </button>

        {!loadingCategories && categories.length === 0 && (
          <p role="alert">
            No active categories are available. An admin needs to add
            a category before you can create an event.
          </p>
        )}
      </form>

      <p className="management-back">
        <Link to="/">Back to home</Link>
      </p>
    </section>
  )
}

export default CreateEventPage
