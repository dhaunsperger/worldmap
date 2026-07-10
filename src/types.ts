export type Status = 'not_visited' | 'visited' | 'slept_in' | 'lived_in'

export type TerritoryKind = 'country' | 'state' | 'province'

/** One clickable shape on the map, with its precomputed SVG path. */
export interface Territory {
  id: string
  name: string
  kind: TerritoryKind
  path: string
}

/** What a trip records about each of its territories. */
export type TripStatus = 'visited' | 'slept_in'

export interface TripTerritory {
  territory_id: string
  status: TripStatus
}

export interface Trip {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  notes: string
  created_at: string
  territories: TripTerritory[]
}

/** Trip being created/edited; id absent until first save. */
export interface TripDraft {
  id?: string
  name: string
  start_date: string | null
  end_date: string | null
  notes: string
  territories: TripTerritory[]
}
