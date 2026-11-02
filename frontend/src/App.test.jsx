
 // @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import api from './services/api'

const adminUsersProps = vi.hoisted(() => ({ current: null }))
const adminSummaryProps = vi.hoisted(() => ({ current: null }))

vi.mock('./services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('./pages/AdminUsersPage.jsx', () => ({
  default: props => {
    adminUsersProps.current = props
    return <div>Mock Admin Users</div>
  },
}))

vi.mock('./pages/AdminSummaryPage.jsx', () => ({
  default: props => {
    adminSummaryProps.current = props
    return <div>Mock Admin Summary</div>
  },
}))

describe('App admin route props', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    adminUsersProps.current = null
    adminSummaryProps.current = null
  })

  it('passes signed-in admin and self-update callback to admin pages', async () => {
    const admin = {
      id: 'admin-1',
      name: 'Test Admin',
      email: 'admin@example.com',
      role: 'Admin',
    }

    api.get.mockResolvedValue({ data: { user: admin } })

    const view = render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <App />
      </MemoryRouter>
    )

    await screen.findByText('Mock Admin Users')

    await waitFor(() => {
      expect(adminUsersProps.current?.user).toEqual(admin)
      expect(adminUsersProps.current?.checkingAuth).toBe(false)
      expect(typeof adminUsersProps.current?.onSelfUpdate).toBe('function')
    })

    view.unmount()

    render(
      <MemoryRouter initialEntries={['/admin/summary']}>
        <App />
      </MemoryRouter>
    )

    await screen.findByText('Mock Admin Summary')

    await waitFor(() => {
      expect(adminSummaryProps.current?.user).toEqual(admin)
      expect(adminSummaryProps.current?.checkingAuth).toBe(false)
    })
  })
})
