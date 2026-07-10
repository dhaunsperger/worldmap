import { useMemo, useState } from 'react'
import type { Territory, TripDraft } from '../types'

interface TripEditorProps {
  draft: TripDraft
  territories: Territory[]
  onChange: (draft: TripDraft) => void
  onSave: () => void
  onDelete: (() => void) | null
  onCancel: () => void
  saving: boolean
}

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
    return territories
      .filter((t) => t.name.toLowerCase().includes(q) && !draft.territory_ids.includes(t.id))
      .slice(0, 8)
  }, [search, territories, draft.territory_ids])

  const set = (patch: Partial<TripDraft>) => onChange({ ...draft, ...patch })

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
        <p className="muted small">Click the map to add or remove places, or search:</p>
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
                    set({ territory_ids: [...draft.territory_ids, t.id] })
                    setSearch('')
                  }}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="chips">
          {draft.territory_ids.length === 0 && <span className="muted small">None yet.</span>}
          {draft.territory_ids.map((id) => (
            <button
              key={id}
              className="chip"
              title="Remove"
              onClick={() => set({ territory_ids: draft.territory_ids.filter((x) => x !== id) })}
            >
              {byId.get(id)?.name ?? id} ✕
            </button>
          ))}
        </div>
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
