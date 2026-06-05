"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { RosStatus } from "@/components/ros/RosStatus"
import { Teleop } from "@/components/map/Teleop"
import { MappingStatus } from "@/components/map/MappingStatus"
import { SaveMapPanel } from "@/components/map/SaveMapPanel"

// Konva needs window — load the canvas client-only.
const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((m) => m.MapCanvas),
  { ssr: false, loading: () => <p className="text-neutral-400">맵 로딩 중…</p> },
)

export default function MapBuilderPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← 대시보드
          </Link>
          <h1 className="text-xl font-semibold">맵 빌더</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-blue-500 px-2 py-0.5 font-mono text-xs text-white">
            SIM
          </span>
          <RosStatus />
        </div>
      </header>

      {/* Layout B: 좌측 맵 + 우측 사이드바. 각 패널은 독립 컴포넌트라 배치 변경 쉬움. */}
      <section className="flex flex-col gap-4 p-6 lg:flex-row">
        <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">실시간 맵</h2>
          <MapCanvas />
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-72">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <Teleop />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">매핑 상태</h2>
            <MappingStatus />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">맵 저장</h2>
            <SaveMapPanel />
          </div>
        </aside>
      </section>
    </main>
  )
}
