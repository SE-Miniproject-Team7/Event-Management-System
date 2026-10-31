// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminUsersPage from './AdminUsersPage'
import api from '../services/api'
vi.mock('../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
const admin = { id: 'admin1', name: 'Admin', email: 'admin@test.local', role: 'Admin', active: true }
const attendee = { id: 'user1', name: 'Alice', email: 'alice@test.local', role: 'Attendee', active: true }
function show(user = admin, path = '/admin/users', onSelfUpdate = vi.fn()) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/admin/users" element={<AdminUsersPage user={user} checkingAuth={false} onSelfUpdate={onSelfUpdate} />} />
    <Route path="/login" element={<p>Login destination</p>} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  api.get.mockResolvedValue({ data: { items: [attendee], total: 12 } })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks() })
describe('Admin account management', () => {
  it('requires login and rejects non-admin visitors without fetching users', async () => {
    const view = show(null)
    expect(await screen.findByText('Login destination')).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()
    view.unmount()
    show(attendee)
    expect(screen.getByRole('alert').textContent).toContain('Only administrators')
    expect(api.get).not.toHaveBeenCalled()
  })
  it('preserves search across pages and resets to page one on new search', async () => {
    show(admin, '/admin/users?q=alice&page=2')
    await screen.findByText(attendee.email)
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { q: 'alice', page: 2 } })
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { q: 'alice', page: 1 } }))
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: 'bob' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { q: 'bob', page: 1 } }))
  })
  it('edits role and activity with confirmation and reports success', async () => {
    api.patch.mockResolvedValue({ data: { user: { ...attendee, role: 'Organizer', active: false } } })
    show()
    const form = await screen.findByRole('form', { name: `Manage ${attendee.email}` })
    fireEvent.change(within(form).getByLabelText('Role'), { target: { value: 'Organizer' } })
    fireEvent.click(within(form).getByLabelText('Account active'))
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Account updated successfully.')
    expect(window.confirm).toHaveBeenCalled()
    expect(api.patch).toHaveBeenCalledWith('/admin/users/user1', { role: 'Organizer', active: false })
  })
  it('does not save when a destructive change is cancelled', async () => {
    window.confirm.mockReturnValue(false)
    show()
    const form = await screen.findByRole('form', { name: `Manage ${attendee.email}` })
    fireEvent.click(within(form).getByLabelText('Account active'))
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }))
    expect(api.patch).not.toHaveBeenCalled()
  })
  it('shows the last-admin rejection without losing the account list', async () => {
    api.get.mockResolvedValue({ data: { items: [admin], total: 1 } })
    api.patch.mockRejectedValue({ response: { data: { error: { message: 'Keep at least one active administrator' } } } })
    show()
    fireEvent.click(await screen.findByLabelText('Account active'))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Keep at least one')
    expect(screen.getByText(admin.email)).toBeTruthy()
  })
  it('updates the app session when the administrator changes their own role', async () => {
    const onSelfUpdate = vi.fn()
    api.get.mockResolvedValue({ data: { items: [admin], total: 1 } })
    const changed = { ...admin, role: 'Organizer' }
    api.patch.mockResolvedValue({ data: { user: changed } })
    show(admin, '/admin/users', onSelfUpdate)
    fireEvent.change(await screen.findByLabelText('Role'), { target: { value: 'Organizer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSelfUpdate).toHaveBeenCalledWith(changed))
  })
})
