import { describe, expect, it } from 'vitest'
import { createHintStabilizer, framingHint, REQUIRED_JOINTS } from './framing'
import { trustedJoints } from './landmarks'

const trustedExcept = (...missing: number[]) =>
  Array.from({ length: 33 }, (_, i) => !missing.includes(i))

describe('framingHint', () => {
  it('앉은 자세에서 머리·어깨가 보이면 안내하지 않는다', () => {
    // 엉덩이·다리는 화면 밖이어도 괜찮다
    expect(framingHint(true, trustedExcept(23, 24, 25, 26, 27, 28), 'seated')).toBeNull()
  })

  it('앉은 자세에서 어깨가 화면 밖이면 자리를 맞추게 한다', () => {
    expect(framingHint(true, trustedExcept(12), 'seated')).toBe(
      '머리와 어깨가 화면 안에 들어오게 앉아 주세요',
    )
  })

  it('전신이 필요한데 다리가 화면 밖이면 일어나서 물러나게 한다', () => {
    expect(framingHint(true, trustedExcept(25, 26, 27, 28), 'standing')).toBe(
      '일어나서 한 걸음 뒤로 물러나 주세요',
    )
  })

  it('사람이 안 보이면 카메라 앞으로 오게 한다', () => {
    expect(framingHint(false, trustedExcept(), 'seated')).toBe('카메라 앞에 앉아 주세요')
  })

  it('앉은 자세는 엉덩이를 요구하지 않는다', () => {
    expect(REQUIRED_JOINTS.seated).not.toContain(23)
  })

  it('상반신 동작은 전신이 나와도 허용하고, 필수 어깨가 가려지면 다시 멈춘다', () => {
    const allVisible = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }))
    expect(framingHint(true, trustedJoints(allVisible), 'seated')).toBeNull()
    allVisible[12].visibility = 0.1
    expect(framingHint(true, trustedJoints(allVisible), 'seated')).not.toBeNull()
  })

  it('전신 동작은 상반신만 보일 때 촬영 위치를 다시 안내한다', () => {
    const upperBodyOnly = Array.from({ length: 33 }, (_, i) => ({
      x: 0.5,
      y: i >= 23 ? 1.3 : 0.5,
      z: 0,
      visibility: 0.9,
    }))
    expect(framingHint(true, trustedJoints(upperBodyOnly), 'standing')).not.toBeNull()
  })
})

describe('createHintStabilizer', () => {
  it('1.5초 이어져야 띄우고, 해결된 뒤 0.8초 지나야 내린다', () => {
    const stabilize = createHintStabilizer()
    expect(stabilize('안내', 0)).toBeNull()
    expect(stabilize('안내', 1400)).toBeNull()
    expect(stabilize('안내', 1500)).toBe('안내')
    expect(stabilize(null, 2000)).toBe('안내')
    expect(stabilize(null, 2800)).toBeNull()
  })

  it('잠깐 깜빡인 문제는 띄우지 않는다', () => {
    const stabilize = createHintStabilizer()
    stabilize('안내', 0)
    stabilize(null, 500)
    expect(stabilize('안내', 1600)).toBeNull()
  })
})
