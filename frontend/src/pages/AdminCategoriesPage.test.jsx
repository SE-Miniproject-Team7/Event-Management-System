
 // @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminCategoriesPage from './AdminCategoriesPage'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

const admin = { id: 'admin', role: 'Admin' }
const category = { _id: 'category-1', name: 'Technology', active: true }
const categories = [
  category,
  { _id: 'category-2', name: 'Music', active: false },
]

function show(user = admin) {
  return render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <Routes>
        <Route
          path="/admin/categories"
          element={<AdminCategoriesPage user={user} checkingAuth={false} />}
        />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.get.mockResolvedValue({ data: { items: categories } })
})

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Admin categories', () => {
  it('loads and displays categories', async () => {
    show()

    expect(await screen.findByDisplayValue('Technology')).toBeTruthy()
    expect(screen.getByDisplayValue('Music')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/admin/categories')
  })

  it('creates a category', async () => {
    api.post.mockResolvedValue({
      data: { category: { _id: 'category-3', name: 'Sports', active: true } },
    })
    show()

    await screen.findByDisplayValue('Technology')
    fireEvent.change(screen.getByLabelText('New category name'), {
      target: { value: 'Sports' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/categories', { name: 'Sports' })
    })
    expect(await screen.findByText('Category created successfully.')).toBeTruthy()
  })

  it('renames a category', async () => {
    api.patch.mockResolvedValue({
      data: { category: { ...category, name: 'Computing' } },
    })
    show()

    const input = await screen.findByDisplayValue('Technology')
    fireEvent.change(input, { target: { value: 'Computing' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0])

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/categories/category-1', {
        name: 'Computing',
      })
    })
    expect(await screen.findByDisplayValue('Computing')).toBeTruthy()
  })

  it('disables a category', async () => {
    api.patch.mockResolvedValue({
      data: { category: { ...category, active: false } },
    })
    show()

    await screen.findByDisplayValue('Technology')
    fireEvent.click(screen.getAllByRole('button', { name: 'Disable' })[0])

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/categories/category-1', {
        active: false,
      })
    })
  })

  it('shows an API error when categories fail to load', async () => {
    api.get.mockRejectedValue(new Error('offline'))
    show()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Could not load categories')
  })

  it('redirects unauthenticated users and blocks non-admins', async () => {
    const view = show(null)
    expect(await screen.findByText('Login destination')).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()

    view.unmount()
    show({ id: 'attendee', role: 'Attendee' })

    expect(screen.getByRole('alert').textContent).toContain('Only administrators')
    expect(api.get).not.toHaveBeenCalled()
  })
})
