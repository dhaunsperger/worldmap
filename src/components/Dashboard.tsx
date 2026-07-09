import { useMemo } from 'react'
import { STATUS_COLORS, STATUS_LABELS } from '../lib/statuses'
import type { Status, Territory, Trip } from '../types'

interface DashboardProps {
  territories: Territory[]
  statuses: Record<string, Status>
  trips: Trip[]
  onClose: () => void
}

const VISITED_STATUSES: Status[] = ['visited', 'slept_in', 'lived_in']

/** The 50 real states — DC and territories are clickable but don't count here. */
const US_STATE_IDS = new Set(
  [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
    'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
    'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  ].map((s) => `US-${s}`),
)

interface RegionStats {
  label: string
  total: number
  byStatus: Record<Status, number>
  reached: number
}

function regionStats(label: string, ids: string[], statuses: Record<string, Status>): RegionStats {
  const byStatus: Record<Status, number> = { not_visited: 0, visited: 0, slept_in: 0, lived_in: 0 }
  for (const id of ids) byStatus[statuses[id] ?? 'not_visited']++
  return {
    label,
    total: ids.length,
    byStatus,
    reached: ids.length - byStatus.not_visited,
  }
}

/** Horizontal stacked progress bar: one segment per visited-status, 2px gaps. */
function ProgressBar({ stats }: { stats: RegionStats }) {
  return (
    <div className="progress-row">
      <div className="progress-head">
        <span>{stats.label}</span>
        <span className="progress-count">
          {stats.reached} <span className="muted">/ {stats.total}</span>
        </span>
      </div>
      <div
        className="progress-track"
        role="img"
        aria-label={`${stats.label}: ${VISITED_STATUSES.map(
          (s) => `${stats.byStatus[s]} ${STATUS_LABELS[s].toLowerCase()}`,
        ).join(', ')}, of ${stats.total}`}
      >
        {VISITED_STATUSES.map((s) =>
          stats.byStatus[s] === 0 ? null : (
            <div
              key={s}
              className="progress-seg"
              title={`${STATUS_LABELS[s]}: ${stats.byStatus[s]}`}
              style={{
                width: `${(stats.byStatus[s] / stats.total) * 100}%`,
                background: STATUS_COLORS[s],
              }}
            />
          ),
        )}
      </div>
    </div>
  )
}

export function Dashboard({ territories, statuses, trips, onClose }: DashboardProps) {
  const { regions, tripYears, undatedTrips } = useMemo(() => {
    const countryIds = territories.filter((t) => t.kind === 'country').map((t) => t.id)
    const stateIds = territories.filter((t) => US_STATE_IDS.has(t.id)).map((t) => t.id)
    const provinceIds = territories.filter((t) => t.kind === 'province').map((t) => t.id)

    // The USA / Canada rows aren't on the map as wholes; count each as a
    // country once any of its subdivisions has been reached.
    const usReached = territories.some((t) => t.kind === 'state' && statuses[t.id])
    const caReached = territories.some((t) => t.kind === 'province' && statuses[t.id])
    const countries = regionStats('Countries', countryIds, statuses)
    countries.total += 2
    countries.reached += (usReached ? 1 : 0) + (caReached ? 1 : 0)
    countries.byStatus.visited += (usReached ? 1 : 0) + (caReached ? 1 : 0)

    const years = new Map<string, number>()
    let undated = 0
    for (const t of trips) {
      if (t.start_date) {
        const y = t.start_date.slice(0, 4)
        years.set(y, (years.get(y) ?? 0) + 1)
      } else undated++
    }
    return {
      regions: [
        countries,
        regionStats('US states', stateIds, statuses),
        regionStats('Canadian provinces & territories', provinceIds, statuses),
      ],
      tripYears: [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])),
      undatedTrips: undated,
    }
  }, [territories, statuses, trips])

  const maxYearCount = Math.max(1, ...tripYears.map(([, n]) => n))
  const totals: Record<Status, number> = { not_visited: 0, visited: 0, slept_in: 0, lived_in: 0 }
  for (const t of territories) totals[statuses[t.id] ?? 'not_visited']++

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dashboard" onClick={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <h2>Dashboard</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="stat-tiles">
          {VISITED_STATUSES.map((s) => (
            <div className="stat-tile" key={s}>
              <span className="stat-value">{totals[s]}</span>
              <span className="stat-label">
                <i className="swatch" style={{ background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
              </span>
            </div>
          ))}
          <div className="stat-tile">
            <span className="stat-value">{trips.length}</span>
            <span className="stat-label">Trips logged</span>
          </div>
        </div>

        <section>
          <h3>Progress</h3>
          {regions.map((r) => (
            <ProgressBar key={r.label} stats={r} />
          ))}
          <div className="legend-row">
            {VISITED_STATUSES.map((s) => (
              <span key={s} className="legend-item">
                <i className="swatch" style={{ background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </section>

        {(tripYears.length > 0 || undatedTrips > 0) && (
          <section>
            <h3>Trips by year</h3>
            <div className="year-bars">
              {tripYears.map(([year, n]) => (
                <div className="year-row" key={year} title={`${year}: ${n} trip${n === 1 ? '' : 's'}`}>
                  <span className="year-label">{year}</span>
                  <div className="year-track">
                    <div
                      className="year-bar"
                      style={{ width: `${(n / maxYearCount) * 100}%` }}
                    />
                  </div>
                  <span className="year-count">{n}</span>
                </div>
              ))}
              {undatedTrips > 0 && (
                <p className="muted small">+ {undatedTrips} undated trip{undatedTrips === 1 ? '' : 's'}</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
