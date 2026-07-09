import { STATUS_CYCLE, STATUS_LABELS } from '../lib/statuses'
import type { Status, Territory, Trip } from '../types'
import { formatTripDates } from '../lib/format'

interface TerritoryPanelProps {
  territory: Territory
  status: Status
  trips: Trip[]
  onSetStatus: (status: Status) => void
  onEditTrip: (trip: Trip) => void
  onNewTripHere: () => void
  onClose: () => void
}

const KIND_LABELS = { country: 'Country', state: 'US state', province: 'Canadian province' }

export function TerritoryPanel({
  territory,
  status,
  trips,
  onSetStatus,
  onEditTrip,
  onNewTripHere,
  onClose,
}: TerritoryPanelProps) {
  const tripsHere = trips.filter((t) => t.territory_ids.includes(territory.id))

  return (
    <aside className="panel">
      <header className="panel-header">
        <div>
          <h2>{territory.name}</h2>
          <span className="panel-subtitle">{KIND_LABELS[territory.kind]}</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <section>
        <h3>Status</h3>
        <div className="status-buttons">
          {STATUS_CYCLE.map((s) => (
            <button
              key={s}
              className="status-button"
              data-status={s}
              data-active={s === status ? '' : undefined}
              onClick={() => onSetStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Trips</h3>
        {tripsHere.length === 0 ? (
          <p className="muted">No trips recorded here yet.</p>
        ) : (
          <ul className="trip-list">
            {tripsHere.map((t) => (
              <li key={t.id}>
                <button className="trip-row" onClick={() => onEditTrip(t)}>
                  <span className="trip-name">{t.name}</span>
                  <span className="trip-dates">{formatTripDates(t)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="primary" onClick={onNewTripHere}>
          + New trip here
        </button>
      </section>
    </aside>
  )
}
