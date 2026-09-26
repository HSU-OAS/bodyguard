// FR-M-07 지금 하는 일에 필요한 관절이 화면 밖이면 부드럽게 안내해서 그 자세를 하도록 유도한다 (원문 50).
// 브라우저 API를 쓰지 않는 순수 함수다 (ADR-0012)

/** 무엇을 재는지에 따라 필요한 관절이 다르다. 앉은 자세 측정은 머리·어깨만 있으면 된다 */
export type FramingMode = 'seated' | 'standing'

export const REQUIRED_JOINTS: Record<FramingMode, readonly number[]> = {
  // 코, 양 귀, 양 어깨. 앉아 있으면 엉덩이·다리는 원래 안 보이므로 요구하지 않는다
  seated: [0, 7, 8, 11, 12],
  // 코, 어깨, 엉덩이, 무릎, 발목. 서서 하는 동작용
  standing: [0, 11, 12, 23, 24, 25, 26, 27, 28],
}

// 문구는 [PO 제안]이다 (prd FR-M-07)
const HINTS: Record<FramingMode, { absent: string; partial: string }> = {
  seated: {
    absent: '카메라 앞에 앉아 주세요',
    partial: '머리와 어깨가 화면 안에 들어오게 앉아 주세요',
  },
  standing: {
    absent: '카메라 앞에 서 주세요',
    partial: '일어나서 한 걸음 뒤로 물러나 주세요',
  },
}

/** 지금 프레임의 안내 문구. 필요한 관절이 다 보이면 null */
export function framingHint(
  detected: boolean,
  trusted: readonly boolean[],
  mode: FramingMode,
): string | null {
  if (!detected) return HINTS[mode].absent
  return REQUIRED_JOINTS[mode].every((i) => trusted[i]) ? null : HINTS[mode].partial
}

export const HINT_SHOW_AFTER_MS = 1500
export const HINT_HIDE_AFTER_MS = 800

/** 안내가 깜빡이지 않게 한다. 같은 상태가 잠깐 이어져야 띄우고, 해결돼도 잠깐 기다렸다 내린다 */
export function createHintStabilizer(
  showAfterMs = HINT_SHOW_AFTER_MS,
  hideAfterMs = HINT_HIDE_AFTER_MS,
) {
  let shown: string | null = null
  let pending: string | null = null
  let since = 0
  return (hint: string | null, now: number): string | null => {
    if (hint !== pending) {
      pending = hint
      since = now
    }
    const wait = pending === null ? hideAfterMs : showAfterMs
    if (pending !== shown && now - since >= wait) shown = pending
    return shown
  }
}
