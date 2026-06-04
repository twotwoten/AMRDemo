"use client"

import { useRosStore } from "@/lib/ros-client"

const labels: Record<string, { dot: string; text: string; tone: string }> = {
  connected:    { dot: "●", text: "Connected",    tone: "text-emerald-600" },
  connecting:   { dot: "●", text: "Connecting…",  tone: "text-amber-500"   },
  disconnected: { dot: "●", text: "Disconnected", tone: "text-neutral-400" },
  error:        { dot: "●", text: "Error",        tone: "text-red-600"     },
}

export function RosStatus() {
  const status = useRosStore((s) => s.status)
  const lastError = useRosStore((s) => s.lastError)
  const label = labels[status] ?? labels.disconnected

  return (
    <span className={`flex items-center gap-1 text-sm ${label.tone}`} title={lastError ?? undefined}>
      <span>{label.dot}</span>
      <span>{label.text}</span>
    </span>
  )
}
