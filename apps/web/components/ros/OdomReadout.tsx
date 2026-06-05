"use client"

import { useEffect, useState } from "react"
import { subscribeTopic, useRosStore } from "@/lib/ros-client"

interface OdometryMessage {
  pose: {
    pose: {
      position: { x: number; y: number; z: number }
    }
  }
}

export function OdomReadout() {
  const status = useRosStore((s) => s.status)
  const [pose, setPose] = useState<{ x: number; y: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  useEffect(() => {
    if (status !== "connected") return
    const unsub = subscribeTopic<OdometryMessage>(
      "/odom",
      "nav_msgs/msg/Odometry",
      (msg) => {
        setPose({
          x: msg.pose.pose.position.x,
          y: msg.pose.pose.position.y,
        })
        setLastUpdate(Date.now())
      },
    )
    return unsub
  }, [status])

  if (status !== "connected") {
    return <p className="text-neutral-400">ROS 연결 대기 중…</p>
  }

  if (!pose) {
    return <p className="text-neutral-400">/odom 토픽 수신 대기 중…</p>
  }

  return (
    <div className="font-mono text-sm">
      <div>x: {pose.x.toFixed(3)} m</div>
      <div>y: {pose.y.toFixed(3)} m</div>
      {lastUpdate && (
        <div className="text-xs text-neutral-500">
          마지막 업데이트: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
