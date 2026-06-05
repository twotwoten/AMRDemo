export interface MapMeta {
  id: string
  name: string
  thumbnail: string | null
  resolution: number
  width: number
  height: number
  originX: number
  originY: number
  isActive: boolean
  createdAt: string
}

const BASE = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:8000"

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function getMaps(): Promise<MapMeta[]> {
  return json<MapMeta[]>(await fetch(`${BASE}/maps`))
}

export async function getActiveMap(): Promise<MapMeta | null> {
  return json<MapMeta | null>(await fetch(`${BASE}/maps/active`))
}

export async function saveMap(name: string): Promise<MapMeta> {
  return json<MapMeta>(
    await fetch(`${BASE}/maps/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function activateMap(id: string): Promise<MapMeta> {
  return json<MapMeta>(await fetch(`${BASE}/maps/${id}/activate`, { method: "POST" }))
}

export async function deleteMap(id: string): Promise<void> {
  const res = await fetch(`${BASE}/maps/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}

export function exportMapUrl(id: string): string {
  return `${BASE}/maps/${id}/export`
}
