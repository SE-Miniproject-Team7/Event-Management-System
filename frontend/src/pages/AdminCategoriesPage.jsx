
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'

function CategoryEditor({ category, busy, onSave }) {
  const [name, setName] = useState(category.name)
  const changed = name.trim() !== category.name

  function submit(event) {
    event.preventDefault()
    if (!changed || name.trim().length < 2 || name.trim().length > 50) return
    onSave(category._id, { name: name.trim() })
  }

  return (
    <form className="user-account" onSubmit={submit} aria-label={`Edit ${category.name}`}>
      <label htmlFor={`category-name-${category._id}`}>Category name</label>
      <input
        id={`category-name-${category._id}`}
        value={name}
        maxLength={50}
        disabled={busy}
        onChange={event => setName(event.target.value)}
      />
      <span>{category.active ? 'Active' : 'Disabled'}</span>
      <button type="submit" disabled={busy || !changed || name.trim().length < 2}>
        Rename
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(category._id, { active: !category.active })}
      >
        {category.active ? 'Disable' : 'Enable'}
      </button>
    </form>
  )
}

export default function AdminCategoriesPage({ user, checkingAuth }) {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)

  const isAdmin = user?.role === 'Admin'

  useEffect(() => {
    if (!isAdmin || checkingAuth) return
    let cancelled = false

    api.get('/admin/categories')
      .then(response => {
        if (!cancelled) setItems(response.data.items)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Could not load categories.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [isAdmin, checkingAuth, revision])

  async function saveCategory(id, changes) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await api.patch(`/admin/categories/${id}`, changes)
      const updated = response.data.category
      setItems(current => current.map(category =>
        category._id === id ? updated : category
      ))
      setMessage('Category updated successfully.')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not update category.')
    } finally {
      setBusy(false)
    }
  }

  async function addCategory(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 50) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.post('/admin/categories', { name: trimmed })
      setName('')
      setMessage('Category created successfully.')
      setRevision(value => value + 1)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create category.')
    } finally {
      setBusy(false)
    }
  }

  if (checkingAuth) return <p role="status">Checking account access...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: '/admin/categories' }} />
  if (!isAdmin) return <p role="alert">Only administrators can manage categories.</p>

  return (
    <section className="management-page">
      <h1>Manage categories</h1>
      <p>Create, rename, and disable event categories.</p>

      <form className="event-search" onSubmit={addCategory}>
        <label htmlFor="new-category">New category name</label>
        <input
          id="new-category"
          value={name}
          maxLength={50}
          onChange={event => setName(event.target.value)}
          placeholder="Enter category name"
        />
        <button disabled={busy || name.trim().length < 2}>Add category</button>
      </form>

      {error && <p role="alert" className="management-message error">{error}</p>}
      {message && <p role="status" className="management-message success">{message}</p>}

      {loading ? <p role="status">Loading categories...</p> : (
        items.length === 0 ? <p>No categories found.</p> : (
          items.map(category => (
            <CategoryEditor
              key={category._id}
              category={category}
              busy={busy}
              onSave={saveCategory}
            />
          ))
        )
      )}
    </section>
  )
}
