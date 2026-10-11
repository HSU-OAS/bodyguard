// FR-M-01/02/07·FR-U-04·NFR-08: explicit private preparation, never accepted coaching.
import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { DEFAULT_POSE_MODEL } from '../pose/constants'

const errors = {
  denied: '카메라 권한을 허용한 뒤 다시 확인해 주세요.',
  busy: '카메라를 쓰는 다른 프로그램을 닫고 다시 확인해 주세요.',
  'not-found': '연결된 카메라를 확인해 주세요.',
  unknown: '카메라를 연결하지 못했습니다. 다시 확인해 주세요.',
  inference: '분석 연결을 준비하지 못했습니다. 다시 확인해 주세요.',
  frame: '카메라 입력을 확인하지 못했습니다. 다시 확인해 주세요.',
  cleanup: '카메라 정리를 확인하지 못했습니다. 페이지를 새로 열어 주세요.',
} as const

// FR-U-04/NFR-08: route remount must not outrun a previous native permission/SDK owner.
// Document-local retirement stores no account, image or inference result.
let retirement: Promise<void> | undefined
let retirementFailed = false

export function CameraPreparation() {
  const { state: account } = useAuth()
  const accountId = account.status === 'ready' ? account.user.id : null
  const live = useRef(account)
  live.current = account
  const owner = useRef<ReturnType<typeof createCameraPreparation> | null>(null)
  const [state, setState] = useState<PreparationState>({ phase: 'idle' })
  useLayoutEffect(() => {
    if (account.status !== 'ready' || accountId === null) return
    const id = accountId
    let disposed = false
    let current: ReturnType<typeof createCameraPreparation> | undefined
    const initialize = () => {
      if (disposed || live.current !== account) return
      if (retirementFailed) {
        setState({ phase: 'error', reason: 'cleanup' })
        return
      }
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      current = createCameraPreparation({
        video,
        model: DEFAULT_POSE_MODEL,
        allowed: () =>
          !disposed &&
          live.current === account &&
          account.user.id === id &&
          document.visibilityState === 'visible',
        onState: (next) => {
          if (current && owner.current === current) setState(next)
        },
      })
      owner.current = current
      setState({ phase: 'idle' })
    }
    if (retirement) {
      setState({ phase: 'stopping' })
      void retirement.then(initialize)
    } else initialize()
    const stop = () => {
      void current?.stop()
    }
    const hidden = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', stop)
    return () => {
      disposed = true
      owner.current = null
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', stop)
      if (!current) return
      const previous = current
      const pending = (async () => {
        try {
          await previous.close()
          if (previous.state.phase === 'error' && previous.state.reason === 'cleanup')
            retirementFailed = true
        } catch {
          retirementFailed = true
        }
      })()
      retirement = pending
      void pending.then(() => {
        if (retirement === pending) retirement = undefined
      })
    }
  }, [account, accountId])
  const running = ['ready', 'preparing', 'connecting', 'observing'].includes(state.phase)
  const input = ['ready', 'connecting', 'observing'].includes(state.phase)
  return (
    <section
      className="camera-preparation"
      aria-label="카메라 준비 확인"
      aria-busy={['preparing', 'connecting', 'stopping'].includes(state.phase)}
    >
      <div className="coaching-tools">
        <button
          type="button"
          className="button secondary"
          disabled={
            account.status !== 'ready' ||
            state.phase === 'stopping' ||
            (state.phase === 'error' && state.reason === 'cleanup')
          }
          onClick={() => {
            if (running) void owner.current?.stop()
            else void owner.current?.start()
          }}
        >
          {input
            ? '카메라 끄기'
            : state.phase === 'preparing'
              ? '준비 취소'
              : state.phase === 'stopping'
                ? '정리 중'
                : state.phase === 'error'
                  ? '다시 확인'
                  : '카메라 확인'}
        </button>
        {input && (
          <button
            type="button"
            className="button secondary"
            disabled={state.phase !== 'ready'}
            onClick={() => owner.current?.observe()}
          >
            입력 확인
          </button>
        )}
        <p role={state.phase === 'error' ? 'alert' : 'status'}>
          {state.phase === 'error'
            ? errors[state.reason]
            : state.phase === 'observing'
              ? '연속 입력 확인 중'
              : state.phase === 'connecting'
                ? '연속 입력 준비 중'
                : state.phase === 'ready'
                  ? '카메라·분석 연결 확인됨'
                  : state.phase === 'preparing'
                    ? '카메라·분석 준비 중'
                    : state.phase === 'stopping'
                      ? '권한 창이 열려 있다면 닫아 주세요.'
                      : '카메라 꺼짐'}
        </p>
      </div>
      <p className="small muted">
        브라우저 안에서 입력만 확인합니다. 코칭·판정·저장은 시작하지 않습니다.
      </p>
    </section>
  )
}
