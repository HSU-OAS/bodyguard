// FR-S-01/06: deterministic content and selection; no camera or clinical thresholds.
import { describe, expect, it } from 'vitest'
import { findMotions, motionById, parseRegion, previewMotions } from './motions'

describe('C-02/03/04 catalog contract', () => {
  it('contains only the first documented candidate, not excluded W or beauty', () => {
    expect(previewMotions.map((motion) => motion.id)).toEqual(['neck-side'])
  })
  it('finds titles and multiple search words without treating text as regex', () => {
    expect(findMotions('  목   기울이기  ', 'all')).toHaveLength(1)
    expect(findMotions('.*', 'all')).toEqual([])
  })
  it('normalizes decomposed Korean search', () => {
    expect(findMotions('목'.normalize('NFD'), 'all')).toHaveLength(1)
  })
  it('treats whitespace as all entries', () => {
    expect(findMotions('   ', 'all')).toHaveLength(1)
  })
  it('filters by body region and returns a real empty result', () => {
    expect(findMotions('', 'neck')).toHaveLength(1)
    expect(findMotions('', 'shoulder')).toEqual([])
    expect(findMotions('', 'torso')).toEqual([])
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
