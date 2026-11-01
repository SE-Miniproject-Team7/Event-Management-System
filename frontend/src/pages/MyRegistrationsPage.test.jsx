// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import api from '../services/api'
import MyRegistrationsPage from './MyRegistrationsPage'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }))

const day = '2027-11-10T10:00:00.000Z'
const registrations = [
  { _id: 'confirmed', regCode: 'REG-1', status: 'Confirmed', event: { title: 'Confirmed Event', startAt: day, venue: 'Hall A' } },
  { _id: 'waitlisted', regCode: 'REG-2', status: 'Waitlisted', waitlistPosition: 1, event: { title: 'Waitlisted Event', startAt: day, venue: 'Hall B' } },
  { _id: 'cancelled', regCode: 'REG-3', status: 'Cancelled', event: { title: 'Cancelled Event', startAt: day, venue: 'Hall C' } },
  { _id: 'checked-in', regCode: 'REG-4', status: 'Checked-in', checkedInAt: day, event: { title: 'Checked-in Event', startAt: day, venue: 'Hall D' } },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/registrations/me']}>
      <Routes><Route path="/registrations/me" element={<MyRegistrationsPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.get.mockResolvedValue({ data: { items: registrations } })
  api.delete.mockResolvedValue({ data: { status: 'Cancelled' } })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('my registrations', () => {
  it('lists every registration with its event, India-local date, and status', async () => {
    renderPage()

    for (const item of registrations) {
      expect(await screen.findByRole('heading', { name: item.event.title })).toBeTruthy()
      expect(screen.getByText(item.status, { exact: true })).toBeTruthy()
    }
    expect(screen.getAllByText(/10 Nov 2027/)).toHaveLength(registrations.length)
    expect(screen.getByText(/Waitlist position:/)).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('Waitlist position: 1'))).toBeTruthy()
  })

  it('cancels a confirmed registration only after confirmation and refreshes the list', async () => {
    api.get
      .mockResolvedValueOnce({ data: { items: [registrations[0]] } })
      .mockResolvedValueOnce({ data: { items: [{ ...registrations[0], status: 'Cancelled' }] } })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel registration for Confirmed Event' }))

    expect(window.confirm).toHaveBeenCalledWith('Cancel your registration for Confirmed Event?')
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/registrations/confirmed'))
    expect(await screen.findByText('Your registration for Confirmed Event was cancelled.')).toBeTruthy()
    expect(await screen.findByText('Cancelled', { exact: true })).toBeTruthy()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('shows a helpful empty state', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'No registrations yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Explore events' })).toBeTruthy()
  })
})
