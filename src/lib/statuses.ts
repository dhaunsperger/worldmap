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
 * Scratch-map palette: dark foil for unscratched; blue → yellow → green for
 * rising commitment. Hue-distinct so tiny territories stay tellable-apart.
 * The three visited shades are validated (dataviz six-checks) against the
 * dark panel surface #171c28: lightness band, CVD separation, ≥3:1 contrast.
 * If you change them, re-run the dataviz skill's validate_palette.js.
 * ALSO update the custom properties in src/styles.css — they must match.
 */
export const STATUS_COLORS: Record<Status, string> = {
  not_visited: '#252b3a',
  visited: '#4f94dd',
  slept_in: '#bd8b30',
  lived_in: '#2f7d4c',
}

export function nextStatus(s: Status): Status {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length]
}

/** Saving a trip only ever *raises* a territory along this order. */
export const STATUS_RANK: Record<Status, number> = {
  not_visited: 0,
  visited: 1,
  slept_in: 2,
  lived_in: 3,
}
