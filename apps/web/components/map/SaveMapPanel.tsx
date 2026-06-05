"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveMap } from "@/lib/maps-api"

export function SaveMapPanel() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveMap(name.trim())
      router.push("/maps")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        placeholder="맵 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        onClick={onSave}
        disabled={saving || !name.trim()}
      >
        {saving ? "저장 중…" : "맵 저장"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
