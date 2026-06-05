import { describe, it, expect, beforeEach, vi } from "vitest"

// roslib uses WebSocket internally — mock it before importing the store.
vi.mock("roslib", () => {
  class FakeRos {
    handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
    constructor(_opts: { url: string }) {}
    on(event: string, cb: (...args: unknown[]) => void) {
      ;(this.handlers[event] ??= []).push(cb)
    }
    close() {
      this.handlers.close?.forEach((cb) => cb())
    }
    fire(event: string, payload?: unknown) {
      this.handlers[event]?.forEach((cb) => cb(payload))
    }
  }
  class FakeTopic {
    static subscribers: ((msg: unknown) => void)[] = []
    constructor(_opts: { ros: unknown; name: string; messageType: string }) {}
    subscribe(cb: (msg: unknown) => void) {
      FakeTopic.subscribers.push(cb)
    }
    unsubscribe() {
      FakeTopic.subscribers = []
    }
  }
  return { Ros: FakeRos, Topic: FakeTopic }
})

import { useRosStore, subscribeTopic } from "@/lib/ros-client"

describe("ros-client store", () => {
  beforeEach(() => {
    useRosStore.setState({ ros: null, status: "disconnected", lastError: null })
  })

  it("transitions to connecting then connected", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    expect(useRosStore.getState().status).toBe("connecting")

    const ros = useRosStore.getState().ros as unknown as { fire: (e: string) => void }
    ros.fire("connection")
    expect(useRosStore.getState().status).toBe("connected")
  })

  it("captures error messages", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    const ros = useRosStore.getState().ros as unknown as {
      fire: (e: string, p?: unknown) => void
    }
    ros.fire("error", new Error("nope"))
    expect(useRosStore.getState().status).toBe("error")
    expect(useRosStore.getState().lastError).toBe("nope")
  })

  it("disconnect resets the store", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    useRosStore.getState().disconnect()
    expect(useRosStore.getState().status).toBe("disconnected")
    expect(useRosStore.getState().ros).toBeNull()
  })
})

describe("subscribeTopic helper", () => {
  beforeEach(() => {
    useRosStore.setState({ ros: null, status: "disconnected", lastError: null })
  })

  it("forwards topic messages to the callback", async () => {
    const roslib = await import("roslib")
    const FakeTopic = (roslib as unknown as {
      Topic: { subscribers: ((msg: unknown) => void)[] }
    }).Topic

    useRosStore.getState().connect("ws://localhost:9090")
    const ros = useRosStore.getState().ros as unknown as { fire: (e: string) => void }
    ros.fire("connection")

    const received: unknown[] = []
    const unsub = subscribeTopic<{ pose: { pose: { position: { x: number; y: number } } } }>(
      "/odom",
      "nav_msgs/msg/Odometry",
      (msg) => received.push(msg),
    )

    FakeTopic.subscribers.forEach((cb) =>
      cb({ pose: { pose: { position: { x: 1, y: 2 } } } }),
    )
    expect(received).toHaveLength(1)

    unsub()
    expect(FakeTopic.subscribers).toHaveLength(0)
  })

  it("returns a no-op unsubscribe when not connected", () => {
    const unsub = subscribeTopic("/odom", "nav_msgs/msg/Odometry", () => {})
    expect(() => unsub()).not.toThrow()
  })
})
