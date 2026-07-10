import { memo, useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { MAP_HEIGHT, MAP_WIDTH } from '../lib/mapData'
import { STATUS_LABELS } from '../lib/statuses'
import type { Status, Territory } from '../types'

interface MapViewProps {
  territories: Territory[]
  statuses: Record<string, Status>
  /** Non-null while a trip is being edited: click toggles membership instead of cycling status. */
  pickedIds: Set<string> | null
  onTerritoryClick: (id: string) => void
  onTerritoryContext: (id: string) => void
}

interface Transform {
  x: number
  y: number
  k: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 60

/** Memoized so hover/tooltip state changes don't re-render 300 paths. */
const MapPaths = memo(function MapPaths({
  territories,
  statuses,
  pickedIds,
  onClick,
  onContext,
}: {
  territories: Territory[]
  statuses: Record<string, Status>
  pickedIds: Set<string> | null
  onClick: (id: string) => void
  onContext: (id: string) => void
}) {
  return (
    <>
      {territories.map((t) => (
        <path
          key={t.id}
          d={t.path}
          className="territory"
          data-status={statuses[t.id] ?? 'not_visited'}
          data-picked={pickedIds?.has(t.id) ? '' : undefined}
          data-territory-id={t.id}
          onClick={() => onClick(t.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            onContext(t.id)
          }}
        />
      ))}
    </>
  )
})

export function MapView({
  territories,
  statuses,
  pickedIds,
  onTerritoryClick,
  onTerritoryContext,
}: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const [hovered, setHovered] = useState<Territory | null>(null)

  // Pointer bookkeeping for drag-pan and two-finger pinch. Lives in refs:
  // pointer moves must not re-render the map.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragMoved = useRef(false)
  const pinchDist = useRef(0)
  const lastMouse = useRef({ x: 0, y: 0 })

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    // preserveAspectRatio="xMidYMid meet": uniform scale, centered.
    const scale = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT)
    const offX = (rect.width - MAP_WIDTH * scale) / 2
    const offY = (rect.height - MAP_HEIGHT * scale) / 2
    return {
      x: (clientX - rect.left - offX) / scale,
      y: (clientY - rect.top - offY) / scale,
    }
  }, [])

  const clampTransform = useCallback((t: Transform): Transform => {
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k))
    // Keep the map from being dragged fully out of view.
    const margin = 0.5
    const x = Math.min(MAP_WIDTH * margin, Math.max(-MAP_WIDTH * (k - margin), t.x))
    const y = Math.min(MAP_HEIGHT * margin, Math.max(-MAP_HEIGHT * (k - margin), t.y))
    return { x, y, k }
  }, [])

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setTransform((t) => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor))
        const actual = k / t.k
        return clampTransform({
          k,
          x: cx - (cx - t.x) * actual,
          y: cy - (cy - t.y) * actual,
        })
      })
    },
    [clampTransform],
  )

  const onWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      const p = toSvgPoint(e.clientX, e.clientY)
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0018))
    },
    [toSvgPoint, zoomAt],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 1) dragMoved.current = false
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
      }
      svgRef.current?.setPointerCapture(e.pointerId)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      // Tooltip follows the cursor without touching React state.
      lastMouse.current = { x: e.clientX, y: e.clientY }
      const tip = tooltipRef.current
      if (tip) {
        tip.style.left = `${e.clientX + 14}px`
        tip.style.top = `${e.clientY + 14}px`
      }

      const prev = pointers.current.get(e.pointerId)
      if (!prev) return
      const cur = { x: e.clientX, y: e.clientY }
      pointers.current.set(e.pointerId, cur)

      if (pointers.current.size === 1) {
        const dx = cur.x - prev.x
        const dy = cur.y - prev.y
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          const a = toSvgPoint(prev.x, prev.y)
          const b = toSvgPoint(cur.x, cur.y)
          if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 2) dragMoved.current = true
          setTransform((t) => clampTransform({ ...t, x: t.x + (b.x - a.x), y: t.y + (b.y - a.y) }))
        }
      } else if (pointers.current.size === 2) {
        dragMoved.current = true
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist.current > 0) {
          const mid = toSvgPoint((a.x + b.x) / 2, (a.y + b.y) / 2)
          zoomAt(mid.x, mid.y, dist / pinchDist.current)
        }
        pinchDist.current = dist
      }
    },
    [toSvgPoint, clampTransform, zoomAt],
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    pinchDist.current = 0
  }, [])

  // Swallow the click that ends a drag so it doesn't cycle a territory.
  const handleTerritoryClick = useCallback(
    (id: string) => {
      if (dragMoved.current) return
      onTerritoryClick(id)
    },
    [onTerritoryClick],
  )

  const handleHover = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const el = e.target as SVGElement
      const id = el.getAttribute?.('data-territory-id')
      setHovered((prev) => {
        if (!id) return prev === null ? prev : null
        if (prev?.id === id) return prev
        return territories.find((t) => t.id === id) ?? null
      })
    },
    [territories],
  )

  const hoveredStatus = hovered ? (statuses[hovered.id] ?? 'not_visited') : null

  return (
    <div className="map-container">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerOver={handleHover}
        onPointerLeave={() => setHovered(null)}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <MapPaths
            territories={territories}
            statuses={statuses}
            pickedIds={pickedIds}
            onClick={handleTerritoryClick}
            onContext={onTerritoryContext}
          />
        </g>
      </svg>
      <div className="zoom-controls">
        <button onClick={() => zoomAt(MAP_WIDTH / 2, MAP_HEIGHT / 2, 1.6)} title="Zoom in">
          +
        </button>
        <button onClick={() => zoomAt(MAP_WIDTH / 2, MAP_HEIGHT / 2, 1 / 1.6)} title="Zoom out">
          −
        </button>
        <button onClick={() => setTransform({ x: 0, y: 0, k: 1 })} title="Reset view">
          ⤢
        </button>
      </div>
      {hovered && (
        <div
          ref={tooltipRef}
          className="map-tooltip"
          style={{ left: lastMouse.current.x + 14, top: lastMouse.current.y + 14 }}
        >
          <strong>{hovered.name}</strong>
          <span data-status={hoveredStatus}>{STATUS_LABELS[hoveredStatus!]}</span>
          {pickedIds && (
            <em>{pickedIds.has(hovered.id) ? 'In this trip — click to remove' : 'Click to add to trip'}</em>
          )}
        </div>
      )}
    </div>
  )
}
