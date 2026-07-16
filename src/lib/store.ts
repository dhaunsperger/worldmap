import { useSyncExternalStore } from 'react'
import { nextStatus, STATUS_RANK } from './statuses'
import type { Status, Trip, TripDraft } from '../types'

/**
 * All persistence lives here. The source of truth is localStorage (instant,
 * synchronous); optionally a JSON file is "linked" via the File System Access
 * API and auto-written after every change — point it at a file inside your
 * OneDrive folder and the OneDrive client gives you cloud backup for free.
 *
 * On startup, if the linked file's updated_at is newer than local data (e.g.
 * OneDrive synced changes from another machine), the file wins silently.
 */

export interface AppData {
  version: 1
  updated_at: string
  statuses: Record<string, Status>
  trips: Trip[]
}

export type FileSyncState =
  | 'unsupported' // browser has no File System Access API (Firefox/Safari/mobile)
  | 'none' // no file linked yet
  | 'needs-permission' // handle restored but browser wants a fresh user-gesture grant
  | 'linked'
  | 'error'

export interface Snapshot {
  data: AppData
  fileState: FileSyncState
  fileName: string | null
  error: string | null
}

const LS_KEY = 'worldmap-data'
const IDB_NAME = 'worldmap'
const IDB_STORE = 'handles'
const FILE_HANDLE_KEY = 'syncFile'
const FILE_WRITE_DELAY_MS = 800

const VALID_STATUS = new Set<string>(['visited', 'slept_in', 'lived_in'])
const VALID_TRIP_STATUS = new Set<string>(['visited', 'slept_in'])

const emptyData = (): AppData => ({
  version: 1,
  updated_at: new Date().toISOString(),
  statuses: {},
  trips: [],
})

/**
 * Validate/coerce unknown JSON into AppData. Accepts both this app's own
 * export shape and the one-time Supabase rescue export (which has
 * `exported_at` instead of `updated_at`). Returns null if unusable.
 */
export function parseAppData(raw: unknown): AppData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.statuses !== 'object' && !Array.isArray(obj.trips)) return null

  const statuses: Record<string, Status> = {}
  if (typeof obj.statuses === 'object' && obj.statuses !== null) {
    for (const [id, status] of Object.entries(obj.statuses as Record<string, unknown>)) {
      if (typeof status === 'string' && VALID_STATUS.has(status)) statuses[id] = status as Status
    }
  }

  const trips: Trip[] = []
  if (Array.isArray(obj.trips)) {
    for (const t of obj.trips as Record<string, unknown>[]) {
      if (typeof t !== 'object' || t === null || typeof t.name !== 'string') continue
      const territories = Array.isArray(t.territories)
        ? (t.territories as Record<string, unknown>[])
            .filter(
              (tt) =>
                tt &&
                typeof tt.territory_id === 'string' &&
                typeof tt.status === 'string' &&
                VALID_TRIP_STATUS.has(tt.status),
            )
            .map((tt) => ({
              territory_id: tt.territory_id as string,
              status: tt.status as Trip['territories'][number]['status'],
            }))
        : []
      trips.push({
        id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
        name: t.name,
        start_date: typeof t.start_date === 'string' ? t.start_date : null,
        end_date: typeof t.end_date === 'string' ? t.end_date : null,
        notes: typeof t.notes === 'string' ? t.notes : '',
        created_at: typeof t.created_at === 'string' ? t.created_at : new Date().toISOString(),
        territories,
      })
    }
  }

  const updated =
    typeof obj.updated_at === 'string'
      ? obj.updated_at
      : typeof obj.exported_at === 'string'
        ? obj.exported_at
        : new Date().toISOString()

  return { version: 1, updated_at: updated, statuses, trips: sortTrips(trips) }
}

/** Sort: dated trips newest-first, undated trips last (newest-created first). */
function sortTrips(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => {
    if (a.start_date && b.start_date) return b.start_date.localeCompare(a.start_date)
    if (a.start_date) return -1
    if (b.start_date) return 1
    return b.created_at.localeCompare(a.created_at)
  })
}

// --- tiny IndexedDB wrapper (FileSystemFileHandle survives structured clone,
// so IDB is the only place a handle can be persisted across page loads) ---

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// --- the store ---

const FILE_PICKER_OPTS: SaveFilePickerOptions = {
  suggestedName: 'worldmap.json',
  types: [{ description: 'Worldmap data', accept: { 'application/json': ['.json'] } }],
}

class Store {
  private data: AppData
  private handle: FileSystemFileHandle | null = null
  private fileState: FileSyncState
  private error: string | null = null
  private listeners = new Set<() => void>()
  private snapshot!: Snapshot
  private writeTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.fileState =
      typeof window !== 'undefined' && 'showSaveFilePicker' in window ? 'none' : 'unsupported'
    this.data = emptyData()
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = parseAppData(JSON.parse(raw))
        if (parsed) this.data = parsed
      }
    } catch {
      // corrupted localStorage: start empty rather than crash
    }
    this.rebuildSnapshot()
    if (this.fileState !== 'unsupported') void this.restoreHandle()
  }

  // -- subscription plumbing (useSyncExternalStore) --

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.snapshot

  private rebuildSnapshot() {
    this.snapshot = {
      data: this.data,
      fileState: this.fileState,
      fileName: this.handle?.name ?? null,
      error: this.error,
    }
  }

  private notify() {
    this.rebuildSnapshot()
    for (const fn of this.listeners) fn()
  }

  // -- persistence --

  private update(mutate: (d: AppData) => Partial<AppData>) {
    this.data = { ...this.data, ...mutate(this.data), updated_at: new Date().toISOString() }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.data))
    } catch (e) {
      this.error = `Could not save locally: ${e}`
    }
    this.scheduleFileWrite()
    this.notify()
  }

  private scheduleFileWrite() {
    if (this.fileState !== 'linked' || !this.handle) return
    clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => void this.writeFile(), FILE_WRITE_DELAY_MS)
  }

  private async writeFile() {
    if (!this.handle) return
    try {
      const writable = await this.handle.createWritable()
      await writable.write(JSON.stringify(this.data, null, 2))
      await writable.close()
      if (this.fileState !== 'linked') {
        this.fileState = 'linked'
        this.notify()
      }
    } catch (e) {
      this.fileState = 'error'
      this.error = `Could not write ${this.handle.name}: ${e}`
      this.notify()
    }
  }

  /** Adopt whichever of file/local is newer; write the file if local wins. */
  private async syncWithFile() {
    if (!this.handle) return
    const file = await this.handle.getFile()
    const parsed = parseAppData(JSON.parse(await file.text() || 'null'))
    if (parsed && parsed.updated_at > this.data.updated_at) {
      this.data = parsed
      localStorage.setItem(LS_KEY, JSON.stringify(this.data))
    } else {
      await this.writeFile()
    }
  }

  private async restoreHandle() {
    try {
      const handle = await idbGet<FileSystemFileHandle>(FILE_HANDLE_KEY)
      if (!handle) return
      this.handle = handle
      const perm = await handle.queryPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        await this.syncWithFile()
        this.fileState = 'linked'
      } else {
        this.fileState = 'needs-permission'
      }
    } catch (e) {
      this.fileState = 'error'
      this.error = `Sync file unavailable: ${e}`
    }
    this.notify()
  }

  // -- file linking (all must be called from a user gesture) --

  /** Re-grant permission for the remembered file and sync with it. */
  async reconnectFile() {
    if (!this.handle) return
    try {
      const perm = await this.handle.requestPermission({ mode: 'readwrite' })
      if (perm !== 'granted') return
      await this.syncWithFile()
      this.fileState = 'linked'
      this.error = null
    } catch (e) {
      this.fileState = 'error'
      this.error = `Could not reconnect: ${e}`
    }
    this.notify()
  }

  /** Create a fresh sync file seeded with the current data. */
  async createSyncFile() {
    try {
      const handle = await window.showSaveFilePicker(FILE_PICKER_OPTS)
      this.handle = handle
      await idbSet(FILE_HANDLE_KEY, handle)
      this.fileState = 'linked'
      this.error = null
      await this.writeFile()
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') this.error = `Could not create file: ${e}`
    }
    this.notify()
  }

  /**
   * Link an existing sync file. If it contains data, the file's contents
   * REPLACE local data (that's what "open" means); an empty/blank file is
   * seeded with local data instead. Caller confirms with the user first.
   */
  async openSyncFile() {
    try {
      const [handle] = await window.showOpenFilePicker({ types: FILE_PICKER_OPTS.types })
      const file = await handle.getFile()
      const text = await file.text()
      let parsed: AppData | null = null
      try {
        parsed = parseAppData(JSON.parse(text))
      } catch {
        parsed = null
      }
      if (text.trim() && !parsed) {
        this.error = `${handle.name} is not a worldmap data file.`
        this.notify()
        return
      }
      this.handle = handle
      await idbSet(FILE_HANDLE_KEY, handle)
      this.fileState = 'linked'
      this.error = null
      if (parsed && (Object.keys(parsed.statuses).length || parsed.trips.length)) {
        this.data = parsed
        localStorage.setItem(LS_KEY, JSON.stringify(this.data))
      } else {
        await this.writeFile()
      }
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') this.error = `Could not open file: ${e}`
    }
    this.notify()
  }

  async unlinkFile() {
    clearTimeout(this.writeTimer)
    this.handle = null
    this.fileState = this.fileState === 'unsupported' ? 'unsupported' : 'none'
    await idbDelete(FILE_HANDLE_KEY)
    this.notify()
  }

  retryFileWrite() {
    if (this.handle) void this.writeFile()
  }

  // -- export / import (work in every browser) --

  exportDownload() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `worldmap-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Replace all data with the given parsed import. */
  importData(parsed: AppData) {
    this.update(() => ({ statuses: parsed.statuses, trips: parsed.trips }))
  }

  clearError() {
    if (this.error === null) return
    this.error = null
    this.notify()
  }

  // -- domain actions --

  setStatus(territoryId: string, status: Status) {
    this.update((d) => {
      const statuses = { ...d.statuses }
      if (status === 'not_visited') delete statuses[territoryId]
      else statuses[territoryId] = status
      return { statuses }
    })
  }

  cycleStatus(territoryId: string) {
    this.setStatus(territoryId, nextStatus(this.data.statuses[territoryId] ?? 'not_visited'))
  }

  /** Raise a territory to at least `status` — never downgrade (trip save). */
  raiseStatus(territoryId: string, status: Status) {
    const current = this.data.statuses[territoryId] ?? 'not_visited'
    if (STATUS_RANK[status] > STATUS_RANK[current]) this.setStatus(territoryId, status)
  }

  /** Save a trip and paint its territories at least as strongly as it claims. */
  saveTrip(draft: TripDraft): Trip {
    const existing = draft.id ? this.data.trips.find((t) => t.id === draft.id) : undefined
    const saved: Trip = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name.trim() || 'Untitled trip',
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      notes: draft.notes,
      created_at: existing?.created_at ?? new Date().toISOString(),
      territories: draft.territories,
    }
    this.update((d) => ({ trips: sortTrips([...d.trips.filter((t) => t.id !== saved.id), saved]) }))
    for (const tt of saved.territories) this.raiseStatus(tt.territory_id, tt.status)
    return saved
  }

  /**
   * Delete a trip. With `resetTerritories`, re-derive each member territory's
   * status from the remaining trips — but never touch lived_in (trips can't
   * set it, so it was painted by hand).
   */
  deleteTrip(id: string, resetTerritories: boolean) {
    const doomed = this.data.trips.find((t) => t.id === id)
    this.update((d) => ({ trips: d.trips.filter((t) => t.id !== id) }))
    if (!doomed || !resetTerritories) return
    for (const tt of doomed.territories) {
      const current = this.data.statuses[tt.territory_id] ?? 'not_visited'
      if (current === 'not_visited' || current === 'lived_in') continue
      let implied: Status = 'not_visited'
      for (const t of this.data.trips) {
        for (const other of t.territories) {
          if (
            other.territory_id === tt.territory_id &&
            STATUS_RANK[other.status] > STATUS_RANK[implied]
          ) {
            implied = other.status
          }
        }
      }
      if (STATUS_RANK[implied] < STATUS_RANK[current]) this.setStatus(tt.territory_id, implied)
    }
  }
}

export const store = new Store()

export function useAppStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
