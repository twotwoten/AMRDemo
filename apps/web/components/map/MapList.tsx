"use client"

import { useEffect, useState } from "react"
import { getMaps, activateMap, deleteMap, type MapMeta } from "@/lib/maps-api"
import { MapCard } from "@/components/map/MapCard"

export function MapList() {
  const [maps, setMaps] = useState<MapMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setMaps(await getMaps())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  const onActivate = async (id: string) => {
    await activateMap(id)
    refresh()
  }
  const onDelete = async (id: string) => {
    await deleteMap(id)
    refresh()
  }

  if (error) return <p className="text-red-600">맵을 불러오지 못했습니다: {error}</p>
  if (maps.length === 0)
    return <p className="text-neutral-400">아직 저장된 맵이 없습니다.</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {maps.map((m) => (
        <MapCard key={m.id} map={m} onActivate={onActivate} onDelete={onDelete} />
      ))}
    </div>
  )
}
