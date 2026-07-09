import type { Status } from '../types'

/** Left-click cycles through these in order. */
export const STATUS_CYCLE: Status[] = ['not_visited', 'visited', 'slept_in', 'lived_in']

export const STATUS_LABELS: Record<Status, string> = {
  not_visited: 'Not visited',
  visited: 'Visited',
  slept_in: 'Slept in',
  lived_in: 'Lived in',
}

/**
 * Scratch-map palette: dark foil for unscratched, warm metallics revealed.
 * The three visited shades are validated (dataviz six-checks) against the
 * dark panel surface #171c28: lightness band, CVD separation, ≥3:1 contrast.
 * If you change them, re-run the dataviz skill's validate_palette.js.
 */
export const STATUS_COLORS: Record<Status, string> = {
  not_visited: '#252b3a',
  visited: '#bd8b30',
  slept_in: '#b25b26',
  lived_in: '#c04848',
}

export function nextStatus(s: Status): Status {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length]
}
