import { useMemo, useState } from 'react'
import type { Territory, TripDraft, TripStatus, TripTerritory } from '../types'
import { STATUS_COLORS } from '../lib/statuses'

interface TripEditorProps {
  draft: TripDraft
  territories: Territory[]
  onChange: (draft: TripDraft) => void
  onSave: () => void
  onDelete: (() => void) | null
  onCancel: () => void
  saving: boolean
}

const OTHER_BOX: Record<TripStatus, TripStatus> = { visited: 'slept_in', slept_in: 'visited' }

export function TripEditor({
  draft,
  territories,
  onChange,
  onSave,
  onDelete,
  onCancel,
  saving,
}: TripEditorProps) {
  const [search, setSearch] = useState('')
  const byId = useMemo(() => new Map(territories.map((t) => [t.id, t])), [territories])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const inTrip = new Set(draft.territories.map((tt) => tt.territory_id))
    return territories
      .filter((t) => t.name.toLowerCase().includes(q) && !inTrip.has(t.id))
      .slice(0, 8)
  }, [search, territories, draft.territories])

  const set = (patch: Partial<TripDraft>) => onChange({ ...draft, ...patch })

  const moveTo = (territoryId: string, status: TripStatus) =>
    set({
      territories: draft.territories.map((tt) =>
        tt.territory_id === territoryId ? { ...tt, status } : tt,
      ),
    })

  const remove = (territoryId: string) =>
    set({ territories: draft.territories.filter((tt) => tt.territory_id !== territoryId) })

  const box = (status: TripStatus, label: string) => {
    const members = draft.territories.filter((tt) => tt.status === status)
    return (
      <div className="trip-box">
        <span className="trip-box-label">
          <i className="swatch" style={{ background: STATUS_COLORS[status] }} />
          {label}
        </span>
        <div className="chips">
          {members.length === 0 && <span className="muted small">Empty</span>}
          {members.map((tt: TripTerritory) => (
            <span key={tt.territory_id} className="chip">
              <button
                className="chip-name"
                title={`Move to ${status === 'visited' ? 'Slept in' : 'Visited'}`}
                onClick={() => moveTo(tt.territory_id, OTHER_BOX[status])}
              >
                {byId.get(tt.territory_id)?.name ?? tt.territory_id}
              </button>
              <button
                className="chip-remove"
                title="Remove from trip"
                onClick={() => remove(tt.territory_id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <aside className="panel">
      <header className="panel-header">
        <h2>{draft.id ? 'Edit trip' : 'New trip'}</h2>
        <button className="icon-button" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </header>

      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={draft.name}
          placeholder="e.g. Honeymoon in Italy"
          onChange={(e) => set({ name: e.target.value })}
          autoFocus
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Start</span>
          <input
            type="date"
            value={draft.start_date ?? ''}
            onChange={(e) => set({ start_date: e.target.value || null })}
          />
        </label>
        <label className="field">
          <span>End</span>
          <input
            type="date"
            value={draft.end_date ?? ''}
            onChange={(e) => set({ end_date: e.target.value || null })}
          />
        </label>
      </div>
      <p className="muted small">Dates are optional — leave blank for trips you only half-remember.</p>

      <section>
        <h3>Territories</h3>
        <p className="muted small">
          Click the map or search to add places. Click a name to move it between boxes — saving
          the trip paints each place at least that color.
        </p>
        <input
          type="search"
          value={search}
          placeholder="Search territories…"
          onChange={(e) => setSearch(e.target.value)}
        />
        {matches.length > 0 && (
          <ul className="search-results">
            {matches.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => {
                    set({
                      territories: [...draft.territories, { territory_id: t.id, status: 'visited' }],
                    })
                    setSearch('')
                  }}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {box('visited', 'Visited')}
        {box('slept_in', 'Slept in')}
      </section>

      <label className="field">
        <span>Notes</span>
        <textarea
          value={draft.notes}
          rows={3}
          placeholder="Anything worth remembering…"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </label>

      <div className="button-row">
        <button className="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save trip'}
        </button>
        <button onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button className="danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </aside>
  )
}
