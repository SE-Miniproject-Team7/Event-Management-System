import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'

function UserEditor({ account, busy, onSave }) {
  const [role, setRole] = useState(account.role)
  const [active, setActive] = useState(account.active)
  const changed = role !== account.role || active !== account.active
  function submit(event) {
    event.preventDefault()
    if ((!active && account.active) || (account.role === 'Admin' && role !== 'Admin')) {
      if (!window.confirm(`Change access for ${account.email}? Existing sessions will respect this change.`)) return
    }
    onSave(account.id, { role, active })
  }
  return (
    <form className="user-account" onSubmit={submit} aria-label={`Manage ${account.email}`}>
      <div><h2>{account.name}</h2><p>{account.email}</p></div>
      <label htmlFor={`role-${account.id}`}>Role</label>
      <select id={`role-${account.id}`} value={role} disabled={busy}
        onChange={event => setRole(event.target.value)}>
        {['Attendee', 'Organizer', 'Admin'].map(value => <option key={value}>{value}</option>)}
      </select>
      <label><input type="checkbox" checked={active} disabled={busy}
        onChange={event => setActive(event.target.checked)} /> Account active</label>
      <button type="submit" disabled={busy || !changed}>Save changes</button>
    </form>
  )
}

export default function AdminUsersPage({ user, checkingAuth, onSelfUpdate }) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const page = Math.max(Number.parseInt(params.get('page'), 10) || 1, 1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const isAdmin = user?.role === 'Admin'
  useEffect(() => {
    if (!isAdmin || checkingAuth) return
    let cancelled = false
    api.get('/admin/users', { params: { q, page } }).then(response => {
      if (!cancelled) {
        setItems(response.data.items)
        setTotal(response.data.total)
      }
    }).catch(err => {
      if (!cancelled) setError(err.response?.data?.error?.message || 'Could not load accounts. Please try again.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [q, page, revision, isAdmin, checkingAuth])

  function search(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const query = event.currentTarget.elements.q.value.trim()
    setParams(query ? { q: query } : {})
    setRevision(value => value + 1)
  }
  function changePage(next) {
    setLoading(true)
    setError('')
    setParams({ ...(q ? { q } : {}), page: String(next) })
  }
  async function save(id, changes) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await api.patch(`/admin/users/${id}`, changes)
      setMessage('Account updated successfully.')
      setItems(current => current.map(account => account.id === id ? response.data.user : account))
      if (id === user.id) onSelfUpdate(response.data.user.active ? response.data.user : null)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not update this account. Please try again.')
    } finally { setBusy(false) }
  }

  if (checkingAuth) return <p role="status">Checking account access...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: '/admin/users' }} />
  if (!isAdmin) return <p role="alert">Only administrators can manage accounts.</p>
  return (
    <section className="management-page">
      <h1>Manage users</h1>
      <p>Find accounts by name or email, change roles, and activate or deactivate accounts. At least one administrator must remain active.</p>
      <form className="event-search" onSubmit={search}>
        <label htmlFor="user-search">Search accounts</label>
        <input key={q} id="user-search" name="q" type="search" maxLength={100} defaultValue={q} />
        <button disabled={busy}>Search</button>
      </form>
      {error && <p role="alert" className="management-message error">{error}</p>}
      {message && <p role="status" className="management-message success">{message}</p>}
      {loading ? <p role="status">Loading accounts...</p> : <>
        {items.length === 0 && <p>No accounts found.</p>}
        {items.map(account => <UserEditor key={`${account.id}-${account.role}-${account.active}`}
          account={account} busy={busy} onSave={save} />)}
        {total > 0 && <nav aria-label="Account pages" className="event-pagination">
          <button disabled={busy || page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page} of {Math.ceil(total / 10)} · {total} accounts</span>
          <button disabled={busy || page * 10 >= total} onClick={() => changePage(page + 1)}>Next</button>
        </nav>}
      </>}
    </section>
  )
}
