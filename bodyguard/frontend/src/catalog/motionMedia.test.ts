import { afterEach, expect, it, vi } from 'vitest'
import { motionPreviewMedia } from './motionMedia'

afterEach(() => vi.unstubAllEnvs())
it('maps only three authored private candidates and fixed genders', () => {
  for (const id of ['neck-side', 'shoulder-shrug', 'arm-overhead']) {
    for (const gender of ['male', 'female'] as const)
      expect(motionPreviewMedia(id, gender)).toEqual({
        poster: `/__bodyguard/motion-media/${gender}/${id}.png`,
        video: `/__bodyguard/motion-media/${gender}/${id}.mp4`,
      })
  }
  expect(motionPreviewMedia('chin-retraction')).toBeUndefined()
  expect(motionPreviewMedia('../neck-side')).toBeUndefined()
  expect(motionPreviewMedia('neck-side', 'other' as 'male')).toBeUndefined()
})
it('does not expose candidate media through the production mapping', () => {
  vi.stubEnv('DEV', false)
  expect(motionPreviewMedia('neck-side')).toBeUndefined()
})
