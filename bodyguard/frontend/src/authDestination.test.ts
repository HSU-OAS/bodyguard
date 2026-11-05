// FR-U-04/NFR-08: pure route validation, not proof of authentication/ownership.
import { expect, it } from 'vitest'
import { loginDestination, personalDestination } from './authDestination'

it.each([
  '/start',
  '/explore',
  '/records',
  '/posture-records',
  '/account',
  '/account/notifications',
  '/account/delete',
])('기존 개인 경로 %s만 복귀한다', (path) => {
  expect(personalDestination(path)).toBe(path)
  expect(personalDestination(`${path.toUpperCase()}/`)).toBe(path)
})
it('기록 UUID·기간과 자세 기록의 기존 페이지를 보존하며 모르는 query는 버린다', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  expect(
    personalDestination(`/records/${id}?to=2026-10-09&from=2026-10-01&token=DO_NOT_ECHO`),
  ).toBe(`/records/${id}?from=2026-10-01&to=2026-10-09`)
  expect(personalDestination('/posture-records?page=500&from=2026-10-01')).toBe(
    '/posture-records?from=2026-10-01&page=500',
  )
  expect(personalDestination('/account?email=DO_NOT_ECHO')).toBe('/account')
})
it('개발 코칭 로그인 복귀는 안전한 동작 ID 하나만 보존한다', () => {
  expect(personalDestination('/dev/coaching?motion=neck-side&token=DO_NOT_ECHO')).toBe(
    '/dev/coaching?motion=neck-side',
  )
  expect(personalDestination('/dev/coaching?motion=neck-side&motion=other')).toBe('/dev/coaching')
  expect(personalDestination('/dev/coaching?motion=%2F%2Fevil.test')).toBe('/dev/coaching')
})
it.each([
  '',
  '/',
  '//evil.test',
  'https://evil.test/records',
  '/\\\\evil.test',
  '/records%2fother',
  '/%2Frecords',
  '/records/../account',
  '/records/invalid-id',
  '/dev/select',
  '/unknown',
  '/account/unknown',
  '/records#token',
  '/records?x=1?y=2',
  '/records\n',
  '/records\u0000',
  '/records\u007f',
  `/records?${'a'.repeat(513)}`,
])('외부/미구현/인코딩/제어/과다 입력 %s는 개인 복귀 대상이 아니다', (path) => {
  expect(personalDestination(path)).toBeNull()
  expect(loginDestination(new URLSearchParams({ next: path }))).toBe('/start')
})
it('비문자 입력·중복 next·이미 이중 인코딩된 목적지는 시작으로 돌린다', () => {
  for (const input of [null, undefined, {}, 4]) expect(personalDestination(input)).toBeNull()
  for (const input of ['', 'next=/records&next=/account', 'next=%252Frecords'])
    expect(loginDestination(new URLSearchParams(input))).toBe('/start')
  expect(loginDestination(new URLSearchParams('next=%2Frecords'))).toBe('/records')
})
it.each(['-1', '01', '501', '999', '1.0', 'DO_NOT_ECHO'])(
  '기존 범위를 벗어난 page %s는 전달하지 않는다',
  (page) => {
    expect(personalDestination(`/posture-records?page=${page}`)).toBe('/posture-records')
  },
)
it('중복/잘못된 날짜·중복 page는 반사하지 않고 유효 값만 보존한다', () => {
  expect(personalDestination('/records?from=2026-02-30&to=2026-10-09')).toBe(
    '/records?to=2026-10-09',
  )
  expect(personalDestination('/records?from=2026-10-01&from=2026-10-02&to=DO_NOT_ECHO')).toBe(
    '/records',
  )
  expect(personalDestination('/posture-records?page=1&page=2')).toBe('/posture-records')
  expect(personalDestination('/records?page=1')).toBe('/records')
})
