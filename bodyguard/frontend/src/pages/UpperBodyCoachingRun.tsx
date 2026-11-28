// FR-S-02/03/04·FR-A-01: DEV-only demo runs for shoulder-shrug and arm-overhead on the shared
// candidate run screen. Bands come from the user's measured upright pose (see upperBodyDemo);
// they are candidates, not released verdicts. releasedMotionIds stays empty.
import { demoPlan, OVERHEAD_DEMO_VERSION, SHRUG_DEMO_VERSION } from '../coaching/upperBodyDemo'
import {
  CALIBRATING,
  createUpperBodyWorkspacePlayback,
  type UpperBodyMotion,
} from '../coaching/upperBodyWorkspacePlayback'
import type { CoachingPlan } from '../stretch/progression'
import {
  CandidateCoachingRun,
  type CandidateMotion,
  type CandidateRunConfiguration,
} from './NeckCoachingRun'

type UpperBodyRunConfiguration = CandidateRunConfiguration & Readonly<{ motion: UpperBodyMotion }>
const calibrating =
  '바른 자세를 확인하는 중이에요. 팔을 내리고 정면을 본 채 잠시 그대로 있어 주세요.'
const invalid = () => new Error('Invalid candidate run')

const shrug: CandidateMotion<UpperBodyRunConfiguration> = Object.freeze({
  title: '어깨 으쓱하기',
  stepLabel: () => '양쪽 어깨',
  feedbackText: (code: string) =>
    ({
      [CALIBRATING]: calibrating,
      'shrug-head': '머리 위치 확인 · 머리는 그대로 두고 어깨만 올려 주세요',
      'shrug-trunk': '몸통 확인 · 몸을 곧게 세워 주세요',
      'shrug-arms': '팔 위치 확인 · 팔은 옆에 내려 둔 채 어깨만 올려 주세요',
      'shrug-asymmetry': '양쪽 어깨 높이 확인 · 두 어깨를 함께 올려 주세요',
      'shrug-range': '어깨 높이 확인 · 시범 높이를 다시 보세요',
    })[code] ?? null,
  validate(input: UpperBodyRunConfiguration, plan: CoachingPlan) {
    if (
      input.motion !== 'shoulder-shrug' ||
      plan.motionId !== 'shoulder-shrug' ||
      plan.version !== SHRUG_DEMO_VERSION ||
      plan.steps.length !== 1 ||
      plan.steps[0].id !== 'both'
    )
      throw invalid()
  },
  createPlayback: (input, options) =>
    createUpperBodyWorkspacePlayback(input, { ...options, motion: 'shoulder-shrug' }),
})

const overhead: CandidateMotion<UpperBodyRunConfiguration> = Object.freeze({
  title: '팔 위로 늘리기',
  stepLabel: (id: string) => (id === 'right' ? '오른팔' : '왼팔'),
  feedbackText: (code: string, step: string) =>
    ({
      [CALIBRATING]: calibrating,
      'overhead-head': '머리 위치 확인 · 고개는 정면을 유지해 주세요',
      'overhead-trunk': '몸통 확인 · 몸을 옆으로 기울이지 말아 주세요',
      'overhead-other-arm': `반대쪽 팔은 내려 두세요 · 지금은 ${step} 차례예요`,
      'overhead-elbow': '팔꿈치를 펴 주세요',
      'overhead-range': '팔 높이 확인 · 시범 높이를 다시 보세요',
    })[code] ?? null,
  validate(input: UpperBodyRunConfiguration, plan: CoachingPlan) {
    if (
      input.motion !== 'arm-overhead' ||
      plan.motionId !== 'arm-overhead' ||
      plan.version !== OVERHEAD_DEMO_VERSION ||
      plan.steps.length !== 2 ||
      plan.steps[0].id !== 'left' ||
      plan.steps[1].id !== 'right'
    )
      throw invalid()
  },
  createPlayback: (input, options) =>
    createUpperBodyWorkspacePlayback(input, { ...options, motion: 'arm-overhead' }),
})

// Reached only through SessionGate on a DEV route with the bundled avatars.
const readGates = () =>
  Object.freeze({
    authenticated: true,
    motionValidated: true,
    referenceAvatarReady: true,
    userAvatarReady: true,
  })
export const upperBodyDemoRuns: Readonly<Record<UpperBodyMotion, UpperBodyRunConfiguration>> =
  Object.freeze({
    'shoulder-shrug': Object.freeze({
      scope: 'candidate-review-only',
      // Records go only to the local development database and are labelled as test records.
      recording: 'isolated-local-test',
      motion: 'shoulder-shrug',
      plan: demoPlan('shoulder-shrug', SHRUG_DEMO_VERSION, ['both']),
      readGates,
    }),
    'arm-overhead': Object.freeze({
      scope: 'candidate-review-only',
      recording: 'isolated-local-test',
      motion: 'arm-overhead',
      plan: demoPlan('arm-overhead', OVERHEAD_DEMO_VERSION, ['left', 'right']),
      readGates,
    }),
  })
const motions = Object.freeze({ 'shoulder-shrug': shrug, 'arm-overhead': overhead })

export function UpperBodyCoachingRun({ motion }: { motion: UpperBodyMotion }) {
  return (
    <CandidateCoachingRun
      key={motion}
      configuration={upperBodyDemoRuns[motion]}
      motion={motions[motion]}
    />
  )
}
