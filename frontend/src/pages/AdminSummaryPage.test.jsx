// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminSummaryPage from './AdminSummaryPage'
import api from '../services/api'
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))
const admin = { id: 'admin', role: 'Admin' }
const data = {
  eventsByStatus: { Published: 4, 'Pending Approval': 0, Cancelled: 1, Rejected: 0 },
  usersByRole: { Admin: 1, Organizer: 2, Attendee: 5 },
  registrationsPerDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, count: i === 29 ? 7 : 0 })),
}
function show(user = admin) {
  return render(<MemoryRouter initialEntries={['/admin/summary']}><Routes>
    <Route path="/admin/summary" element={<AdminSummaryPage user={user} checkingAuth={false} />} />
    <Route path="/login" element={<p>Login destination</p>} />
  </Routes></MemoryRouter>)
}
beforeEach(() => { api.get.mockResolvedValue({ data }) })
afterEach(() => { cleanup(); vi.resetAllMocks() })
describe('Admin platform summary', () => {
  it('shows role/status counts and accessible exact daily values', async () => {
    show()
    await screen.findByRole('region', { name: 'Events by status' })
    expect(screen.getByRole('region', { name: 'Users by role' })).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('7 in the last 30 days')
    fireEvent.click(screen.getByText('View daily registration counts'))
    expect(screen.getAllByRole('row')).toHaveLength(31)
    expect(screen.getByRole('row', { name: '2026-11-30 7' })).toBeTruthy()
    expect(screen.getByRole('row', { name: '2026-11-01 0' })).toBeTruthy()
  })
  it('handles an empty period without an invalid chart scale', async () => {
    api.get.mockResolvedValue({ data: { ...data, registrationsPerDay: data.registrationsPerDay.map(day => ({ ...day, count: 0 })) } })
    show()
    expect(await screen.findByText('No registrations in this period.')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('0 in the last 30 days')
  })
  it('offers a working retry after an API failure', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data })
    show()
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh summary' }))
    await screen.findByRole('region', { name: 'Events by status' })
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })
  it('redirects unauthenticated users and does not fetch data for non-admins', async () => {
    const view = show(null)
    await screen.findByText('Login destination')
    expect(api.get).not.toHaveBeenCalled()
    view.unmount()
    show({ id: 'attendee', role: 'Attendee' })
    expect(screen.getByRole('alert').textContent).toContain('Only administrators')
    expect(api.get).not.toHaveBeenCalled()
  })
})
