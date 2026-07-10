import { useEffect, useMemo, useState } from 'react'
import { MapView } from './components/MapView'
import { TerritoryPanel } from './components/TerritoryPanel'
import { TripsPanel } from './components/TripsPanel'
import { TripEditor } from './components/TripEditor'
import { Dashboard } from './components/Dashboard'
import { AuthScreen } from './components/AuthScreen'
import { SetupScreen } from './components/SetupScreen'
import { useAuth } from './hooks/useAuth'
import { useStatuses } from './hooks/useStatuses'
import { useTrips } from './hooks/useTrips'
import { loadTerritories } from './lib/mapData'
import { supabaseConfigured } from './lib/supabase'
import { STATUS_CYCLE, STATUS_COLORS, STATUS_LABELS, STATUS_RANK } from './lib/statuses'
import type { Status, Territory, Trip, TripDraft } from './types'

type Panel = { type: 'territory'; id: string } | { type: 'trips' } | null

/** VITE_DEMO=1 skips Supabase entirely: full UI, in-memory data only. */
const DEMO = import.meta.env.VITE_DEMO === '1'

const emptyDraft = (territoryIds: string[] = []): TripDraft => ({
  name: '',
  start_date: null,
  end_date: null,
  notes: '',
  territories: territoryIds.map((id) => ({ territory_id: id, status: 'visited' })),
})

export default function App() {
  const auth = useAuth()
  const userId = auth.session?.user.id
  const { statuses, setStatus, cycleStatus, raiseStatus, error: statusError, clearError: clearStatusError } = useStatuses(userId)
  const { trips, saveTrip, deleteTrip, error: tripError, clearError: clearTripError } = useTrips(userId)

  const [territories, setTerritories] = useState<Territory[] | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [draft, setDraft] = useState<TripDraft | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [saving, setSaving] = useState(false)
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

  if (!DEMO) {
    if (!supabaseConfigured) return <SetupScreen />
    if (auth.loading) return <div className="centered-screen muted">Loading…</div>
    if (!auth.session) return <AuthScreen signIn={auth.signIn} signUp={auth.signUp} />
  }
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
      cycleStatus(id)
    }
  }

  const handleSaveTrip = async () => {
    if (!draft) return
    setSaving(true)
    const saved = await saveTrip(draft)
    setSaving(false)
    if (saved) {
      // Paint the map at least as strongly as the trip claims (never downgrade).
      for (const tt of saved.territories) raiseStatus(tt.territory_id, tt.status)
      setDraft(null)
      setPanel({ type: 'trips' })
    }
  }

  const confirmDeleteTrip = async (resetTerritories: boolean) => {
    const doomed = pendingDelete
    setPendingDelete(null)
    if (!doomed?.id) return
    await deleteTrip(doomed.id)
    if (resetTerritories) {
      // Re-derive each territory's status from the trips that remain. Manual
      // paint isn't tracked separately, so this is best-effort — but leave
      // lived_in alone (trips can't set it, so it was set by hand).
      const remaining = trips.filter((t) => t.id !== doomed.id)
      for (const tt of doomed.territories) {
        const current = statuses[tt.territory_id] ?? 'not_visited'
        if (current === 'not_visited' || current === 'lived_in') continue
        let implied: Status = 'not_visited'
        for (const t of remaining) {
          for (const other of t.territories) {
            if (
              other.territory_id === tt.territory_id &&
              STATUS_RANK[other.status] > STATUS_RANK[implied]
            ) {
              implied = other.status
            }
          }
        }
        if (STATUS_RANK[implied] < STATUS_RANK[current]) setStatus(tt.territory_id, implied)
      }
    }
    setDraft(null)
    setPanel({ type: 'trips' })
  }

  const startEditTrip = (trip: Trip) => {
    setPanel(null)
    setDraft({ ...trip })
  }

  const error = statusError ?? tripError
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
          {!DEMO && (
            <button
              className="subtle"
              onClick={() => auth.signOut()}
              title={auth.session?.user.email}
            >
              Sign out
            </button>
          )}
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
            onSetStatus={(s) => setStatus(selectedTerritory.id, s)}
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
            saving={saving}
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
          <button
            className="icon-button"
            onClick={() => {
              clearStatusError()
              clearTripError()
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
