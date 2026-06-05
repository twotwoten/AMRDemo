"use client"

import { useEffect, useRef, useState } from "react"
import { subscribeTopic, useRosStore } from "@/lib/ros-client"

interface OdomMsg {
  pose: { pose: { position: { x: number; y: number } } }
}

export function MappingStatus() {
  const status = useRosStore((s) => s.status)
  const [pose, setPose] = useState<{ x: number; y: number } | null>(null)
  const [hz, setHz] = useState(0)
  const ticks = useRef<number[]>([])

  useEffect(() => {
    const unsubOdom = subscribeTopic<OdomMsg>("/odom", "nav_msgs/msg/Odometry", (m) =>
      setPose({ x: m.pose.pose.position.x, y: m.pose.pose.position.y }),
    )
    const unsubMap = subscribeTopic<unknown>(
      "/map",
      "nav_msgs/msg/OccupancyGrid",
      () => {
        const now = Date.now()
        ticks.current = [...ticks.current, now].filter((t) => now - t < 5000)
        setHz(Number((ticks.current.length / 5).toFixed(1)))
      },
    )
    return () => {
      unsubOdom()
      unsubMap()
    }
  }, [])

  return (
    <div className="space-y-1 font-mono text-xs text-neutral-600">
      <div>연결: {status}</div>
      <div>/map: {hz} Hz</div>
      <div>x: {pose ? pose.x.toFixed(3) : "—"} m</div>
      <div>y: {pose ? pose.y.toFixed(3) : "—"} m</div>
    </div>
  )
}
