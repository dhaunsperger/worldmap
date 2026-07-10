import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { Territory, TerritoryKind } from '../types'

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 520

interface TerritoryProps {
  id: string
  name: string
  kind: TerritoryKind
}

/** Fetches the generated TopoJSON and precomputes one SVG path per territory. */
export async function loadTerritories(): Promise<Territory[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}territories.json`)
  if (!res.ok) throw new Error(`Failed to load territories.json: ${res.status}`)
  const topo = (await res.json()) as Topology
  const fc = feature(topo, topo.objects.territories) as unknown as FeatureCollection<
    Geometry,
    TerritoryProps
  >

  const projection = geoNaturalEarth1().fitExtent(
    [
      [4, 4],
      [MAP_WIDTH - 4, MAP_HEIGHT - 4],
    ],
    fc,
  )
  const path = geoPath(projection)

  return fc.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    kind: f.properties.kind,
    path: path(f) ?? '',
  }))
}
