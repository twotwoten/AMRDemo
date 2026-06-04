"use client"

import { useEffect } from "react"
import { useRosStore } from "@/lib/ros-client"

export function ROSProvider({ children }: { children: React.ReactNode }) {
  const connect = useRosStore((s) => s.connect)
  const disconnect = useRosStore((s) => s.disconnect)

  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_ROSBRIDGE_URL ?? "ws://localhost:9090"
    connect(url)
    return () => disconnect()
  }, [connect, disconnect])

  return <>{children}</>
}
