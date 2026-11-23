// FR-A-01/03: display smoothing only. Adaptive (One Euro) low-pass: heavy smoothing while still,
// light while moving, so resting limbs do not shimmer and quick motions do not lag.
// Casiez, Roussel & Vogel, "1€ Filter", CHI 2012.

export type MotionFilterOptions = Readonly<{
  // Cutoff (Hz) while still. Lower = steadier rest pose.
  minCutoffHz: number
  // Cutoff increase per unit/s of motion. Higher = less lag in fast motion.
  beta: number
  // Derivative cutoff (Hz).
  derivativeCutoffHz: number
  // A gap longer than this restarts the channel instead of smoothing across it.
  resetAfterMs: number
}>

export const DISPLAY_MOTION_FILTER: MotionFilterOptions = Object.freeze({
  minCutoffHz: 1.2,
  beta: 1.5,
  derivativeCutoffHz: 1,
  resetAfterMs: 400,
})

const smoothing = (cutoffHz: number, dtSeconds: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

type Channel = { at: number; value: number[]; derivative: number[] }

/** Named channels of fixed-length numeric vectors, each filtered on its own timeline. */
export function createMotionFilter(options: MotionFilterOptions = DISPLAY_MOTION_FILTER) {
  const { minCutoffHz, beta, derivativeCutoffHz, resetAfterMs } = options
  if (
    ![minCutoffHz, beta, derivativeCutoffHz, resetAfterMs].every(Number.isFinite) ||
    minCutoffHz <= 0 ||
    beta < 0 ||
    derivativeCutoffHz <= 0 ||
    resetAfterMs <= 0
  )
    throw new Error('Invalid motion filter')
  const channels = new Map<string, Channel>()
  return Object.freeze({
    /** Returns the filtered copy. Non-increasing time or a changed length restarts the channel. */
    apply(name: string, at: number, value: readonly number[]): number[] {
      const previous = channels.get(name)
      const dtMs = previous ? at - previous.at : 0
      if (
        !previous ||
        !Number.isFinite(at) ||
        previous.value.length !== value.length ||
        !(dtMs > 0) ||
        dtMs > resetAfterMs
      ) {
        channels.set(name, { at, value: [...value], derivative: value.map(() => 0) })
        return [...value]
      }
      const dt = dtMs / 1000
      const derivativeAlpha = smoothing(derivativeCutoffHz, dt)
      const derivative = value.map(
        (component, i) =>
          previous.derivative[i] +
          derivativeAlpha * ((component - previous.value[i]) / dt - previous.derivative[i]),
      )
      const speed = Math.hypot(...derivative)
      const alpha = smoothing(minCutoffHz + beta * speed, dt)
      const filtered = value.map(
        (component, i) => previous.value[i] + alpha * (component - previous.value[i]),
      )
      channels.set(name, { at, value: filtered, derivative })
      return [...filtered]
    },
    clear() {
      channels.clear()
    },
  })
}
