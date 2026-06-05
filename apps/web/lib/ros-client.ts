import { Ros, Topic } from "roslib"
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
    if (get().status !== "disconnected") return
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

export type Unsubscribe = () => void

/**
 * Subscribe to a ROS2 topic through the active rosbridge connection.
 * Returns a no-op unsubscribe if no connection is established yet.
 */
export function subscribeTopic<T>(
  name: string,
  messageType: string,
  onMessage: (msg: T) => void,
): Unsubscribe {
  const ros = useRosStore.getState().ros
  if (!ros) return () => {}

  const topic = new Topic({ ros, name, messageType })
  topic.subscribe((msg) => onMessage(msg as T))
  return () => topic.unsubscribe()
}
