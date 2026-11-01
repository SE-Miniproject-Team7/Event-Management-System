
import { describe, expect, it } from 'vitest'
import { parseISTDateTime } from './dateTime'

describe('parseISTDateTime', () => {
  it('converts 10:00 IST to 04:30 UTC', () => {
    const result = parseISTDateTime('2027-11-10T10:00')

    expect(result.toISOString()).toBe('2027-11-10T04:30:00.000Z')
  })

  it('returns an invalid date for empty input', () => {
    expect(Number.isNaN(parseISTDateTime('').getTime())).toBe(true)
  })

  it('rejects impossible dates', () => {
    expect(
      Number.isNaN(parseISTDateTime('2027-02-30T10:00').getTime()),
    ).toBe(true)
  })
})
