/**
 * Convert a nav_msgs/OccupancyGrid `data` array (row-major, values -1..100)
 * into an RGBA buffer suitable for ImageData. -1=unknown(gray), 0=free(white),
 * higher=darker, 100=occupied(black).
 */
export function occupancyGridToRGBA(
  data: number[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = data[i]
    let shade: number
    if (v < 0) {
      shade = 127 // unknown
    } else {
      shade = Math.round(255 - (Math.min(100, v) / 100) * 255) // 0→255(white), 100→0(black)
    }
    const o = i * 4
    rgba[o] = shade
    rgba[o + 1] = shade
    rgba[o + 2] = shade
    rgba[o + 3] = 255
  }
  return rgba
}
