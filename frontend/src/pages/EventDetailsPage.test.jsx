// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import api from '../services/api'
import EventDetailsPage from './EventDetailsPage'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const event = {
  _id: '64b0000000000000000000e1',
  title: 'Campus Hack Night',
  description: 'Build a useful project with your team.',
  venue: 'Innovation Hall',
  startAt: '2027-11-10T10:00:00.000Z',
  endAt: '2027-11-10T13:00:00.000Z',
}
const detail = (remainingSeats) => ({
  data: { event, remainingSeats, categoryName: 'Workshop', organizerName: 'EMS Organizer' },
})

function renderDetails() {
  return render(
    <MemoryRouter initialEntries={[`/events/${event._id}`]}>
      <Routes><Route path="/events/:id" element={<EventDetailsPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.get.mockResolvedValue(detail(38))
  api.post.mockResolvedValue({ data: { status: 'Confirmed', regCode: 'REG-001' } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('event details API contract', () => {
  it('renders required details and uses the top-level remainingSeats value, including zero', async () => {
    api.get.mockResolvedValue(detail(0))
    renderDetails()

    expect(await screen.findByRole('heading', { name: event.title })).toBeTruthy()
    expect(screen.getByText(event.description)).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('Category:') && element.textContent.includes('Workshop'))).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('Organizer:') && element.textContent.includes('EMS Organizer'))).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('Venue:') && element.textContent.includes('Innovation Hall'))).toBeTruthy()
    expect(screen.getByText(/Starts:/)).toBeTruthy()
    expect(screen.getByText(/Ends:/)).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('Seats remaining:') && element.textContent.includes('0'))).toBeTruthy()
    expect(screen.queryByText(/Not available/)).toBeNull()
  })

  it('refreshes remaining seats after a successful registration', async () => {
    api.get.mockResolvedValueOnce(detail(38)).mockResolvedValueOnce(detail(37))
    renderDetails()

    fireEvent.click(await screen.findByRole('button', { name: 'Register for Event' }))
    expect(await screen.findByText(/Registration successful/)).toBeTruthy()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(await screen.findByText((_, element) => element.tagName === 'P' && element.textContent.includes('Seats remaining:') && element.textContent.includes('37'))).toBeTruthy()
  })

  it('shows the unavailable state when the public event endpoint returns 404', async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: { error: { message: 'Event not found' } } } })
    renderDetails()
    expect(await screen.findByRole('heading', { name: 'Event unavailable' })).toBeTruthy()
    expect(screen.getByText('Event not found')).toBeTruthy()
  })
})
