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
      'cross-body-shoulder',
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
    expect(findMotions('   ', 'all')).toHaveLength(5)
  })
  it('filters by body region and returns a real empty result', () => {
    expect(findMotions('', 'neck')).toHaveLength(2)
    expect(findMotions('', 'shoulder')).toHaveLength(1)
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
