import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Trip, TripDraft } from '../types'

/** Sort: dated trips newest-first, undated trips last (newest-created first). */
function sortTrips(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => {
    if (a.start_date && b.start_date) return b.start_date.localeCompare(a.start_date)
    if (a.start_date) return -1
    if (b.start_date) return 1
    return b.created_at.localeCompare(a.created_at)
  })
}

export function useTrips(userId: string | undefined) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !supabase) return
    let cancelled = false
    Promise.all([
      supabase.from('trips').select('id, name, start_date, end_date, notes, created_at'),
      supabase.from('trip_territories').select('trip_id, territory_id'),
    ]).then(([tripsRes, ttRes]) => {
      if (cancelled) return
      if (tripsRes.error || ttRes.error) {
        setError((tripsRes.error ?? ttRes.error)!.message)
      } else {
        const byTrip: Record<string, string[]> = {}
        for (const row of ttRes.data) (byTrip[row.trip_id] ??= []).push(row.territory_id)
        setTrips(sortTrips(tripsRes.data.map((t) => ({ ...t, territory_ids: byTrip[t.id] ?? [] }))))
      }
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const saveTrip = useCallback(async (draft: TripDraft): Promise<Trip | null> => {
    const fields = {
      name: draft.name.trim() || 'Untitled trip',
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      notes: draft.notes,
    }
    if (!supabase) {
      // Demo mode: keep the trip in memory only.
      const saved: Trip = {
        ...fields,
        id: draft.id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        territory_ids: draft.territory_ids,
      }
      setTrips((prev) => sortTrips([...prev.filter((t) => t.id !== saved.id), saved]))
      return saved
    }
    let saved: Trip
    if (draft.id) {
      const { data, error } = await supabase
        .from('trips')
        .update(fields)
        .eq('id', draft.id)
        .select('id, name, start_date, end_date, notes, created_at')
        .single()
      if (error) {
        setError(error.message)
        return null
      }
      // Territory membership: replace wholesale — simplest correct sync.
      const del = await supabase.from('trip_territories').delete().eq('trip_id', draft.id)
      if (del.error) {
        setError(del.error.message)
        return null
      }
      saved = { ...data, territory_ids: draft.territory_ids }
    } else {
      const { data, error } = await supabase
        .from('trips')
        .insert(fields)
        .select('id, name, start_date, end_date, notes, created_at')
        .single()
      if (error) {
        setError(error.message)
        return null
      }
      saved = { ...data, territory_ids: draft.territory_ids }
    }
    if (draft.territory_ids.length) {
      const { error } = await supabase
        .from('trip_territories')
        .insert(draft.territory_ids.map((tid) => ({ trip_id: saved.id, territory_id: tid })))
      if (error) {
        setError(error.message)
        return null
      }
    }
    setTrips((prev) => sortTrips([...prev.filter((t) => t.id !== saved.id), saved]))
    return saved
  }, [])

  const deleteTrip = useCallback(async (id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id))
    if (!supabase) return
    const { error } = await supabase.from('trips').delete().eq('id', id)
    if (error) setError(error.message)
  }, [])

  return { trips, loaded, error, saveTrip, deleteTrip, clearError: () => setError(null) }
}
