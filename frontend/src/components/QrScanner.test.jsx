// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import QrScanner from './QrScanner'
const camera = vi.hoisted(() => ({ start: vi.fn() }))
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromConstraints(...args) { return camera.start(...args) } } }))
beforeEach(() => vi.resetAllMocks())
afterEach(() => cleanup())
it('stops after one successful scan and does not deliver duplicate frames', async () => {
  const controls = { stop: vi.fn() }
  let callback
  camera.start.mockImplementation(async (_constraints, _video, onResult) => { callback = onResult; return controls })
  const onDecoded = vi.fn()
  const view = render(<QrScanner onDecoded={onDecoded} />)
  await waitFor(() => expect(camera.start).toHaveBeenCalled())
  callback({ getText: () => 'REG-ABC123' }, undefined, controls)
  callback({ getText: () => 'REG-ABC123' }, undefined, controls)
  expect(onDecoded).toHaveBeenCalledTimes(1)
  expect(controls.stop).toHaveBeenCalled()
  view.unmount()
})
it('stops a camera that finishes starting after the component unmounts', async () => {
  const controls = { stop: vi.fn() }
  let resolve
  camera.start.mockImplementation(() => new Promise(done => { resolve = done }))
  const view = render(<QrScanner onDecoded={vi.fn()} />)
  await waitFor(() => expect(camera.start).toHaveBeenCalled())
  view.unmount()
  resolve(controls)
  await waitFor(() => expect(controls.stop).toHaveBeenCalled())
})
it('offers a fallback when camera permission is denied', async () => {
  camera.start.mockRejectedValue(new Error('NotAllowedError'))
  render(<QrScanner onDecoded={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
})
