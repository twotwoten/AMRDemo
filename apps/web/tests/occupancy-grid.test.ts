import { describe, it, expect } from "vitest"
import { occupancyGridToRGBA } from "@/lib/occupancy-grid"

describe("occupancyGridToRGBA", () => {
  it("maps unknown(-1)→gray, free(0)→white, occupied(100)→black", () => {
    const rgba = occupancyGridToRGBA([-1, 0, 100], 3, 1)
    expect(Array.from(rgba.slice(0, 4))).toEqual([127, 127, 127, 255]) // unknown
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 255, 255, 255]) // free
    expect(Array.from(rgba.slice(8, 12))).toEqual([0, 0, 0, 255]) // occupied
  })

  it("produces width*height*4 bytes", () => {
    const rgba = occupancyGridToRGBA(new Array(80 * 60).fill(0), 80, 60)
    expect(rgba.length).toBe(80 * 60 * 4)
  })
})
