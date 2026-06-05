"use client"

import { useEffect, useRef } from "react"
import { createPublisher } from "@/lib/ros-client"
import { keysToTwist, vectorToTwist, type Twist } from "@/lib/teleop"

interface JoystickLike {
  on(
    type: "move",
    cb: (evt: unknown, data: { angle?: { radian: number }; force?: number }) => void,
  ): void
  on(type: "end", cb: () => void): void
  destroy(): void
}

export function Teleop() {
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const pub = createPublisher<Record<string, unknown>>(
      "/cmd_vel_teleop",
      "geometry_msgs/msg/Twist",
    )
    const send = (t: Twist) => pub.publish(t as unknown as Record<string, unknown>)

    // Keyboard
    const down = (e: KeyboardEvent) => {
      if (["w", "a", "s", "d"].includes(e.key)) {
        keys.current.add(e.key)
        send(keysToTwist(keys.current))
      }
    }
    const up = (e: KeyboardEvent) => {
      if (keys.current.delete(e.key)) send(keysToTwist(keys.current))
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)

    // Joystick — import nipplejs only on the client (it touches window at load).
    let manager: JoystickLike | null = null
    let cancelled = false
    void import("nipplejs").then(({ default: nipplejs }) => {
      if (cancelled || !zoneRef.current) return
      manager = nipplejs.create({
        zone: zoneRef.current,
        mode: "static",
        position: { left: "50%", top: "50%" },
      }) as unknown as JoystickLike
      manager.on("move", (_evt, d) => {
        const angle = d.angle?.radian ?? 0
        const force = Math.min(1, d.force ?? 0)
        send(vectorToTwist({ x: Math.cos(angle) * force, y: Math.sin(angle) * force }))
      })
      manager.on("end", () => send(vectorToTwist({ x: 0, y: 0 })))
    })

    return () => {
      cancelled = true
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      manager?.destroy()
      send({ linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } })
      pub.close()
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-neutral-500">조작 (WASD / 조이스틱)</div>
      <div ref={zoneRef} className="relative h-32 w-full rounded bg-neutral-100" />
    </div>
  )
}
