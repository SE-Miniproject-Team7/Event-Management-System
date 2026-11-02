
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EventReportsPage from './EventReportsPage'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

const organizer = {
  _id: 'organizer1',
  name: 'Test Organizer',
  role: 'Organizer',
}

const event = {
  _id: 'event123',
  title: 'Tech Conference',
}

const report = {
  event: {
    id: 'event123',
    title: 'Tech Conference',
    startAt: '2026-12-10T09:00:00.000Z',
    endAt: '2026-12-10T17:00:00.000Z',
    venue: 'Bangalore',
    capacity: 100,
  },
  summary: {
    confirmed: 10,
    waitlisted: 3,
    checkedIn: 7,
    cancelled: 2,
    attendanceRate: 41.18,
  },
  registrations: [
    {
      registrationId: 'reg1',
      attendeeName: 'Rahul Kumar',
      attendeeEmail: 'rahul@example.com',
      regCode: 'EMS-123',
      status: 'Checked-in',
      registeredAt: '2026-11-01T10:00:00.000Z',
      checkedInAt: '2026-12-10T09:30:00.000Z',
    },
  ],
}

function renderPage(user = organizer, checkingAuth = false) {
  return render(
    <MemoryRouter>
      <EventReportsPage
        user={user}
        checkingAuth={checkingAuth}
      />
    </MemoryRouter>
  )
}

describe('Event Reports Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows account checking status', () => {
    renderPage(null, true)

    expect(screen.getByRole('status').textContent).toContain(
      'Checking account access'
    )
  })

  it('redirects unauthenticated users to login', () => {
    renderPage(null)

    expect(
      screen.queryByText('Event attendance reports')
    ).toBeNull()
  })

  it('rejects users who are not organizers', () => {
    renderPage({ role: 'Attendee', name: 'Test User' })

    expect(screen.getByRole('alert').textContent).toContain(
      'Only organizers can view event reports'
    )
  })

  it('loads organizer events and displays the event selector', async () => {
    api.get.mockResolvedValueOnce({
      data: { items: [event] },
    })

    renderPage()

    expect(
      await screen.findByRole('option', {
        name: 'Tech Conference',
      })
    ).toBeTruthy()

    expect(api.get).toHaveBeenCalledWith('/events/mine')
  })

  it('loads and displays event statistics and attendee records', async () => {
    api.get
      .mockResolvedValueOnce({
        data: { items: [event] },
      })
      .mockResolvedValueOnce({
        data: report,
      })

    renderPage()

    await screen.findByRole('option', {
      name: 'Tech Conference',
    })

    fireEvent.change(screen.getByLabelText('Select your event'), {
      target: { value: 'event123' },
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Tech Conference',
      })
    ).toBeTruthy()

    expect(screen.getByText('Bangalore')).toBeTruthy()
    expect(screen.getByText('41.18%')).toBeTruthy()
    expect(screen.getByText('Rahul Kumar')).toBeTruthy()
    expect(screen.getByText('rahul@example.com')).toBeTruthy()
    expect(screen.getByText('EMS-123')).toBeTruthy()
    expect(screen.getByText('Checked-in')).toBeTruthy()

    expect(api.get).toHaveBeenLastCalledWith(
      '/events/event123/report'
    )
  })

  it('refetches the selected report when refresh is clicked', async () => {
    api.get
      .mockResolvedValueOnce({
        data: { items: [event] },
      })
      .mockResolvedValueOnce({
        data: report,
      })
      .mockResolvedValueOnce({
        data: { items: [event] },
      })
      .mockResolvedValueOnce({
        data: report,
      })

    renderPage()

    await screen.findByRole('option', {
      name: 'Tech Conference',
    })

    fireEvent.change(screen.getByLabelText('Select your event'), {
      target: { value: 'event123' },
    })

    await screen.findByRole('heading', {
      name: 'Tech Conference',
    })

    expect(
      api.get.mock.calls.filter(
        ([url]) => url === '/events/event123/report'
      )
    ).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh events' })
    )

    await waitFor(() => {
      expect(
        api.get.mock.calls.filter(
          ([url]) => url === '/events/event123/report'
        )
      ).toHaveLength(2)
    })

    expect(api.get).toHaveBeenLastCalledWith(
      '/events/event123/report'
    )
  })

  it('displays an empty registration message', async () => {
    api.get
      .mockResolvedValueOnce({
        data: { items: [event] },
      })
      .mockResolvedValueOnce({
        data: {
          ...report,
          registrations: [],
        },
      })

    renderPage()

    await screen.findByRole('option', {
      name: 'Tech Conference',
    })

    fireEvent.change(screen.getByLabelText('Select your event'), {
      target: { value: 'event123' },
    })

    expect(
      await screen.findByText(
        'No registrations found for this event.'
      )
    ).toBeTruthy()
  })

  it('downloads the event CSV report', async () => {
    const csvBlob = new Blob(['name,email\nRahul,rahul@example.com'], {
      type: 'text/csv',
    })

    api.get
      .mockResolvedValueOnce({
        data: { items: [event] },
      })
      .mockResolvedValueOnce({
        data: report,
      })
      .mockResolvedValueOnce({
        data: csvBlob,
      })

    const createObjectURL = vi.fn(() => 'blob:test-report')
    const revokeObjectURL = vi.fn()

    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })

    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderPage()

    await screen.findByRole('option', {
      name: 'Tech Conference',
    })

    fireEvent.change(screen.getByLabelText('Select your event'), {
      target: { value: 'event123' },
    })

    await screen.findByRole('heading', {
      name: 'Tech Conference',
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Download CSV' })
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        '/events/event123/report.csv',
        { responseType: 'blob' }
      )
    })

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-report')
  })

  it('shows an error when event loading fails', async () => {
    api.get.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Could not retrieve events',
          },
        },
      },
    })

    renderPage()

    expect(
      (await screen.findByRole('alert')).textContent
    ).toContain('Could not retrieve events')
  })
})
