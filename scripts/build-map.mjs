// Builds public/territories.json — a single TopoJSON with every clickable
// territory: US states (incl. DC + territories), Canadian provinces, and
// countries elsewhere. Each geometry gets { id, name, kind }.
//
// Sources (fetched into scripts/raw/ if missing):
//   - world-atlas@2 countries-50m.json  (npm tarball, Natural Earth 50m)
//   - us-atlas@3 states-10m.json        (npm tarball, Census cartographic)
//   - canada.geojson                    (click_that_hood, via raw.githubusercontent.com)
//
// Usage: npm run build-map
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { topology } from 'topojson-server'
import mapshaper from 'mapshaper'
import { geoArea } from 'd3-geo'

const here = dirname(fileURLToPath(import.meta.url))
const rawDir = join(here, 'raw')
const outFile = join(here, '..', 'public', 'territories.json')

const FIPS_TO_USPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
  '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
}

const CANADA_NAME_TO_CODE = {
  'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB',
  'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT', 'Nova Scotia': 'NS', 'Nunavut': 'NU',
  'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC',
  'Saskatchewan': 'SK', 'Yukon Territory': 'YT',
}

// Country entries in world-atlas that are covered by the US states layer
// (ISO 3166-1 numeric): American Samoa, Guam, N. Mariana Is., Puerto Rico,
// US Virgin Islands — plus the USA (840) and Canada (124) themselves.
const WORLD_IDS_TO_DROP = new Set(['840', '124', '016', '316', '580', '630', '850'])

// A few world-atlas features ship without an ISO numeric id (disputed
// territories). Keep the real places under synthetic ids; drop uninhabited
// specks ("Ashmore and Cartier Is." even shares Australia's id 036).
const NO_ID_SYNTHETIC = {
  'Somaliland': 'x-somaliland',
  'Kosovo': 'x-kosovo',
  'N. Cyprus': 'x-north-cyprus',
  'Indian Ocean Ter.': 'x-indian-ocean-ter', // Christmas + Cocos Islands
}
const NAMES_TO_DROP = new Set(['Siachen Glacier', 'Ashmore and Cartier Is.'])

function fetchSources() {
  mkdirSync(rawDir, { recursive: true })
  const run = (cmd) => execSync(cmd, { cwd: rawDir, stdio: 'inherit' })
  if (!existsSync(join(rawDir, 'countries-50m.json'))) {
    run('npm pack world-atlas@2 --silent')
    run('tar xzf world-atlas-2.0.2.tgz --strip-components=1 package/countries-50m.json')
  }
  if (!existsSync(join(rawDir, 'states-10m.json'))) {
    run('npm pack us-atlas@3 --silent')
    run('tar xzf us-atlas-3.0.1.tgz --strip-components=1 package/states-10m.json')
  }
  if (!existsSync(join(rawDir, 'canada.geojson'))) {
    run('curl -sSL -o canada.geojson https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/canada.geojson')
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

// d3-geo treats polygons as spherical: a ring wound the "wrong" way means
// "everything on Earth EXCEPT this shape". RFC7946 sources (the Canada file)
// are wound that way. Reverse any ring that claims more than a hemisphere.
function rewindGeometry(geom) {
  // Decide per feature, not per ring: pole/antimeridian-hugging rings (e.g.
  // Antarctica's outline) measure as near-4π alone even when the feature as a
  // whole is wound correctly. If the whole geometry claims more than a
  // hemisphere, its winding is uniformly inverted — reverse every ring.
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return geom
  if (geoArea(geom) <= 2 * Math.PI) return geom
  const reverseRings = (rings) => rings.map((ring) => [...ring].reverse())
  return {
    ...geom,
    coordinates:
      geom.type === 'Polygon'
        ? reverseRings(geom.coordinates)
        : geom.coordinates.map(reverseRings),
  }
}

async function main() {
  fetchSources()

  const worldTopo = readJson(join(rawDir, 'countries-50m.json'))
  const usTopo = readJson(join(rawDir, 'states-10m.json'))
  const canadaGeo = readJson(join(rawDir, 'canada.geojson'))

  const countries = feature(worldTopo, worldTopo.objects.countries).features
    .filter((f) => !WORLD_IDS_TO_DROP.has(String(f.id)) && !NAMES_TO_DROP.has(f.properties.name))
    .map((f) => {
      const id = f.id != null ? String(f.id) : NO_ID_SYNTHETIC[f.properties.name]
      if (!id) throw new Error(`No id for country: ${f.properties.name}`)
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: { id, name: f.properties.name, kind: 'country' },
      }
    })

  const states = feature(usTopo, usTopo.objects.states).features.map((f) => {
    const usps = FIPS_TO_USPS[String(f.id)]
    if (!usps) throw new Error(`No USPS code for FIPS ${f.id}`)
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: { id: `US-${usps}`, name: f.properties.name, kind: 'state' },
    }
  })

  // The Canada source is high-detail; simplify it so it visually matches the
  // 50m countries layer and doesn't bloat the output.
  const simplified = await mapshaper.applyCommands(
    '-i canada.geojson -simplify 8% keep-shapes -clean -o out.geojson',
    { 'canada.geojson': canadaGeo },
  )
  const provinces = JSON.parse(simplified['out.geojson']).features.map((f) => {
    const code = CANADA_NAME_TO_CODE[f.properties.name]
    if (!code) throw new Error(`No province code for ${f.properties.name}`)
    const name = f.properties.name === 'Yukon Territory' ? 'Yukon' : f.properties.name
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: { id: `CA-${code}`, name, kind: 'province' },
    }
  })

  const all = {
    type: 'FeatureCollection',
    features: [...countries, ...states, ...provinces].map((f) => ({
      ...f,
      geometry: rewindGeometry(f.geometry),
    })),
  }
  const ids = all.features.map((f) => f.properties.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length) throw new Error(`Duplicate territory ids: ${dupes.join(', ')}`)

  const topo = topology({ territories: all }, 1e5)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(topo))
  const kb = Math.round(Buffer.byteLength(JSON.stringify(topo)) / 1024)
  console.log(`Wrote ${outFile}: ${all.features.length} territories, ${kb} KB`)
}

main()
