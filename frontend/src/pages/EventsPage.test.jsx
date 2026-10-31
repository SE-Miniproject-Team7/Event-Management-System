// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import api from '../services/api'
import EventsPage from './EventsPage'

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))

const workshop = '64b0000000000000000000c1'
const music = '64b0000000000000000000c2'

function rows(start) {
  return Array.from({ length: 10 }, (_, index) => ({
    _id: `event-${start + index}`,
    title: `Hack event ${start + index}`,
    description: 'Workshop project',
    venue: 'Hall A',
    startAt: '2027-11-10T10:00:00.000Z',
    capacity: 50,
    seatsTaken: 12,
    remainingSeats: 38,
  }))
}

function renderPage(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/events" element={<EventsPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.get.mockImplementation((path, config) => {
    if (path === '/categories') {
      return Promise.resolve({ data: { items: [
        { _id: workshop, name: 'Workshop' },
        { _id: music, name: 'Music' },
      ] } })
    }
    const page = Number(config.params.page || 1)
    return Promise.resolve({ data: { items: rows(page === 1 ? 1 : 11), page, total: 23 } })
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('event discovery filters and pagination', () => {
  it('sends combined filters and keeps them when moving beyond the first ten results', async () => {
    renderPage(`/events?q=hack&category=${workshop}&from=2027-11-10&to=2027-11-30&available=true`)

    expect(await screen.findByText('Hack event 1')).toBeTruthy()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/events', {
      params: expect.objectContaining({
        q: 'hack', category: workshop, from: '2027-11-10', to: '2027-11-30', available: 'true',
      }),
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Hack event 11')).toBeTruthy()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/events', {
      params: expect.objectContaining({
        q: 'hack', category: workshop, from: '2027-11-10', to: '2027-11-30', available: 'true', page: '2',
      }),
    }))
    expect(screen.getByText(/Page 2 of 3/)).toBeTruthy()
  })

  it('resets to page one when a filter changes and preserves the other filters', async () => {
    renderPage(`/events?q=hack&category=${workshop}&from=2027-11-10&to=2027-11-30&available=true&page=3`)
    await screen.findByText('Hack event 11')

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: music } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/events', {
      params: expect.objectContaining({
        q: 'hack', category: music, from: '2027-11-10', to: '2027-11-30', available: 'true',
      }),
    }))
    const lastCall = api.get.mock.calls.filter(([path]) => path === '/events').at(-1)
    expect(lastCall[1].params.page).toBeUndefined()
  })
})
