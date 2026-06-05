"use client"

import { useEffect, useRef, useState } from "react"
import { Stage, Layer, Image as KonvaImage, Circle } from "react-konva"
import { subscribeTopic } from "@/lib/ros-client"
import { occupancyGridToRGBA } from "@/lib/occupancy-grid"

interface OccupancyGridMsg {
  info: {
    width: number
    height: number
    resolution: number
    origin: { position: { x: number; y: number } }
  }
  data: number[]
}
interface OdomMsg {
  pose: { pose: { position: { x: number; y: number } } }
}

const VIEW = 480 // px square viewport

export function MapCanvas() {
  const [bitmap, setBitmap] = useState<HTMLCanvasElement | null>(null)
  const [grid, setGrid] = useState<OccupancyGridMsg["info"] | null>(null)
  const [robot, setRobot] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const unsub = subscribeTopic<OccupancyGridMsg>(
      "/map",
      "nav_msgs/msg/OccupancyGrid",
      (msg) => {
        const { width, height } = msg.info
        if (width === 0 || height === 0) return
        const cv = canvasRef.current ?? document.createElement("canvas")
        cv.width = width
        cv.height = height
        const ctx = cv.getContext("2d")
        if (!ctx) return
        const rgba = occupancyGridToRGBA(msg.data, width, height)
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
        canvasRef.current = cv
        setBitmap(cv)
        setGrid(msg.info)
      },
    )
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeTopic<OdomMsg>("/odom", "nav_msgs/msg/Odometry", (m) =>
      setRobot({ x: m.pose.pose.position.x, y: m.pose.pose.position.y }),
    )
    return unsub
  }, [])

  if (!bitmap || !grid) {
    return <p className="text-neutral-400">/map 토픽 수신 대기 중…</p>
  }

  // Fit the grid into the square viewport; OccupancyGrid origin is bottom-left,
  // so flip vertically (scaleY -1) to match screen coordinates.
  const scale = Math.min(VIEW / grid.width, VIEW / grid.height)
  const toPx = (wx: number, wy: number) => ({
    x: ((wx - grid.origin.position.x) / grid.resolution) * scale,
    y: VIEW - ((wy - grid.origin.position.y) / grid.resolution) * scale,
  })

  return (
    <Stage
      width={VIEW}
      height={VIEW}
      className="rounded border border-neutral-200 bg-neutral-100"
    >
      <Layer>
        <KonvaImage image={bitmap} scaleX={scale} scaleY={-scale} y={VIEW} />
        {robot &&
          (() => {
            const p = toPx(robot.x, robot.y)
            return (
              <Circle
                x={p.x}
                y={p.y}
                radius={6}
                fill="#2563eb"
                stroke="#fff"
                strokeWidth={2}
              />
            )
          })()}
      </Layer>
    </Stage>
  )
}
