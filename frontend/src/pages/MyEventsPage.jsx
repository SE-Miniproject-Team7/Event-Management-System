import { useEffect, useState } from 'react'
import api from '../services/api'

const fields = [
  ['title', 'Title', 'text'],
  ['description', 'Description', 'textarea'],
  ['venue', 'Venue', 'text'],
  ['startAt', 'Start date and time', 'datetime-local'],
  ['endAt', 'End date and time', 'datetime-local'],
  ['registrationDeadline', 'Registration deadline', 'datetime-local'],
  ['capacity', 'Capacity', 'number'],
]
const localDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export default function MyEventsPage() {
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadEvents() {
    const response = await api.get('/events/mine')
    setEvents(response.data.items || [])
  }

  useEffect(() => {
    let active = true
    Promise.all([api.get('/events/mine'), api.get('/categories')])
      .then(([eventResponse, categoryResponse]) => {
        if (!active) return
        setEvents(eventResponse.data.items || [])
        setCategories(categoryResponse.data.items || [])
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error?.message || 'Unable to load your events.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function edit(event) {
    setSelected(event)
    setForm({
      title: event.title || '',
      description: event.description || '',
      venue: event.venue || '',
      startAt: localDate(event.startAt),
      endAt: localDate(event.endAt),
      registrationDeadline: localDate(event.registrationDeadline),
      capacity: String(event.capacity ?? ''),
      categoryId: String(event.categoryId?._id || event.categoryId || ''),
    })
    setError('')
    setMessage('')
  }

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
        capacity: Number(form.capacity),
      }
      await api.patch('/events/' + selected._id, payload)
      await loadEvents()
      setSelected(null)
      setMessage('Event updated. Published events return to the admin approval queue.')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Unable to update event.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelEvent(item) {
    const confirmed = window.confirm(
      `Cancel "${item.title}"? All active registrations will be cancelled, and attendees will no longer be able to check in.`
    )
    if (!confirmed) return

    setCancellingId(item._id)
    setError('')
    setMessage('')
    try {
      const response = await api.post(`/events/${item._id}/cancel`)
      await loadEvents()
      setSelected((current) => current?._id === item._id ? null : current)
      const count = response.data.cancelledRegistrations ?? 0
      setMessage(`Event cancelled successfully. ${count} active registration(s) were cancelled.`)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Unable to cancel event.')
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) return <p role="status">Loading your events…</p>
  return (
    <section style={{ width: '100%', maxWidth: 900 }}>
      <p className="eyebrow">ORGANIZER</p>
      <h1>My events</h1>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!events.length && <p>You have not created any events yet.</p>}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {events.map((item) => {
          const future = item.startAt && new Date(item.startAt) > new Date()
          const editable = !['Cancelled', 'Rejected'].includes(item.status) && future
          const cancellable = item.status === 'Published' && future
          return <article key={item._id} style={{ padding: '1rem', border: '1px solid #dbe3ef', borderRadius: 12 }}>
            <h2>{item.title}</h2>
            <p>{item.status} · {item.venue}</p>
            <p>{item.startAt ? new Date(item.startAt).toLocaleString() : 'Date not set'}</p>
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
              {editable && <button type="button" onClick={() => edit(item)}>Edit event</button>}
              {cancellable && <button
                type="button"
                onClick={() => cancelEvent(item)}
                disabled={cancellingId !== null || saving}
                aria-label={`Cancel ${item.title}`}
              >
                {cancellingId === item._id ? 'Cancelling…' : 'Cancel event'}
              </button>}
            </div>
          </article>
        })}
      </div>
      {selected && <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', marginTop: '2rem', padding: '1.25rem', border: '1px solid #dbe3ef', borderRadius: 12 }}>
        <h2>Edit {selected.title}</h2>
        {fields.map(([name, label, type]) => <label key={name} style={{ display: 'grid', gap: '.35rem' }}>
          {label}
          {type === 'textarea'
            ? <textarea required rows={4} value={form[name]} onChange={(e) => change(name, e.target.value)} />
            : <input required type={type} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 10000 : undefined} value={form[name]} onChange={(e) => change(name, e.target.value)} />}
        </label>)}
        <label style={{ display: 'grid', gap: '.35rem' }}>Category
          <select required value={form.categoryId} onChange={(e) => change('categoryId', e.target.value)}>
            <option value="">Choose category</option>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button type="submit" disabled={saving || cancellingId !== null}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" disabled={saving || cancellingId !== null} onClick={() => setSelected(null)}>Cancel editing</button>
        </div>
      </form>}
    </section>
  )
}
