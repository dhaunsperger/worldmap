import { useEffect, useMemo, useState } from 'react'
import { MapView } from './components/MapView'
import { TerritoryPanel } from './components/TerritoryPanel'
import { TripsPanel } from './components/TripsPanel'
import { TripEditor } from './components/TripEditor'
import { Dashboard } from './components/Dashboard'
import { DataMenu } from './components/DataMenu'
import { loadTerritories } from './lib/mapData'
import { store, useAppStore } from './lib/store'
import { STATUS_CYCLE, STATUS_COLORS, STATUS_LABELS } from './lib/statuses'
import type { Territory, Trip, TripDraft } from './types'

type Panel = { type: 'territory'; id: string } | { type: 'trips' } | null

const emptyDraft = (territoryIds: string[] = []): TripDraft => ({
  name: '',
  start_date: null,
  end_date: null,
  notes: '',
  territories: territoryIds.map((id) => ({ territory_id: id, status: 'visited' })),
})

export default function App() {
  const { data, fileState, fileName, error } = useAppStore()
  const { statuses, trips } = data

  const [territories, setTerritories] = useState<Territory[] | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [draft, setDraft] = useState<TripDraft | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TripDraft | null>(null)

  useEffect(() => {
    loadTerritories().then(setTerritories, (e) => setMapError(String(e)))
  }, [])

  const byId = useMemo(
    () => new Map((territories ?? []).map((t) => [t.id, t])),
    [territories],
  )
  const territoryNames = useMemo(
    () => new Map((territories ?? []).map((t) => [t.id, t.name])),
    [territories],
  )

  if (mapError) return <div className="centered-screen error">{mapError}</div>
  if (!territories) return <div className="centered-screen muted">Loading map…</div>

  const handleTerritoryClick = (id: string) => {
    if (draft) {
      const inTrip = draft.territories.some((tt) => tt.territory_id === id)
      setDraft({
        ...draft,
        territories: inTrip
          ? draft.territories.filter((tt) => tt.territory_id !== id)
          : [...draft.territories, { territory_id: id, status: 'visited' }],
      })
    } else {
      store.cycleStatus(id)
    }
  }

  const handleSaveTrip = () => {
    if (!draft) return
    store.saveTrip(draft)
    setDraft(null)
    setPanel({ type: 'trips' })
  }

  const confirmDeleteTrip = (resetTerritories: boolean) => {
    const doomed = pendingDelete
    setPendingDelete(null)
    if (!doomed?.id) return
    store.deleteTrip(doomed.id, resetTerritories)
    setDraft(null)
    setPanel({ type: 'trips' })
  }

  const startEditTrip = (trip: Trip) => {
    setPanel(null)
    setDraft({ ...trip })
  }

  const selectedTerritory = panel?.type === 'territory' ? byId.get(panel.id) : undefined

  return (
    <div className="app">
      <header className="topbar">
        <h1>🗺️ Where I've Been</h1>
        <div className="legend-row topbar-legend">
          {STATUS_CYCLE.map((s) => (
            <span key={s} className="legend-item" title={STATUS_LABELS[s]}>
              <i className="swatch" style={{ background: STATUS_COLORS[s] }} />
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
        <div className="topbar-buttons">
          <button onClick={() => setPanel(panel?.type === 'trips' ? null : { type: 'trips' })}>
            Trips
          </button>
          <button onClick={() => setShowDashboard(true)}>Dashboard</button>
          <DataMenu fileState={fileState} fileName={fileName} />
        </div>
      </header>

      <div className="hint">
        {draft
          ? 'Trip mode: click territories to add or remove them from this trip.'
          : 'Click a territory to cycle its status · right-click for details & trips'}
      </div>

      <main className="main">
        <MapView
          territories={territories}
          statuses={statuses}
          pickedIds={draft ? new Set(draft.territories.map((tt) => tt.territory_id)) : null}
          onTerritoryClick={handleTerritoryClick}
          onTerritoryContext={(id) => {
            if (!draft) setPanel({ type: 'territory', id })
          }}
        />

        {selectedTerritory && (
          <TerritoryPanel
            territory={selectedTerritory}
            status={statuses[selectedTerritory.id] ?? 'not_visited'}
            trips={trips}
            onSetStatus={(s) => store.setStatus(selectedTerritory.id, s)}
            onEditTrip={startEditTrip}
            onNewTripHere={() => {
              setPanel(null)
              setDraft(emptyDraft([selectedTerritory.id]))
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {panel?.type === 'trips' && (
          <TripsPanel
            trips={trips}
            territoryNames={territoryNames}
            onEditTrip={startEditTrip}
            onNewTrip={() => {
              setPanel(null)
              setDraft(emptyDraft())
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {draft && (
          <TripEditor
            draft={draft}
            territories={territories}
            onChange={setDraft}
            onSave={handleSaveTrip}
            onDelete={draft.id ? () => setPendingDelete(draft) : null}
            onCancel={() => setDraft(null)}
            saving={false}
          />
        )}
      </main>

      {pendingDelete && (
        <div className="overlay" onClick={() => setPendingDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete “{pendingDelete.name || 'Untitled trip'}”?</h2>
            {pendingDelete.territories.length > 0 ? (
              <p className="muted">
                It covers {pendingDelete.territories.length}{' '}
                {pendingDelete.territories.length === 1 ? 'territory' : 'territories'}. You can
                also reset their map colors to whatever your other trips still support
                (hand-painted “lived in” is never touched).
              </p>
            ) : (
              <p className="muted">This can't be undone.</p>
            )}
            <div className="button-row">
              <button className="danger" onClick={() => confirmDeleteTrip(false)}>
                Delete trip only
              </button>
              {pendingDelete.territories.length > 0 && (
                <button className="danger" onClick={() => confirmDeleteTrip(true)}>
                  Delete &amp; reset territories
                </button>
              )}
              <button onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDashboard && (
        <Dashboard
          territories={territories}
          statuses={statuses}
          trips={trips}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {error && (
        <div className="toast error" role="alert">
          {error}
          <button className="icon-button" onClick={() => store.clearError()}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
