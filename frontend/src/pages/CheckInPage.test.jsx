// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckInPage from './CheckInPage'
import api from '../services/api'
const decoder = vi.hoisted(() => ({ decode: vi.fn() }))
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromImageUrl(...args) { return decoder.decode(...args) } } }))
vi.mock('../components/QrScanner', () => ({ default: ({ onDecoded }) => <button onClick={() => onDecoded('REG-CAMERA')}>Simulate camera scan</button> }))
const organizer = { id: 'org', role: 'Organizer' }
const event = { _id: 'event1', title: 'Campus Workshop', status: 'Published', startAt: '2026-11-01T10:00:00Z', endAt: '2026-11-01T12:00:00Z' }
function show(user = organizer) {
  return render(<MemoryRouter initialEntries={['/organizer/checkin']}><Routes>
    <Route path="/organizer/checkin" element={<CheckInPage user={user} checkingAuth={false} />} />
    <Route path="/login" element={<p>Login destination</p>} />
  </Routes></MemoryRouter>)
}
async function selectEvent() {
  await screen.findByRole('option', { name: /Campus Workshop/ })
  fireEvent.change(screen.getByLabelText('Your event'), { target: { value: event._id } })
}
beforeEach(() => {
  api.get.mockResolvedValue({ data: { items: [event, { ...event, _id: 'pending', title: 'Pending Event', status: 'Pending Approval' }] } })
  api.post.mockResolvedValue({ data: { registration: 'Checked-in', regCode: 'REG-ABC123', checkedInAt: '2026-11-01T09:30:00Z' } })
  decoder.decode.mockResolvedValue({ getText: () => 'REG-QR123' })
  URL.createObjectURL = vi.fn(() => 'blob:test-image')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { cleanup(); vi.resetAllMocks() })
describe('Organizer check-in screen', () => {
  it('requires login and Organizer access before fetching events', async () => {
    const view = show(null)
    await screen.findByText('Login destination')
    expect(api.get).not.toHaveBeenCalled()
    view.unmount()
    show({ id: 'att', role: 'Attendee' })
    expect(screen.getByRole('alert').textContent).toContain('Only organizers')
    expect(api.get).not.toHaveBeenCalled()
  })
  it('submits a trimmed code for the selected published event and shows an IST timestamp', async () => {
    show(); await selectEvent()
    expect(screen.queryByRole('option', { name: /Pending Event/ })).toBeNull()
    fireEvent.change(screen.getByLabelText('Registration code'), { target: { value: ' REG-ABC123 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in attendee' }))
    expect((await screen.findByRole('status')).textContent).toContain('Checked in REG-ABC123')
    expect(screen.getByRole('status').textContent).toContain('IST')
    expect(api.post).toHaveBeenCalledWith('/events/event1/checkin', { regCode: 'REG-ABC123' })
    expect(screen.getByLabelText('Registration code').value).toBe('')
  })
  it('displays duplicate/window errors returned by the server', async () => {
    api.post.mockRejectedValue({ response: { data: { error: { message: 'This registration is already checked in' } } } })
    show(); await selectEvent()
    fireEvent.change(screen.getByLabelText('Registration code'), { target: { value: 'REG-ABC123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in attendee' }))
    expect((await screen.findByRole('alert')).textContent).toContain('already checked in')
  })
  it('decodes an uploaded QR locally and waits for confirmation before submitting', async () => {
    show(); await selectEvent()
    const file = new File(['synthetic'], 'qr.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/Or upload a QR image/), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByLabelText('Registration code').value).toBe('REG-QR123'))
    expect(api.post).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-image')
    fireEvent.click(screen.getByRole('button', { name: 'Check in attendee' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/events/event1/checkin', { regCode: 'REG-QR123' }))
  })
  it('does not submit unsupported QR payloads', async () => {
    decoder.decode.mockResolvedValue({ getText: () => 'https://untrusted.test/payload' })
    show(); await selectEvent()
    fireEvent.change(screen.getByLabelText(/Or upload a QR image/), { target: { files: [new File(['x'], 'qr.png', { type: 'image/png' })] } })
    expect((await screen.findByRole('alert')).textContent).toContain('does not contain a valid')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('accepts camera results without automatically checking in', async () => {
    show(); await selectEvent()
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR with camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simulate camera scan' }))
    expect(screen.getByLabelText('Registration code').value).toBe('REG-CAMERA')
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.queryByText('Simulate camera scan')).toBeNull()
  })
  it('rejects non-image uploads before attempting a decode', async () => {
    show(); await selectEvent()
    fireEvent.change(screen.getByLabelText(/Or upload a QR image/), { target: { files: [new File(['x'], 'qr.txt', { type: 'text/plain' })] } })
    expect((await screen.findByRole('alert')).textContent).toContain('Choose a PNG')
    expect(decoder.decode).not.toHaveBeenCalled()
  })
})
