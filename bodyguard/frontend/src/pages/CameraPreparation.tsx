// FR-M-01/02/07·FR-U-04·NFR-08: explicit private preparation, never accepted coaching.
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import type { ReferenceStage } from '../avatar/referenceStage'
import type { Motion } from '../catalog/motions'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { DEFAULT_POSE_MODEL } from '../pose/constants'
import {
  type CameraFramingStatus,
  createCameraFraming,
  motionFramingRequirement,
} from '../posture/cameraFraming'
import { CameraReferenceControls } from './CameraReferenceControls'
import { useCameraReference } from './useCameraReference'

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

export function CameraPreparation({
  motion,
  comparison,
}: {
  motion?: Motion
  comparison?: RefObject<ReferenceStage | null>
}) {
  const motionId = motion?.id ?? null
  const { state: account } = useAuth()
  const accountId = account.status === 'ready' ? account.user.id : null
  const live = useRef(account)
  live.current = account
  const owner = useRef<ReturnType<typeof createCameraPreparation> | null>(null)
  const [state, setState] = useState<PreparationState>({ phase: 'idle' })
  const [framing, setFraming] = useState<CameraFramingStatus | null>(null)
  const [displayReady, setDisplayReady] = useState(false)
  const reference = useCameraReference(motionId)
  const referencePort = useRef(reference)
  referencePort.current = reference
  useLayoutEffect(() => {
    if (reference.saving === 'authority-error') void owner.current?.stop()
  }, [reference.saving])
  useLayoutEffect(() => {
    if (account.status !== 'ready' || accountId === null) return
    const id = accountId
    let disposed = false
    let current: ReturnType<typeof createCameraPreparation> | undefined
    let animation: number | undefined
    let display: ReferenceStage | null = null,
      displayGeneration: number | undefined
    const suspendDisplay = () => {
      const owned = display
      display = null
      displayGeneration = undefined
      if (!disposed) setDisplayReady(false)
      try {
        owned?.suspendObservation()
      } catch {
        retirementFailed = true
        if (!disposed) setState({ phase: 'error', reason: 'cleanup' })
        void current?.stop()
      }
    }
    const requirement = motionId === null ? null : motionFramingRequirement(motionId)
    let observer = requirement ? createCameraFraming(requirement) : null
    let previous: CameraFramingStatus | null = null
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
          !retirementFailed &&
          live.current === account &&
          account.user.id === id &&
          document.visibilityState === 'visible',
        onState: (next) => {
          if (current && owner.current === current && !disposed) {
            if (retirementFailed) {
              setState({ phase: 'error', reason: 'cleanup' })
              return
            }
            setState(next)
            if (next.phase !== 'observing') {
              suspendDisplay()
              referencePort.current.reset()
              previous = null
              setFraming(null)
              observer = requirement ? createCameraFraming(requirement) : null
            }
          }
        },
      })
      owner.current = current
      setState({ phase: 'idle' })
      setFraming(null)
      // Consume the existing copied slot once; never capture/re-infer on render or retain arrays.
      const tick = () => {
        if (disposed || live.current !== account) return
        if (current?.state.phase === 'observing') {
          const input = current.takeFrame()
          const now = performance.now()
          const stage = comparison?.current ?? null
          if (stage !== display) suspendDisplay()
          if (input) {
            observer?.accept(input, now)
            referencePort.current.accept(input, now)
            try {
              if (stage && (stage !== display || displayGeneration !== input.generation)) {
                if (!stage.beginObservation(input.generation)) throw new Error()
                display = stage
                displayGeneration = input.generation
                setDisplayReady(true)
              }
              stage?.observe(input)
            } catch {
              void current.stop()
            }
          }
          referencePort.current.tick(now)
          const next = observer?.read(now) ?? null
          if (next !== previous) {
            previous = next
            setFraming(next)
          }
        }
        animation = requestAnimationFrame(tick)
      }
      animation = requestAnimationFrame(tick)
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
      suspendDisplay()
      if (animation !== undefined) cancelAnimationFrame(animation)
      observer = null
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
  }, [account, accountId, motionId, comparison])
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
            reference.saving === 'authority-error' ||
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
        {comparison && (
          <button
            type="button"
            className="button secondary"
            disabled={state.phase !== 'observing' || !displayReady}
            onClick={() => comparison.current?.alignObservation()}
          >
            움직임 맞추기
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
      {motion && (
        <p className="small muted" role="status" aria-label="현재 동작 촬영 안내">
          {state.phase !== 'observing' || framing === null || framing === 'adjust'
            ? motion.framing
            : framing === 'position'
              ? '화면 안에 몸이 보이도록 위치를 조정해 주세요.'
              : framing === 'one-person'
                ? '한 사람만 화면에 들어오게 해 주세요.'
                : framing === 'in-frame'
                  ? '촬영 범위 입력 확인됨 · 코칭 검증 전'
                  : '새 촬영 입력을 기다리고 있습니다.'}
        </p>
      )}
      <p className="small muted">
        입력은 브라우저 안에서 처리합니다. 코칭·판정은 시작하지 않습니다.
      </p>
      <CameraReferenceControls reference={reference} observing={state.phase === 'observing'} />
    </section>
  )
}
