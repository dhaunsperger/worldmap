import { useRef, useState } from 'react'
import { parseAppData, store } from '../lib/store'
import type { FileSyncState } from '../lib/store'

interface DataMenuProps {
  fileState: FileSyncState
  fileName: string | null
}

const DOT_COLOR: Record<FileSyncState, string> = {
  linked: 'var(--status-lived-in)',
  'needs-permission': 'var(--status-slept-in)',
  error: 'var(--danger)',
  none: 'var(--ink-muted)',
  unsupported: 'var(--ink-muted)',
}

export function DataMenu({ fileState, fileName }: DataMenuProps) {
  const [open, setOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const close = () => setOpen(false)

  const onImportFile = async (file: File) => {
    let parsed = null
    try {
      parsed = parseAppData(JSON.parse(await file.text()))
    } catch {
      parsed = null
    }
    if (!parsed) {
      alert(`${file.name} is not a worldmap data file.`)
      return
    }
    const summary = `${Object.keys(parsed.statuses).length} territory statuses and ${parsed.trips.length} trips`
    if (confirm(`Replace ALL current data with ${file.name} (${summary})?`)) {
      store.importData(parsed)
    }
  }

  return (
    <div className="data-menu">
      <button onClick={() => setOpen(!open)}>
        <i className="sync-dot" style={{ background: DOT_COLOR[fileState] }} />
        Data
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={close} />
          <div className="menu">
            {fileState === 'linked' && (
              <p className="menu-note">
                Auto-saving to <strong>{fileName}</strong>
              </p>
            )}
            {fileState === 'needs-permission' && (
              <button
                className="menu-item"
                onClick={() => {
                  void store.reconnectFile()
                  close()
                }}
              >
                🔓 Reconnect {fileName}
              </button>
            )}
            {fileState === 'error' && (
              <button
                className="menu-item"
                onClick={() => {
                  store.retryFileWrite()
                  close()
                }}
              >
                ↻ Retry writing {fileName}
              </button>
            )}
            {(fileState === 'none' || fileState === 'error') && (
              <>
                <button
                  className="menu-item"
                  onClick={() => {
                    void store.createSyncFile()
                    close()
                  }}
                >
                  ➕ Create sync file…
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    if (
                      confirm(
                        'Opening a sync file loads ITS data (replacing what is in this browser, unless the file is empty). Continue?',
                      )
                    ) {
                      void store.openSyncFile()
                    }
                    close()
                  }}
                >
                  📂 Open existing sync file…
                </button>
                <p className="menu-note">
                  Tip: put the sync file inside your OneDrive folder — you get cloud backup and
                  sync between computers for free.
                </p>
              </>
            )}
            {fileState === 'unsupported' && (
              <p className="menu-note">
                File auto-sync needs Chrome or Edge on desktop. Export/Import below works
                everywhere.
              </p>
            )}
            {fileState === 'linked' && (
              <button
                className="menu-item"
                onClick={() => {
                  void store.unlinkFile()
                  close()
                }}
              >
                ✕ Stop syncing to file
              </button>
            )}
            <hr />
            <button
              className="menu-item"
              onClick={() => {
                store.exportDownload()
                close()
              }}
            >
              ⬇ Export JSON
            </button>
            <button className="menu-item" onClick={() => fileInput.current?.click()}>
              ⬆ Import JSON…
            </button>
            <p className="menu-note">Import accepts this app's exports and the Supabase rescue export.</p>
          </div>
        </>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportFile(f)
          e.target.value = ''
          close()
        }}
      />
    </div>
  )
}
