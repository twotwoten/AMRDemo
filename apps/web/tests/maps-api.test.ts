import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMaps, saveMap, exportMapUrl } from "@/lib/maps-api"

describe("maps-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("getMaps GETs /maps", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [{ id: "m1" }] })
    vi.stubGlobal("fetch", fetchMock)
    const maps = await getMaps()
    expect(maps[0].id).toBe("m1")
    expect(fetchMock.mock.calls[0][0]).toContain("/maps")
  })

  it("saveMap POSTs name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "m2" }) })
    vi.stubGlobal("fetch", fetchMock)
    const m = await saveMap("새맵")
    expect(m.id).toBe("m2")
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ name: "새맵" })
  })

  it("throws on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }),
    )
    await expect(saveMap("dup")).rejects.toThrow(/409/)
  })

  it("exportMapUrl builds a URL", () => {
    expect(exportMapUrl("m1")).toContain("/maps/m1/export")
  })
})
