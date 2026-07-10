import type { Trip, TripDraft } from '../types'

const fmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC', // dates are calendar dates; avoid off-by-one from local TZ
})

export function formatDate(iso: string): string {
  return fmt.format(new Date(`${iso}T00:00:00Z`))
}

export function formatTripDates(trip: Trip | TripDraft): string {
  if (!trip.start_date && !trip.end_date) return 'No dates'
  if (trip.start_date && trip.end_date && trip.start_date !== trip.end_date) {
    return `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
  }
  return formatDate((trip.start_date ?? trip.end_date)!)
}
