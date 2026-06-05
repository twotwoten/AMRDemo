import { describe, it, expect } from "vitest"
import { keysToTwist, vectorToTwist, LINEAR_SPEED, ANGULAR_SPEED } from "@/lib/teleop"

describe("keysToTwist", () => {
  it("returns zero twist for no keys", () => {
    const t = keysToTwist(new Set())
    expect(t.linear.x).toBe(0)
    expect(t.angular.z).toBe(0)
  })
  it("w drives forward, a turns left", () => {
    const t = keysToTwist(new Set(["w", "a"]))
    expect(t.linear.x).toBeCloseTo(LINEAR_SPEED)
    expect(t.angular.z).toBeCloseTo(ANGULAR_SPEED)
  })
  it("w+s cancel out", () => {
    expect(keysToTwist(new Set(["w", "s"])).linear.x).toBe(0)
  })
})

describe("vectorToTwist", () => {
  it("maps joystick up to forward, right to clockwise", () => {
    const t = vectorToTwist({ x: 0, y: 1 }) // up
    expect(t.linear.x).toBeCloseTo(LINEAR_SPEED)
    const r = vectorToTwist({ x: 1, y: 0 }) // right
    expect(r.angular.z).toBeCloseTo(-ANGULAR_SPEED)
  })
})
