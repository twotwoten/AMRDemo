export interface Vec3 {
  x: number
  y: number
  z: number
}
export interface Twist {
  linear: Vec3
  angular: Vec3
}

// TurtleBot3 Waffle Pi safe limits.
export const LINEAR_SPEED = 0.22 // m/s
export const ANGULAR_SPEED = 1.0 // rad/s

function twist(lin: number, ang: number): Twist {
  return { linear: { x: lin, y: 0, z: 0 }, angular: { x: 0, y: 0, z: ang } }
}

/** WASD set → Twist. w/s forward/back, a/d turn left/right. */
export function keysToTwist(keys: Set<string>): Twist {
  let lin = 0
  let ang = 0
  if (keys.has("w")) lin += LINEAR_SPEED
  if (keys.has("s")) lin -= LINEAR_SPEED
  if (keys.has("a")) ang += ANGULAR_SPEED
  if (keys.has("d")) ang -= ANGULAR_SPEED
  return twist(lin, ang)
}

/** Joystick vector (x right, y up; each -1..1) → Twist. */
export function vectorToTwist(v: { x: number; y: number }): Twist {
  return twist(v.y * LINEAR_SPEED, -v.x * ANGULAR_SPEED)
}
