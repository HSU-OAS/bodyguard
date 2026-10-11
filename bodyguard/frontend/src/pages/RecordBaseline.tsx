// FR-M-03/FR-R-01/06/FR-U-04: read the record's original baseline, never today's substitute.
import { useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { prepareBaselines } from '../api/baselines'
import type { BaselineOut, MinuteOut } from '../api/generated'
import { type ReadyAccount, useAuth } from '../auth'

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
const names = { neck: '목', shoulder: '어깨', trunk: '몸통' } as const
type Lookup = { owner: ReadyAccount; ownerId: string; id: string } & (
  | { status: 'loading' | 'error' | 'missing' }
  | { status: 'ready'; value: BaselineOut }
)

export function RecordBaseline({
  item,
  onAuthFailure,
}: {
  item: MinuteOut
  onAuthFailure(): void
}) {
  const id = item.baseline_id
  const { state } = useAuth()
  const authority = state.status === 'ready' ? state : null
  const ownerId = authority?.user.id ?? ''
  const owner = useRef(authority)
  const current = useRef<{
    controller: AbortController
    ownerId: string
    item: MinuteOut
  } | null>(null)
  const flight = useRef(false)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  useLayoutEffect(() => {
    owner.current = authority
    const operation = { controller: new AbortController(), ownerId, item }
    current.current = operation
    flight.current = false
    return () => {
      operation.controller.abort()
      if (current.current === operation) current.current = null
    }
  }, [authority, ownerId, item])
  const shown =
    lookup?.owner === authority && lookup.ownerId === ownerId && lookup.id === id ? lookup : null
  async function read() {
    const operation = current.current
    if (!id || !authority || !operation || operation.controller.signal.aborted || flight.current)
      return
    const capturedId = authority.user.id
    const live = () =>
      current.current === operation &&
      !operation.controller.signal.aborted &&
      owner.current === authority &&
      authority.user.id === capturedId &&
      operation.ownerId === capturedId &&
      operation.item === item &&
      operation.item.baseline_id === id
    if (!live()) return
    flight.current = true
    const key = { owner: authority, ownerId: capturedId, id }
    setLookup({ ...key, status: 'loading' })
    let context: Awaited<ReturnType<typeof prepareBaselines>> | null = null
    try {
      context = await prepareBaselines({
        authority,
        readAuthority: () => owner.current,
        signal: operation.controller.signal,
      })
      const value = await context.detail(id, operation.controller.signal)
      // Preserve the same method/unit/version relation enforced by summary insertion.
      if (
        value.client_version !== item.client_version ||
        (Object.keys(names) as Array<keyof typeof names>).some((name) => {
          const measured = item[name],
            baseline = value[name]
          return (
            measured.measured_sec > 0 &&
            (!baseline || baseline.method !== measured.method || baseline.unit !== measured.unit)
          )
        })
      )
        throw new ApiError(503)
      if (live()) setLookup({ ...key, status: 'ready', value })
    } catch (error) {
      if (!live()) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        onAuthFailure()
        return
      }
      setLookup({
        ...key,
        status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
      })
    } finally {
      context?.close()
      if (current.current === operation) flight.current = false
    }
  }
  if (!id || !authority) return null
  return (
    <div className="minute-baseline" aria-busy={shown?.status === 'loading'}>
      <button
        className="button secondary"
        type="button"
        disabled={shown?.status === 'loading'}
        onClick={() => {
          void read()
        }}
      >
        {shown ? '기준선 다시 조회' : '기준선 보기'}
      </button>
      {shown?.status === 'loading' && <p role="status">기준선을 조회하고 있습니다.</p>}
      {(shown?.status === 'error' || shown?.status === 'missing') && (
        <p role="alert">
          {shown.status === 'missing'
            ? '이 기록의 기준선을 찾을 수 없습니다.'
            : '기준선을 조회하지 못했습니다. 연결을 확인하고 다시 조회하세요.'}
        </p>
      )}
      {shown?.status === 'ready' && (
        <section aria-label="기록에 사용한 기준선">
          <p role="status" className="sr-only">
            기록에 사용한 기준선을 조회했습니다.
          </p>
          <dl>
            <div>
              <dt>기준선 저장</dt>
              <dd>{date.format(new Date(shown.value.created_at))}</dd>
            </div>
            {Object.entries(names).map(([key, label]) => {
              const metric = shown.value[key as keyof typeof names]
              return (
                <div key={key}>
                  <dt>{label} 기준</dt>
                  <dd>
                    {metric
                      ? `${number.format(metric.value)} ${metric.unit} · ${metric.method}`
                      : '—'}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}
    </div>
  )
}
