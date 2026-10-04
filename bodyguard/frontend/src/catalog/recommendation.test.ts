// FR-S-06: synthetic readiness cases, not real webcam or clinical validation.
import { describe, expect, it } from 'vitest'
import { previewMotions } from './motions'
import { recommendationReadiness, releasedMotionIds } from './recommendation'

describe('S3.1 recommendation readiness', () => {
  it('never releases development candidates', () => {
    expect(previewMotions.length).toBeGreaterThan(0)
    expect(releasedMotionIds).toEqual([])
    expect(Object.isFrozen(releasedMotionIds)).toBe(true)
  })
  it.each(['not-started', 'unavailable', 'observed'] as const)(
    'requires explicit purpose even with %s body information',
    (bodyCheck) => {
      expect(recommendationReadiness({ purpose: null, bodyCheck }).status).toBe('purpose-needed')
    },
  )
  it.each(['neck', 'shoulder', 'torso'] as const)(
    'does not infer body findings from the %s purpose',
    (purpose) => {
      for (const bodyCheck of ['not-started', 'unavailable'] as const) {
        const result = recommendationReadiness({ purpose, bodyCheck })
        expect(result.status).toBe('body-check-needed')
        expect(result.alternative).toBe('/start')
      }
    },
  )
  it('does not fabricate a recommendation when observations are supplied', () => {
    const input = Object.freeze({ purpose: 'neck' as const, bodyCheck: 'observed' as const })
    const result = recommendationReadiness(input)
    expect(result.status).toBe('validation-pending')
    expect(result).not.toHaveProperty('motions')
    expect(input).toEqual({ purpose: 'neck', bodyCheck: 'observed' })
    expect(Object.isFrozen(result)).toBe(true)
  })
})
