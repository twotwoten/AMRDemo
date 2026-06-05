import Link from "next/link"
import { MapList } from "@/components/map/MapList"

export default function MapsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← 대시보드
          </Link>
          <h1 className="text-xl font-semibold">맵 관리</h1>
        </div>
        <Link
          href="/map/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          + 새 맵 만들기
        </Link>
      </header>
      <section className="p-6">
        <MapList />
      </section>
    </main>
  )
}
