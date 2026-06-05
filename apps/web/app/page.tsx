import Link from "next/link"
import { RosStatus } from "@/components/ros/RosStatus"
import { OdomReadout } from "@/components/ros/OdomReadout"
import { ActiveMapCard } from "@/components/map/ActiveMapCard"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">AMRDetail</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-blue-500 px-2 py-0.5 font-mono text-xs text-white">
            SIM
          </span>
          <RosStatus />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">현재 맵</h2>
          <ActiveMapCard />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">빠른 작업</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/map/new" className="text-blue-600 hover:underline">
                🗺️ 새 맵 만들기
              </Link>
            </li>
            <li>
              <Link href="/maps" className="text-blue-600 hover:underline">
                🗂️ 맵 관리
              </Link>
            </li>
            <li className="text-neutral-400">🎯 자율주행 시작 (Milestone 1C)</li>
            <li className="text-neutral-400">📋 미션 히스토리 (Milestone 1C)</li>
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">시스템 상태</h2>
          <OdomReadout />
        </div>
      </section>
    </main>
  )
}
