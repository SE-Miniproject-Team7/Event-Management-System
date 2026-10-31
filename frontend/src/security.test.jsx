// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import api from './services/api'
vi.mock('./services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const name = '<img src=x onerror="window.securityProbe=1">'
const title = '<script>window.securityProbe=1</script>'
const description = '<img src=x onerror="window.securityProbe=2">'
const event = { _id: 'event1', title, description, venue: 'Hall', startAt: '2027-11-01T10:00:00Z', endAt: '2027-11-01T12:00:00Z', remainingSeats: 4 }
beforeEach(() => {
  api.get.mockImplementation(async path => {
    if (path === '/auth/me') return { data: { user: { id: 'user', role: 'Attendee', name } } }
    if (path === '/events') return { data: { items: [event], total: 1 } }
    if (path === '/categories') return { data: { items: [] } }
    return { data: { event, remainingSeats: 4, organizerName: name, categoryName: 'Workshop' } }
  })
})
afterEach(() => { cleanup(); vi.resetAllMocks(); delete window.securityProbe })
it('encodes malicious user names and event titles/descriptions on the discovery screen', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/events']}><App /></MemoryRouter>)
  await screen.findByRole('heading', { name: title })
  await screen.findByText(`Hi, ${name}`)
  expect(screen.getByText(description)).toBeTruthy()
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img[src="x"]')).toBeNull()
  expect(window.securityProbe).toBeUndefined()
})
it('encodes event details and organizer names instead of inserting executable markup', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/events/event1']}><App /></MemoryRouter>)
  await screen.findByRole('heading', { name: title })
  expect(screen.getByText(description)).toBeTruthy()
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img[src="x"]')).toBeNull()
  expect(window.securityProbe).toBeUndefined()
})
