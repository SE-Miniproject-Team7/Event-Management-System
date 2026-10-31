import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import QrScanner from '../components/QrScanner'
import api from '../services/api'
import './CheckInPage.css'
const validCode = value => /^[A-Za-z0-9-]{1,100}$/.test(value.trim())
const time = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
export default function CheckInPage({ user, checkingAuth }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const imageOperation = useRef(0)
  const input = useRef(null)
  const isOrganizer = user?.role === 'Organizer'
  useEffect(() => {
    if (!isOrganizer || checkingAuth) return
    let active = true
    api.get('/events/mine').then(response => {
      if (active) setEvents(response.data.items.filter(event => event.status === 'Published'))
    }).catch(err => {
      if (active) setError(err.response?.data?.error?.message || 'Could not load your events. Please try again.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isOrganizer, checkingAuth, revision])
  useEffect(() => () => { imageOperation.current += 1 }, [])
  const acceptCode = useCallback(value => {
    setCamera(false)
    if (!validCode(value)) {
      setError('This QR code does not contain a valid EMS registration code.')
      return
    }
    setCode(value.trim())
    setError('')
    setMessage('QR code read. Confirm the selected event, then check in.')
  }, [])
  async function readImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPEG or WebP QR image no larger than 5 MB.')
      return
    }
    const operation = ++imageOperation.current
    setReading(true)
    setError('')
    setMessage('')
    const url = URL.createObjectURL(file)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url)
      if (imageOperation.current === operation) acceptCode(result.getText())
    } catch {
      if (imageOperation.current === operation) setError('No readable QR code found. Try a clearer image or enter the code.')
    } finally {
      URL.revokeObjectURL(url)
      if (imageOperation.current === operation) setReading(false)
    }
  }
  async function submit(event) {
    event.preventDefault()
    if (busy || reading) return
    if (!eventId || !validCode(code)) {
      setError('Choose an event and enter a valid registration code.')
      return
    }
    setCamera(false)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await api.post(`/events/${eventId}/checkin`, { regCode: code.trim() })
      setMessage(`Checked in ${response.data.regCode} at ${time(response.data.checkedInAt)} IST.`)
      setCode('')
      input.current?.focus()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Check-in failed. Please try again.')
    } finally { setBusy(false) }
  }
  if (checkingAuth) return <p role="status">Checking account access...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: '/organizer/checkin' }} />
  if (!isOrganizer) return <p role="alert">Only organizers can check in attendees.</p>
  const selected = events.find(event => event._id === eventId)
  return <section className="management-page checkin-page">
    <p className="eyebrow">ORGANIZER</p><h1>Attendee check-in</h1>
    <p>Check-in opens one hour before an event starts and closes when it ends. Only confirmed registrations are eligible.</p>
    {error && <p role="alert" className="management-message error">{error}</p>}
    {message && <p role="status" className="management-message success">{message}</p>}
    {loading ? <p role="status">Loading your events...</p> : <>
      {events.length === 0 ? <p>No published events available for check-in.</p> : <form className="checkin-form" onSubmit={submit}>
        <label htmlFor="checkin-event">Your event</label>
        <select id="checkin-event" required value={eventId} disabled={busy || reading}
          onChange={event => { setEventId(event.target.value); setCamera(false); setMessage(''); setError(''); setCode('') }}>
          <option value="">Choose a published event</option>
          {events.map(event => <option key={event._id} value={event._id}>{event.title} — {time(event.startAt)} IST</option>)}
        </select>
        {selected && <p className="checkin-window">Window: {time(new Date(selected.startAt).getTime() - 3600000)} to {time(selected.endAt)} IST</p>}
        <label htmlFor="checkin-code">Registration code</label>
        <input ref={input} id="checkin-code" value={code} maxLength={100} required autoComplete="off"
          placeholder="REG-ABC123" disabled={busy || reading} onChange={event => setCode(event.target.value)} />
        <button type="submit" disabled={busy || reading || !eventId || !code.trim()}>{busy ? 'Checking in...' : 'Check in attendee'}</button>
      </form>}
      <div className="checkin-tools">
        <button type="button" className="secondary-button" disabled={!eventId || busy || reading} onClick={() => setCamera(value => !value)}>{camera ? 'Stop camera' : 'Scan QR with camera'}</button>
        <label htmlFor="checkin-image">Or upload a QR image (PNG, JPEG, WebP; max 5 MB)</label>
        <input id="checkin-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={!eventId || busy || reading || camera} onChange={readImage} />
        {reading && <p role="status">Reading QR image...</p>}
      </div>
      {camera && <QrScanner onDecoded={acceptCode} />}
      <button type="button" className="secondary-button" disabled={busy || reading} onClick={() => { setLoading(true); setError(''); setCamera(false); setRevision(value => value + 1) }}>Reload events</button>
    </>}
  </section>
}
