// FR-M-03/NFR-08: same approved workspace controls, draft review is not correct-pose approval.
import type { useCameraReference } from './useCameraReference'

export function CameraReferenceControls({
  reference,
  observing,
}: {
  reference: ReturnType<typeof useCameraReference>
  observing: boolean
}) {
  const { state, saving } = reference
  return (
    <section className="camera-reference" aria-label="촬영 기준 확인">
      <h3>촬영 기준</h3>
      <p className="small muted">머리와 어깨를 화면에 두고 편하게 정면을 봐 주세요.</p>
      <button
        className="button secondary"
        type="button"
        disabled={!observing || saving === 'authority-error'}
        aria-disabled={state.phase === 'collecting' || saving === 'saving'}
        onClick={reference.begin}
      >
        {state.phase === 'idle' ? '3초 기준 수집' : '기준 다시 수집'}
      </button>
      {state.phase === 'collecting' && (
        <p role="status">수집 중 · {(state.elapsedMs / 1000).toFixed(1)} / 3초</p>
      )}
      {state.phase === 'error' && (
        <p role="alert">입력이 끊겼습니다. 머리와 양쪽 어깨를 화면에 두고 다시 수집해 주세요.</p>
      )}
      {state.phase === 'review' && (
        <>
          <p role="status">
            화면상 어깨선 {state.draft.value.toFixed(1)}° · 관찰 변동{' '}
            {state.draft.observedRangeDeg.toFixed(1)}°
          </p>
          <p className="small muted">
            정자세를 인증하는 값은 아닙니다. 흔들렸다면 다시 수집해 주세요.
          </p>
          <label>
            <input
              type="checkbox"
              checked={reference.confirmed}
              disabled={saving === 'saving' || saving === 'saved' || saving === 'historical'}
              onChange={(e) => reference.setConfirmed(e.target.checked)}
            />
            촬영 자세를 확인했으며, 기존 기준을 이 값으로 교체합니다.
          </label>
          <button
            className="button secondary"
            type="button"
            disabled={!reference.confirmed}
            aria-disabled={saving === 'saving' || saving === 'saved' || saving === 'historical'}
            onClick={() => void reference.save()}
          >
            {saving === 'saving'
              ? '기준 저장 중'
              : saving === 'saved'
                ? '기준 저장됨'
                : saving === 'historical'
                  ? '저장 이력 확인됨'
                  : saving === 'error'
                    ? '기준 저장 다시 시도'
                    : '기준 저장'}
          </button>
          {saving === 'error' && (
            <p role="alert">저장을 확인하지 못했습니다. 같은 기준으로 다시 시도해 주세요.</p>
          )}
          {saving === 'saved' && (
            <p role="status">촬영 기준을 저장했습니다. 이전 기준은 과거 기록에 남습니다.</p>
          )}
          {saving === 'historical' && (
            <p role="status">
              저장 이력은 확인했지만 현재 기준은 달라졌습니다. 다시 수집해 주세요.
            </p>
          )}
        </>
      )}
      {saving === 'authority-error' && (
        <p role="alert">
          계정을 확인하지 못해 기준 저장을 중단했습니다. 계정을 다시 확인해 주세요.
        </p>
      )}
    </section>
  )
}
