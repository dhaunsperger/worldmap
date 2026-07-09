export type Status = 'not_visited' | 'visited' | 'slept_in' | 'lived_in'

export type TerritoryKind = 'country' | 'state' | 'province'

/** One clickable shape on the map, with its precomputed SVG path. */
export interface Territory {
  id: string
  name: string
  kind: TerritoryKind
  path: string
}

export interface Trip {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  notes: string
  created_at: string
  territory_ids: string[]
}

/** Trip being created/edited; id absent until first save. */
export interface TripDraft {
  id?: string
  name: string
  start_date: string | null
  end_date: string | null
  notes: string
  territory_ids: string[]
}
