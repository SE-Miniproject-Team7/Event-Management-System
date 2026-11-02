// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PasswordResetPage from './PasswordResetPage'
import api from '../services/api'
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/') })
afterEach(cleanup)
it('requests email without displaying an account identity or token', async () => {
  api.post.mockResolvedValue({ data: { message: 'If an active account exists, a password reset email will be sent.' } })
  render(<MemoryRouter><PasswordResetPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('status')).toBeTruthy()
  expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@example.test' })
})
it('requires a valid link and matching passwords, then clears the fragment', async () => {
  const token = 'a'.repeat(64)
  window.history.replaceState(null, '', '/reset-password#' + token)
  api.post.mockResolvedValue({ data: { message: 'Password updated. Please sign in.' } })
  render(<MemoryRouter><PasswordResetPage reset /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
  expect(screen.getByRole('alert').textContent).toContain('match')
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'NewPassword123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/reset-password', { token, newPassword: 'NewPassword123' }))
  await screen.findByRole('status')
  expect(window.location.hash).toBe('')
})
it('disables reset when no token was provided', () => {
  render(<MemoryRouter><PasswordResetPage reset /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Update password' }).disabled).toBe(true)
})
