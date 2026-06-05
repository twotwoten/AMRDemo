"use client"

import { useEffect, useState } from "react"
import { getActiveMap, type MapMeta } from "@/lib/maps-api"

export function ActiveMapCard() {
  const [map, setMap] = useState<MapMeta | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getActiveMap()
      .then(setMap)
      .catch(() => setMap(null))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) return <p className="text-neutral-400">불러오는 중…</p>
  if (!map) return <p className="text-neutral-400">활성화된 맵이 없습니다.</p>
  return (
    <div>
      <p className="font-medium">{map.name}</p>
      <p className="text-xs text-neutral-500">
        {map.width}×{map.height} · {map.resolution} m/px
      </p>
    </div>
  )
}
