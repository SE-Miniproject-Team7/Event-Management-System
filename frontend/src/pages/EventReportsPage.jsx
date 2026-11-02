
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'
import './EventReportsPage.css'

function formatDate(value) {
  if (!value) return '—'

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function StatCard({ label, value, description, isPercentage = false }) {
  const displayValue = isPercentage
    ? `${Number(value || 0).toFixed(2)}%`
    : Number(value || 0).toLocaleString('en-IN')

  return (
    <article className="report-stat">
      <p>{label}</p>
      <strong>{displayValue}</strong>
      <span>{description}</span>
    </article>
  )
}

export default function EventReportsPage({ user, checkingAuth }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [report, setReport] = useState(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  const isOrganizer = user?.role === 'Organizer'

  useEffect(() => {
    if (!isOrganizer || checkingAuth) return

    let active = true

    api.get('/events/mine')
      .then(response => {
        if (!active) return

        const items = response.data?.items || []
        setEvents(items)
      })
      .catch(err => {
        if (active) {
          setError(
            err.response?.data?.error?.message ||
            'Could not load your events. Please try again.'
          )
        }
      })
      .finally(() => {
        if (active) setLoadingEvents(false)
      })

    return () => {
      active = false
    }
  }, [isOrganizer, checkingAuth, revision])

  useEffect(() => {
    if (!eventId || !isOrganizer || checkingAuth) return

    let active = true

    api.get(`/events/${eventId}/report`)
      .then(response => {
        if (active) setReport(response.data)
      })
      .catch(err => {
        if (active) {
          setError(
            err.response?.data?.error?.message ||
            'Could not load this event report.'
          )
        }
      })

    return () => {
      active = false
    }
  }, [eventId, isOrganizer, checkingAuth, revision])
  function refresh() {
    setReport(null)
    setError('')
    setLoadingEvents(true)
    setRevision(value => value + 1)
  }

  async function downloadCSV() {
    if (!eventId || downloading) return

    setDownloading(true)
    setError('')

    try {
      const response = await api.get(
        `/events/${eventId}/report.csv`,
        { responseType: 'blob' }
      )

      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `event-report-${eventId}.csv`

      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        'Could not download the CSV report.'
      )
    } finally {
      setDownloading(false)
    }
  }

  if (checkingAuth) {
    return <p role="status">Checking account access...</p>
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/organizer/reports' }}
      />
    )
  }

  if (!isOrganizer) {
    return (
      <p role="alert">
        Only organizers can view event reports.
      </p>
    )
  }

  const summary = report?.summary
  const registrations = report?.registrations || []

  return (
    <section className="management-page event-reports-page">
      <header className="report-heading">
        <div>
          <p className="eyebrow">ORGANIZER</p>
          <h1>Event attendance reports</h1>
          <p>
            Review registration activity, attendance and attendee
            details for your events.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={refresh}
          disabled={loadingEvents}
        >
          {loadingEvents ? 'Loading...' : 'Refresh events'}
        </button>
      </header>

      {error && (
        <p role="alert" className="management-message error">
          {error}
        </p>
      )}

      <div className="report-selector">
        <label htmlFor="report-event">Select your event</label>

        {loadingEvents ? (
          <p role="status">Loading your events...</p>
        ) : (
          <select
            id="report-event"
            value={eventId}
            onChange={event => {
              setEventId(event.target.value)
              setReport(null)
              setError('')
            }}
          >
            <option value="">Choose an event</option>
            {events.map(event => (
              <option key={event._id} value={event._id}>
                {event.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {!loadingEvents && events.length === 0 && (
        <p className="management-empty">
          You haven't created any events yet.
        </p>
      )}

      {eventId && !report && !error && (
        <p role="status">Loading attendance report...</p>
      )}

      {report && summary && (
        <>
          <section className="report-event-details">
            <div>
              <h2>{report.event.title}</h2>
              <p>{report.event.venue}</p>
            </div>

            <div>
              <span>Event starts</span>
              <strong>{formatDate(report.event.startAt)}</strong>
            </div>

            <div>
              <span>Event ends</span>
              <strong>{formatDate(report.event.endAt)}</strong>
            </div>

            <div>
              <span>Capacity</span>
              <strong>{report.event.capacity}</strong>
            </div>
          </section>

          <section
            className="report-stat-grid"
            aria-label="Attendance statistics"
          >
            <StatCard
              label="Confirmed"
              value={summary.confirmed}
              description="Awaiting check-in"
            />

            <StatCard
              label="Checked in"
              value={summary.checkedIn}
              description="Attendance recorded"
            />

            <StatCard
              label="Waitlisted"
              value={summary.waitlisted}
              description="Waiting for a seat"
            />

            <StatCard
              label="Cancelled"
              value={summary.cancelled}
              description="Cancelled registrations"
            />

            <StatCard
              label="Attendance rate"
              value={summary.attendanceRate}
              isPercentage
              description="Of confirmed and checked-in registrations"
            />
          </section>

          <section className="report-registration-section">
            <div className="report-table-heading">
              <div>
                <h2>Attendee registrations</h2>
                <p>
                  {registrations.length} registration records
                </p>
              </div>

              <button
                type="button"
                className="report-download-button"
                onClick={downloadCSV}
                disabled={downloading}
              >
                {downloading ? 'Preparing CSV...' : 'Download CSV'}
              </button>
            </div>

            {registrations.length === 0 ? (
              <p className="management-empty">
                No registrations found for this event.
              </p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">Attendee</th>
                      <th scope="col">Email</th>
                      <th scope="col">Registration code</th>
                      <th scope="col">Status</th>
                      <th scope="col">Registered at</th>
                      <th scope="col">Checked in at</th>
                    </tr>
                  </thead>

                  <tbody>
                    {registrations.map(registration => (
                      <tr key={registration.registrationId}>
                        <td>{registration.attendeeName || '—'}</td>
                        <td>{registration.attendeeEmail || '—'}</td>
                        <td>
                          <code>{registration.regCode}</code>
                        </td>
                        <td>
                          <span
                            className={`report-status ${registration.status
                              .toLowerCase()
                              .replace(/[^a-z]+/g, '-')}`}
                          >
                            {registration.status}
                          </span>
                        </td>
                        <td>{formatDate(registration.registeredAt)}</td>
                        <td>{formatDate(registration.checkedInAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
