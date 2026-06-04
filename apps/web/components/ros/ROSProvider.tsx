"use client"

import { useEffect } from "react"
import { useRosStore } from "@/lib/ros-client"

export function ROSProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_ROSBRIDGE_URL ?? "ws://localhost:9090"
    useRosStore.getState().connect(url)
    return () => useRosStore.getState().disconnect()
  }, [])

  return <>{children}</>
}
