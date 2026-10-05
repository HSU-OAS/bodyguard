// FR-V-01/NFR-08: literal CSS contract; real rendered styles are checked in Chrome too.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--([a-z-]+):\s*(#[a-f0-9]{6});/g)].map((match) => [match[1], match[2]]),
)
function luminance(hex: string) {
  const values = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722
}
function contrast(foreground: string, background: string) {
  expect(foreground).toMatch(/^#[a-f0-9]{6}$/)
  expect(background).toMatch(/^#[a-f0-9]{6}$/)
  const first = luminance(foreground),
    second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
describe('화이트·블루 웹 계약', () => {
  it('백색 바탕과 단일 의료 블루를 사용한다', () => {
    expect(tokens.surface).toBe('#ffffff')
    expect(tokens.accent).toBe('#1e5aa8')
    expect(css).toContain('color-scheme: light')
  })
  it.each([
    ['ink', 'surface'],
    ['muted', 'surface'],
    ['muted', 'surface-soft'],
    ['accent', 'surface-soft'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
    ['danger', 'surface'],
    ['on-accent', 'danger'],
    ['error', 'surface'],
  ])('%s / %s 텍스트 대비가 AA 기준을 만족한다', (foreground, background) => {
    expect(contrast(tokens[foreground] ?? '', tokens[background] ?? '')).toBeGreaterThanOrEqual(4.5)
  })
  it.each([
    ['control-line', 'surface'],
    ['focus', 'surface'],
    ['focus', 'surface-soft'],
  ])('%s / %s 컨트롤·초점 대비가 3 이상이다', (foreground, background) => {
    expect(contrast(tokens[foreground] ?? '', tokens[background] ?? '')).toBeGreaterThanOrEqual(3)
  })
  it('동작 감소와 넓어진 헤더·공통 포커스 규칙을 포함한다', () => {
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain(':is(a, button, input, summary, select, textarea):focus-visible')
    expect(css).toContain('outline: 3px solid var(--focus)')
    expect(css).toContain('flex-wrap: wrap')
  })
})
