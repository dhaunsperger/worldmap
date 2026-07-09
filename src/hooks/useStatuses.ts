import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nextStatus } from '../lib/statuses'
import type { Status } from '../types'

/** Debounce per-territory writes so rapid cycling sends one final write. */
const PERSIST_DELAY_MS = 400

/**
 * Territory statuses for the signed-in user. Only non-default statuses are
 * stored; a missing key means 'not_visited'. Updates are optimistic — the map
 * repaints immediately and the write happens in the background. A ref mirrors
 * the latest state so rapid clicks (faster than a re-render) cycle correctly.
 */
export function useStatuses(userId: string | undefined) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const statusesRef = useRef<Record<string, Status>>({})
  const persistTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (!userId || !supabase) return
    let cancelled = false
    supabase
      .from('territory_status')
      .select('territory_id, status')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
        } else {
          const map: Record<string, Status> = {}
          for (const row of data) map[row.territory_id] = row.status as Status
          statusesRef.current = map
          setStatuses(map)
        }
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const persist = useCallback((territoryId: string, status: Status) => {
    if (!supabase) return
    const timers = persistTimers.current
    clearTimeout(timers.get(territoryId))
    timers.set(
      territoryId,
      setTimeout(async () => {
        timers.delete(territoryId)
        const { error } =
          status === 'not_visited'
            ? await supabase!.from('territory_status').delete().eq('territory_id', territoryId)
            : await supabase!
                .from('territory_status')
                .upsert(
                  { territory_id: territoryId, status, updated_at: new Date().toISOString() },
                  { onConflict: 'user_id,territory_id' },
                )
        if (error) setError(error.message)
      }, PERSIST_DELAY_MS),
    )
  }, [])

  const setStatus = useCallback(
    (territoryId: string, status: Status) => {
      const next = { ...statusesRef.current }
      if (status === 'not_visited') delete next[territoryId]
      else next[territoryId] = status
      statusesRef.current = next
      setStatuses(next)
      persist(territoryId, status)
    },
    [persist],
  )

  const cycleStatus = useCallback(
    (territoryId: string) => {
      setStatus(territoryId, nextStatus(statusesRef.current[territoryId] ?? 'not_visited'))
    },
    [setStatus],
  )

  /** Bump any not-yet-visited territories to 'visited' (used on trip save). */
  const markVisited = useCallback(
    (territoryIds: string[]) => {
      for (const id of territoryIds) {
        if (!statusesRef.current[id]) setStatus(id, 'visited')
      }
    },
    [setStatus],
  )

  return {
    statuses,
    loaded,
    error,
    setStatus,
    cycleStatus,
    markVisited,
    clearError: () => setError(null),
  }
}
