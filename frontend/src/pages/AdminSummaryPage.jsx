import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'
import './AdminSummaryPage.css'

function CountGroup({ title, values }) {
  return <section className="summary-group" aria-label={title}>
    <h2>{title}</h2>
    <dl className="summary-counts">{Object.entries(values).map(([label, count]) =>
      <div key={label}><dt>{label}</dt><dd>{count.toLocaleString('en-IN')}</dd></div>
    )}</dl>
  </section>
}
function dayLabel(date) {
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  })
}
export default function AdminSummaryPage({ user, checkingAuth }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const isAdmin = user?.role === 'Admin'
  useEffect(() => {
    if (!isAdmin || checkingAuth) return
    let cancelled = false
    api.get('/admin/summary').then(response => {
      if (!cancelled) setSummary(response.data)
    }).catch(err => {
      if (!cancelled) setError(err.response?.data?.error?.message || 'Could not load the summary. Please try again.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAdmin, checkingAuth, revision])
  function refresh() {
    setLoading(true)
    setError('')
    setRevision(value => value + 1)
  }
  if (checkingAuth) return <p role="status">Checking account access...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: '/admin/summary' }} />
  if (!isAdmin) return <p role="alert">Only administrators can view the platform summary.</p>
  const days = summary?.registrationsPerDay || []
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const max = Math.max(1, ...days.map(day => day.count))
  return <section className="summary-page">
    <header className="summary-heading">
      <div><p className="eyebrow">ADMINISTRATION</p><h1>Platform summary</h1>
        <p>Event and account totals across the platform.</p></div>
      <button className="secondary-button" onClick={refresh} disabled={loading}>{loading ? 'Loading...' : 'Refresh summary'}</button>
    </header>
    {loading && <p role="status">Loading platform summary...</p>}
    {error && <p role="alert" className="management-message error">{error}</p>}
    {!loading && !error && summary && <>
      <CountGroup title="Events by status" values={summary.eventsByStatus} />
      <CountGroup title="Users by role" values={summary.usersByRole} />
      <section className="summary-group" aria-label="Daily registrations">
        <div className="summary-heading"><div><h2>Registrations in the last 30 days</h2>
          <p>{days.length > 0 && `${dayLabel(days[0].date)} – ${dayLabel(days.at(-1).date)}`} · IST · Includes today</p></div>
          <p className="summary-total"><strong>{total.toLocaleString('en-IN')}</strong> registrations</p></div>
        <p>Counts registrations when created, including those later cancelled or checked in. Account totals include inactive users.</p>
        {total === 0 && <p>No registrations in this period.</p>}
        <div className="summary-chart" role="img" aria-label={`Daily registrations: ${total} in the last 30 days. Exact values are in the table below.`}>
          {days.map(day => <div key={day.date} className="summary-bar-column" title={`${day.date} IST: ${day.count}`}>
            <div className="summary-bar" style={{ height: `${day.count / max * 100}%` }} />
          </div>)}
        </div>
        {days.length > 0 && <div className="summary-axis" aria-hidden="true"><span>{dayLabel(days[0].date)}</span><span>{dayLabel(days.at(-1).date)}</span></div>}
        <details className="summary-table"><summary>View daily registration counts</summary>
          <table><caption>Daily registrations — India Standard Time</caption>
            <thead><tr><th scope="col">Date (IST)</th><th scope="col">Registrations</th></tr></thead>
            <tbody>{days.map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.count}</td></tr>)}</tbody>
          </table>
        </details>
      </section>
    </>}
  </section>
}
