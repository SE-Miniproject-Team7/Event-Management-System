
const IST_OPTIONS = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
}

export function formatIST(dateValue) {
  if (!dateValue) return 'Not specified'

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return 'Not specified'
  }

  return new Intl.DateTimeFormat('en-IN', IST_OPTIONS).format(date)
}

export function parseISTDateTime(value) {
  if (!value) return new Date(NaN)

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  )

  if (!match) return new Date(NaN)

  const [, year, month, day, hour, minute] = match

  const utcMilliseconds =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ) - 330 * 60 * 1000

  const date = new Date(utcMilliseconds)

  const check = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ),
  )

  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== Number(month) - 1 ||
    check.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    return new Date(NaN)
  }

  return date
}
