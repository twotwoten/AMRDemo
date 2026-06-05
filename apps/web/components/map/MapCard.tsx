"use client"

import type { MapMeta } from "@/lib/maps-api"
import { exportMapUrl } from "@/lib/maps-api"

export function MapCard({
  map,
  onActivate,
  onDelete,
}: {
  map: MapMeta
  onActivate: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex h-32 items-center justify-center rounded bg-neutral-100 text-neutral-400">
        {/* 썸네일은 bridge가 파일경로로 보관 — MVP에선 placeholder, 정적 서빙은 후속 */}
        🗺️ {map.width}×{map.height}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-medium">{map.name}</span>
        {map.isActive && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            활성
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {new Date(map.createdAt).toLocaleString()} · {map.resolution} m/px
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <button
          className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-50"
          onClick={() => onActivate(map.id)}
          disabled={map.isActive}
        >
          활성화
        </button>
        <a
          className="rounded border border-neutral-300 px-2 py-1"
          href={exportMapUrl(map.id)}
        >
          내보내기
        </a>
        <button
          className="rounded border border-red-300 px-2 py-1 text-red-600"
          onClick={() => onDelete(map.id)}
        >
          삭제
        </button>
      </div>
    </div>
  )
}
