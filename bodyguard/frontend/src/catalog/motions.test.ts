// FR-S-01/06: deterministic content and selection; no camera or clinical thresholds.
import { describe, expect, it } from 'vitest'
import { findMotions, motionById, parseRegion, previewMotions } from './motions'

describe('C-02/03/04 catalog contract', () => {
  it('keeps every candidate immutable, sourced and pending without clinical dosage', () => {
    expect(new Set(previewMotions.map((motion) => motion.id)).size).toBe(previewMotions.length)
    for (const motion of previewMotions) {
      expect(Object.isFrozen(motion)).toBe(true)
      expect(Object.isFrozen(motion.steps)).toBe(true)
      expect(Object.isFrozen(motion.cautions)).toBe(true)
      expect(Object.isFrozen(motion.sources)).toBe(true)
      expect(motion.sources.every(Object.isFrozen)).toBe(true)
      expect(motion.sources.length).toBeGreaterThan(0)
      expect(motion.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true)
      expect(motion.coachingStatus).toBe('pending-validation')
      expect(motion.cautions.join(' ')).toContain('통증')
      expect(motion.observationLimit).not.toBe('')
      expect([...motion.steps, ...motion.cautions, motion.summary].join(' ')).not.toMatch(
        /\d+\s*(초|회|°)/,
      )
      if (motion.reviewMode === 'guidance-candidate') {
        expect(motion.observationLimit).toContain('타이머')
      }
    }
  })
  it('contains sourced development candidates, not excluded W or beauty', () => {
    expect(previewMotions.map((motion) => motion.id)).toEqual([
      'neck-side',
      'chin-retraction',
      'shoulder-shrug',
      'cross-body-shoulder',
      'arm-overhead',
      'lateral-trunk',
      'seated-trunk-rotation',
    ])
  })
  it('finds titles and multiple search words without treating text as regex', () => {
    expect(findMotions('  목   기울이기  ', 'all')).toHaveLength(1)
    expect(findMotions('.*', 'all')).toEqual([])
  })
  it('normalizes decomposed Korean search', () => {
    expect(findMotions('목'.normalize('NFD'), 'all').map((motion) => motion.id)).toEqual(
      findMotions('목', 'all').map((motion) => motion.id),
    )
  })
  it('treats whitespace as all entries', () => {
    expect(findMotions('   ', 'all')).toHaveLength(7)
  })
  it('filters by body region and returns a real empty result', () => {
    expect(findMotions('', 'neck')).toHaveLength(2)
    expect(findMotions('', 'shoulder')).toHaveLength(3)
    expect(findMotions('', 'torso')).toHaveLength(2)
  })
  it('does not mutate the authored list while searching', () => {
    const before = JSON.stringify(previewMotions)
    findMotions('unknown', 'all')
    expect(JSON.stringify(previewMotions)).toBe(before)
  })
  it('uses only known internal IDs, not object prototype or external URLs', () => {
    expect(motionById('neck-side')?.title).toBe('목 옆으로 기울이기')
    for (const id of ['', '__proto__', 'constructor', 'https://evil.example']) {
      expect(motionById(id)).toBeUndefined()
    }
  })
  it('unknown regions fall back to all', () => {
    expect(parseRegion('neck')).toBe('neck')
    expect(parseRegion('untrusted')).toBe('all')
    expect(parseRegion(null)).toBe('all')
  })
  // FR-S-01: source-matched variants only, not clinical or camera validation.
  it('restores the documented shoulder shrug without invented dosage or release', () => {
    const motion = motionById('shoulder-shrug')
    expect(motion).toBeDefined()
    expect(motion?.steps.join(' ')).toContain('양쪽 어깨')
    expect(motion?.steps.join(' ')).toContain('내립니다')
    expect(motion?.sources.map((source) => source.url)).toContain(
      'https://www.cuh.nhs.uk/patient-information/neck-sprain-advice/',
    )
    expect(motion?.coachingStatus).toBe('pending-validation')
    expect(motion?.observationLimit).toContain('타이머')
    expect(motion?.framing).toContain('몸통')
    expect(findMotions('으쓱', 'shoulder').map((candidate) => candidate.id)).toEqual([
      'shoulder-shrug',
    ])
  })
  it('uses the seated one-arm-at-a-time overhead variant, not the behind-back exercise', () => {
    const motion = motionById('arm-overhead')
    expect(motion).toBeDefined()
    expect(motion?.steps.join(' ')).toContain('한 팔')
    expect(motion?.steps.join(' ')).toContain('반대쪽')
    expect(motion?.steps.join(' ')).not.toMatch(/뒤로|동시에|양팔/)
    expect(motion?.sources.map((source) => source.url)).toContain(
      'https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries',
    )
    expect(motion?.coachingStatus).toBe('pending-validation')
    expect(motion?.observationLimit).toContain('타이머')
    expect(motion?.framing).toContain('골반')
    expect(findMotions('위로 뻗기', 'shoulder').map((candidate) => candidate.id)).toEqual([
      'arm-overhead',
    ])
  })
  it('has steps, stop guidance and reviewed primary sources without dose or outcome claims', () => {
    const motion = previewMotions[0]
    expect(motion.steps).toHaveLength(3)
    expect(motion.cautions.join(' ')).toContain('통증')
    expect(motion.cautions.join(' ')).toContain('당기지')
    expect(motion.framing).toContain('머리와 양쪽 어깨')
    expect(motion.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true)
    expect([...motion.steps, ...motion.cautions, motion.summary].join(' ')).not.toMatch(
      /\d+\s*(초|회|°)|치료합니다|치료 효과|지방 제거|효과 보장/,
    )
    expect(motion.coachingStatus).toBe('pending-validation')
  })
})
