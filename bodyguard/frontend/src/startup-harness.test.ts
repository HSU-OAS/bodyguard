// @vitest-environment happy-dom
// FR-V-03/NFR-07: test-only readiness observer; no body/account contents collected.

import type { Page } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStartupProbe } from '../e2e/fixtures/startupProbe'
import { startupHeadingVisible } from '../e2e/fixtures/startupVisibility'

afterEach(() => {
  document.body.replaceChildren()
  delete (window as unknown as { __bodyguardStartup?: unknown }).__bodyguardStartup
  vi.restoreAllMocks()
})

describe('test-only startup probe', () => {
  it('does not mark auth checking or an unrelated heading ready', async () => {
    const stop = installStartupProbe({ heading: '내 몸을 위한 시작' })
    document.body.innerHTML = '<main><h1>계정을 확인하고 있습니다</h1></main>'
    await Promise.resolve()
    expect(window.__bodyguardStartup.headingMs).toBeNull()
    stop()
  })

  it('records only numeric timings after exact main heading, with two RAF callbacks', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const stop = installStartupProbe({ heading: '내 몸을 위한 시작' })
    document.body.innerHTML =
      '<header><h1>내 몸을 위한 시작</h1></header><main><h1>계정 확인 중</h1></main>'
    await Promise.resolve()
    expect(window.__bodyguardStartup.headingMs).toBeNull()
    const target = document.querySelector('main h1')
    if (!target) throw new Error('Missing test heading')
    target.textContent = '내 몸을 위한 시작'
    await Promise.resolve()
    expect(window.__bodyguardStartup.headingMs).toEqual(expect.any(Number))
    expect(window.__bodyguardStartup.twoRafMs).toBeNull()
    callbacks[0](performance.now())
    expect(window.__bodyguardStartup.twoRafMs).toBeNull()
    callbacks[1](performance.now())
    expect(window.__bodyguardStartup.twoRafMs).toEqual(expect.any(Number))
    expect(Object.keys(window.__bodyguardStartup).sort()).toEqual(
      ['cameraCalls', 'headingMs', 'initMs', 'twoRafMs'].sort(),
    )
    stop()
  })

  it('disconnects observation and cancels outstanding RAF without inventing readiness', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(73)
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const stop = installStartupProbe({ heading: '내 몸을 위한 시작' })
    document.body.innerHTML = '<main><h1>내 몸을 위한 시작</h1></main>'
    await Promise.resolve()
    stop()
    stop()
    expect(cancel).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledWith(73)
    expect(window.__bodyguardStartup.twoRafMs).toBeNull()
  })
})

describe('bounded heading visibility without assertion DOM payloads', () => {
  it('uses the same heading role, visible state and 5000ms deadline', async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined)
    const getByRole = vi.fn().mockReturnValue({ waitFor })
    const page = { getByRole } as unknown as Page
    expect(await startupHeadingVisible(page, '내 몸을 위한 시작')).toBe(true)
    expect(getByRole).toHaveBeenCalledExactlyOnceWith('heading', {
      name: '내 몸을 위한 시작',
      level: 1,
    })
    expect(waitFor).toHaveBeenCalledExactlyOnceWith({ state: 'visible', timeout: 5000 })
  })

  it('keeps failure false and does not return the caught error payload', async () => {
    const waitFor = vi.fn().mockRejectedValue(new Error('SYNTHETIC_ERROR_CONTENT'))
    const page = { getByRole: () => ({ waitFor }) } as unknown as Page
    expect(await startupHeadingVisible(page, '내 몸을 위한 시작')).toBe(false)
  })
})
