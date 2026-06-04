import { Ros } from "roslib"
import { create } from "zustand"

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface RosState {
  ros: Ros | null
  status: ConnectionStatus
  lastError: string | null
  connect: (url: string) => void
  disconnect: () => void
}

export const useRosStore = create<RosState>((set, get) => ({
  ros: null,
  status: "disconnected",
  lastError: null,

  connect: (url: string) => {
    if (get().ros) return
    set({ status: "connecting", lastError: null })

    const ros = new Ros({ url })

    ros.on("connection", () => set({ status: "connected" }))
    ros.on("close", () => set({ status: "disconnected" }))
    ros.on("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      set({ status: "error", lastError: message })
    })

    set({ ros })
  },

  disconnect: () => {
    get().ros?.close()
    set({ ros: null, status: "disconnected" })
  },
}))
