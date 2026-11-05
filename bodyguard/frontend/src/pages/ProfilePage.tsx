import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/auth'
import { boundRecordRequest } from '../api/recordBinding'
import { type ReadyAccount, useAuth } from '../auth'
import { loginDestination } from '../authDestination'
import './ProfilePage.css'

type Profile = {
  revision: number
  nickname: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  gender: 'male' | 'female' | null
}
type Draft = {
  nickname: string
  age: string
  height_cm: string
  weight_kg: string
  gender: Profile['gender']
}
type Status = 'loading' | 'error' | 'editing' | 'saving' | 'saved' | 'uncertain' | 'conflict'
const empty: Draft = { nickname: '', age: '', height_cm: '', weight_kg: '', gender: null }
function hasControl(value: string) {
  return Array.from(value).some((char) => {
    const n = char.charCodeAt(0)
    return n < 32 || (n >= 127 && n < 160)
  })
}
function parse(value: unknown): Profile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(503)
  const p = value as Record<string, unknown>
  if (Object.keys(p).sort().join(',') !== 'age,gender,height_cm,nickname,revision,weight_kg')
    throw new ApiError(503)
  const number = (v: unknown, min: number, max: number, integer = false) =>
    v === null ||
    (typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= min &&
      v <= max &&
      (!integer || Number.isInteger(v)))
  if (
    !number(p.revision, 0, 2147483647, true) ||
    p.revision === null ||
    !(
      p.nickname === null ||
      (typeof p.nickname === 'string' &&
        p.nickname.trim() === p.nickname &&
        p.nickname.length > 0 &&
        p.nickname.length <= 60 &&
        !hasControl(p.nickname))
    ) ||
    !number(p.age, 0, 150, true) ||
    !number(p.height_cm, Number.MIN_VALUE, 1000) ||
    !number(p.weight_kg, Number.MIN_VALUE, 1000) ||
    ![null, 'male', 'female'].includes(p.gender as null | 'male' | 'female')
  )
    throw new ApiError(503)
  return p as Profile
}
function asDraft(p: Profile): Draft {
  return {
    nickname: p.nickname ?? '',
    age: p.age === null ? '' : String(p.age),
    height_cm: p.height_cm === null ? '' : String(p.height_cm),
    weight_kg: p.weight_kg === null ? '' : String(p.weight_kg),
    gender: p.gender,
  }
}
export function ProfilePage() {
  const { state, refresh } = useAuth()
  const [query] = useSearchParams()
  const destination = query.has('next') ? loginDestination(query) : '/account'
  const authority = state.status === 'ready' ? state : null
  const owner = useRef<ReadyAccount | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<{
    owner: ReadyAccount | null
    status: Status
    profile: Profile | null
    draft: Draft | null
  }>({ owner: null, status: 'loading', profile: null, draft: null })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [invalid, setInvalid] = useState(false)
  useLayoutEffect(() => {
    owner.current = authority
    return () => {
      owner.current = null
      abort.current?.abort()
    }
  }, [authority])
  useEffect(() => {
    document.title = '기본 정보 · BODYGUARD'
    if (document.hasFocus()) heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!authority) return
    void reload
    const controller = new AbortController()
    abort.current = controller
    setView({ owner: authority, status: 'loading', profile: null, draft: null })
    setConfirmDelete(false)
    setInvalid(false)
    const binding = { authority, readAuthority: () => owner.current }
    void boundRecordRequest('/profile', controller.signal, binding)
      .then((raw) => {
        const profile = parse(raw)
        if (!controller.signal.aborted && owner.current === authority)
          setView({ owner: authority, status: 'editing', profile, draft: asDraft(profile) })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || owner.current !== authority) return
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          void refresh()
          return
        }
        setView({ owner: authority, status: 'error', profile: null, draft: null })
      })
    return () => controller.abort()
  }, [authority, reload, refresh])
  const status = view.owner === authority ? view.status : 'loading'
  const draft = view.owner === authority ? view.draft : null
  const locked = status === 'saving' || status === 'uncertain' || status === 'conflict'
  function change(update: Partial<Draft>) {
    if (!locked) {
      setConfirmDelete(false)
      setInvalid(false)
      setView((old) =>
        old.draft ? { ...old, status: 'editing', draft: { ...old.draft, ...update } } : old,
      )
    }
  }
  async function save(input: Draft) {
    const controller = abort.current
    if (
      !authority ||
      !controller ||
      !view.profile ||
      locked ||
      busy.current ||
      owner.current !== authority
    )
      return
    const nickname = input.nickname.trim()
    if (nickname && (nickname.length > 60 || hasControl(nickname))) {
      setInvalid(true)
      return
    }
    const parsed = {
      nickname: nickname || null,
      age: input.age === '' ? null : Number(input.age),
      height_cm: input.height_cm === '' ? null : Number(input.height_cm),
      weight_kg: input.weight_kg === '' ? null : Number(input.weight_kg),
      gender: input.gender,
      revision: view.profile.revision,
    }
    if (
      (parsed.age !== null &&
        (!Number.isInteger(parsed.age) || parsed.age < 0 || parsed.age > 150)) ||
      [parsed.height_cm, parsed.weight_kg].some(
        (n) => n !== null && (!Number.isFinite(n) || n <= 0 || n > 1000),
      )
    ) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    busy.current = true
    setView((old) => ({ ...old, status: 'saving' }))
    try {
      const response = parse(
        await boundRecordRequest(
          '/profile',
          controller.signal,
          { authority, readAuthority: () => owner.current },
          parsed,
        ),
      )
      if (controller.signal.aborted || owner.current !== authority) return
      if (
        response.revision !== parsed.revision + 1 ||
        (['nickname', 'age', 'height_cm', 'weight_kg', 'gender'] as const).some(
          (key) => response[key] !== parsed[key],
        )
      )
        throw new ApiError(503)
      setView({ owner: authority, status: 'saved', profile: response, draft: asDraft(response) })
      setConfirmDelete(false)
    } catch (error) {
      if (controller.signal.aborted || owner.current !== authority) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        void refresh()
        return
      }
      setView((old) => ({
        ...old,
        status: error instanceof ApiError && error.status === 409 ? 'conflict' : 'uncertain',
      }))
    } finally {
      busy.current = false
    }
  }
  if (!authority) return null
  return (
    <section className="profile-screen">
      <Link className="profile-back" to="/account">
        ← 내 계정
      </Link>
      <p className="profile-kicker">MY BODYGUARD</p>
      <h1 ref={heading} tabIndex={-1}>
        기본 정보
      </h1>
      <p className="profile-intro">
        모두 선택 사항입니다. 자세 판정이나 진단에는 사용하지 않습니다.
      </p>
      {status === 'loading' ? (
        <p role="status">정보를 불러오고 있습니다.</p>
      ) : status === 'error' ? (
        <div role="alert">
          <p>정보를 불러오지 못했습니다.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => setReload((n) => n + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        draft && (
          <form
            className="profile-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              void save(draft)
            }}
            aria-busy={status === 'saving'}
          >
            {invalid && <p role="alert">입력한 값을 확인해 주세요.</p>}
            <fieldset disabled={locked}>
              <label>
                닉네임
                <input
                  value={draft.nickname}
                  maxLength={60}
                  placeholder="닉네임을 입력해 주세요"
                  onChange={(event) => change({ nickname: event.target.value })}
                />
              </label>
              <label>
                나이 <span>세</span>
                <input
                  type="number"
                  min="0"
                  max="150"
                  step="1"
                  inputMode="numeric"
                  value={draft.age}
                  placeholder="나이를 입력해 주세요"
                  onChange={(event) => change({ age: event.target.value })}
                />
              </label>
              <div className="profile-pair">
                <label>
                  키 <span>cm</span>
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="any"
                    inputMode="decimal"
                    value={draft.height_cm}
                    placeholder="선택 입력"
                    onChange={(event) => change({ height_cm: event.target.value })}
                  />
                </label>
                <label>
                  몸무게 <span>kg</span>
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="any"
                    inputMode="decimal"
                    value={draft.weight_kg}
                    placeholder="선택 입력"
                    onChange={(event) => change({ weight_kg: event.target.value })}
                  />
                </label>
              </div>
              <fieldset className="profile-gender">
                <legend>성별</legend>
                <div>
                  {(
                    [
                      ['male', '남성'],
                      ['female', '여성'],
                      [null, '선택 안 함'],
                    ] as const
                  ).map(([value, text]) => (
                    <label key={text}>
                      <input
                        type="radio"
                        name="gender"
                        checked={draft.gender === value}
                        onChange={() => change({ gender: value })}
                      />
                      <span>{text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="button primary profile-save" type="submit">
                {status === 'saving' ? '저장 중…' : '저장하기'}
              </button>
            </fieldset>
            <p role="status">{status === 'saved' ? '기본 정보를 저장했습니다.' : ''}</p>
            {status === 'saved' && query.has('next') && (
              <p>
                <Link to={destination}>다음</Link>
              </p>
            )}
            {(status === 'uncertain' || status === 'conflict') && (
              <div role="alert">
                <p>
                  {status === 'conflict'
                    ? '다른 화면에서 정보가 변경되었습니다.'
                    : '저장 결과를 확인하지 못했습니다.'}{' '}
                  저장된 정보를 다시 불러와 확인해 주세요.
                </p>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setReload((n) => n + 1)}
                >
                  다시 불러오기
                </button>
              </div>
            )}
            {!locked && (
              <div className="profile-delete">
                {confirmDelete ? (
                  <>
                    <p>입력한 기본 정보를 모두 삭제할까요?</p>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void save(empty)}
                    >
                      삭제 확인
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    className="profile-delete-trigger"
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                  >
                    입력한 정보 모두 삭제
                  </button>
                )}
                <p>삭제 후 충돌 방지용 수정 번호는 탈퇴 전까지 유지됩니다.</p>
              </div>
            )}
          </form>
        )
      )}
      <p className="profile-skip">
        <Link to={destination}>나중에 하기</Link>
      </p>
    </section>
  )
}
