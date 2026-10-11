// @vitest-environment happy-dom
// FR-S-06·NFR-08: route context fixtures, no real authentication or coaching claim.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function open(path: string) {
  window.history.replaceState(null, '', path)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'navigation-fixture', email: 'fixture@example.com' }), {
        status: 200,
      }),
    ),
  )
  render(<App />)
}

it('preserves selection search and region across guidance → workspace → exit', async () => {
  open('/dev/select?search=목&region=neck&motion=neck-side')
  await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })
  fireEvent.click(screen.getByRole('link', { name: '코칭 화면 구조 보기' }))
  await screen.findByRole('region', { name: '두 아바타 공간' })
  fireEvent.click(screen.getByRole('link', { name: '나가기' }))
  expect(await screen.findByLabelText('동작 검색')).toHaveProperty('value', '목')
  expect(screen.getByRole('button', { name: '목', pressed: true })).toBeTruthy()
})

it('keeps context in the existing cautions link without an arbitrary return URL', async () => {
  open('/dev/coaching?search=목&region=neck&motion=neck-side&next=https://example.com')
  await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })
  const link = screen.getByRole('link', { name: '주의점·참고 자료' })
  const href = link.getAttribute('href')
  expect(href).not.toBeNull()
  const target = new URL(href ?? '', window.location.href)
  expect(target.pathname).toBe('/dev/select')
  expect(target.searchParams.get('search')).toBe('목')
  expect(target.searchParams.get('region')).toBe('neck')
  expect(target.searchParams.get('motion')).toBe('neck-side')
  expect(target.searchParams.has('next')).toBe(false)
})
