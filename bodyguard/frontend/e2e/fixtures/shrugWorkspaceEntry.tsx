// FR-S-02/04: explicit generated test entry only; never a release/clinical profile.
import { CoachingPage as Workspace } from '../../src/pages/CoachingPage'
import type { ShrugRunConfiguration } from '../../src/pages/NeckCoachingRun'
import { shrugCriteria } from './shrugCandidate'
import './shrugWorkspaceSource'

const review = shrugCriteria()
export const configuration: ShrugRunConfiguration = {
  scope: 'candidate-review-only',
  criteria: { ...review, maxFrameAgeMs: 1000, maxFrameGapMs: 1000 },
  plan: {
    motionId: 'shoulder-shrug',
    version: review.version,
    source: 'direct',
    maxFrameAgeMs: 1000,
    maxFrameGapMs: 1000,
    steps: [{ id: 'both', kind: 'repetitions', targetMs: 100, repetitions: 2 }],
  },
  readGates: () => ({
    authenticated: true,
    motionValidated: window.shrugWorkspaceFixture.allow,
    referenceAvatarReady: true,
    userAvatarReady: true,
  }),
}
export function CoachingPage() {
  return <Workspace run={configuration} />
}
