import type { Trip } from '../types'
import { formatTripDates } from '../lib/format'

interface TripsPanelProps {
  trips: Trip[]
  territoryNames: Map<string, string>
  onEditTrip: (trip: Trip) => void
  onNewTrip: () => void
  onClose: () => void
}

export function TripsPanel({ trips, territoryNames, onEditTrip, onNewTrip, onClose }: TripsPanelProps) {
  return (
    <aside className="panel">
      <header className="panel-header">
        <h2>Trips</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <button className="primary" onClick={onNewTrip}>
        + New trip
      </button>

      {trips.length === 0 ? (
        <p className="muted">
          No trips yet. Trips let you record when you were somewhere — a date range, notes, and any
          number of territories.
        </p>
      ) : (
        <ul className="trip-list">
          {trips.map((t) => (
            <li key={t.id}>
              <button className="trip-row" onClick={() => onEditTrip(t)}>
                <span className="trip-name">{t.name}</span>
                <span className="trip-dates">{formatTripDates(t)}</span>
                <span className="trip-places">
                  {t.territories
                    .map((tt) => territoryNames.get(tt.territory_id) ?? tt.territory_id)
                    .slice(0, 4)
                    .join(', ')}
                  {t.territories.length > 4 ? ` +${t.territories.length - 4} more` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
