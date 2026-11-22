import { expect, it } from 'vitest'
import { createNeckDirectionReview } from './neckDirectionReview'

function frame(sequence: number, at: number, angle: number, mirror: boolean, shoulderAngle = 0) {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.38,
    z: 0,
    visibility: 0.99,
  }))
  landmarks[11] = {
    ...landmarks[11],
    x: 0.5 + 0.12 * Math.cos(shoulderAngle),
    y: 0.55 - 0.16 * Math.sin(shoulderAngle),
  }
  landmarks[12] = {
    ...landmarks[12],
    x: 0.5 - 0.12 * Math.cos(shoulderAngle),
    y: 0.55 + 0.16 * Math.sin(shoulderAngle),
  }
  // A front-facing subject's left ear appears at the larger raw x coordinate.
  landmarks[7] = {
    ...landmarks[7],
    x: 0.5 + 0.06 * Math.cos(angle),
    y: 0.38 - 0.08 * Math.sin(angle),
  }
  landmarks[8] = {
    ...landmarks[8],
    x: 0.5 - 0.06 * Math.cos(angle),
    y: 0.38 + 0.08 * Math.sin(angle),
  }
  if (mirror) for (const p of landmarks) p.x = 1 - p.x
  return {
    generation: 4,
    sequence,
    at,
    image: { width: 640, height: 480, imageIsMirrored: mirror },
    result: { landmarks: [landmarks] },
  }
}

it.each([false, true])(
  'checks physical directions relative to an explicit baseline (mirror=%s)',
  (mirror) => {
    const observer = createNeckDirectionReview(4)
    let next = 1
    const feed = (angle: number) => {
      const sequence = next++,
        at = sequence * 20
      observer.observe(frame(sequence, at, angle, mirror), at)
      return observer.read(at)
    }
    expect(feed(0.1)).toEqual({ state: 'waiting' })
    observer.align(30)
    feed(0.1)
    feed(0.1)
    expect(feed(0.1)).toEqual({ state: 'observed', direction: 'center' })
    expect(feed(-0.15)).toEqual({ state: 'settling' })
    feed(-0.15)
    expect(feed(-0.15)).toEqual({ state: 'observed', direction: 'left' })
    feed(0.35)
    feed(0.35)
    expect(feed(0.35)).toEqual({ state: 'observed', direction: 'right' })
    const missing = frame(next, next * 20, 0.35, mirror)
    missing.result.landmarks[0][7].visibility = 0.1
    observer.observe(missing, missing.at)
    expect(observer.read(missing.at)).toEqual({ state: 'unavailable' })
    expect(observer.read(missing.at + 1001)).toEqual({ state: 'unavailable' })
    observer.observe(frame(next + 1, missing.at + 1020, 0.35, mirror), missing.at + 1020)
    expect(observer.read(missing.at + 1020)).toEqual({ state: 'waiting' })
  },
)

it.each([false, true])('does not cue a neck tilt from shoulders alone (mirror=%s)', (mirror) => {
  const observer = createNeckDirectionReview(4)
  let next = 1
  const feed = (head: number, shoulders: number) => {
    const sequence = next++,
      at = sequence * 20
    observer.observe(frame(sequence, at, head, mirror, shoulders), at)
    return observer.read(at)
  }
  observer.align(0)
  for (let i = 0; i < 3; i++) feed(0, 0)
  feed(0, 0.25)
  feed(0, 0.25)
  expect(feed(0, 0.25)).toEqual({ state: 'settling' })
  feed(-0.25, 0)
  feed(-0.25, 0)
  expect(feed(-0.25, 0)).toEqual({ state: 'observed', direction: 'left' })
  feed(0.15, 0.35)
  feed(0.15, 0.35)
  expect(feed(0.15, 0.35)).toEqual({ state: 'settling' })
  feed(-0.25, -0.25)
  feed(-0.25, -0.25)
  expect(feed(-0.25, -0.25)).toEqual({ state: 'observed', direction: 'center' })
})
