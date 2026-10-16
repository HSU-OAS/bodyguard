// FR-S-02/03/04: only a test Vite alias may supply this generated protocol/true gates.
import { CoachingPage as Workspace } from '../../src/pages/CoachingPage'
import type { NeckRunConfiguration } from '../../src/pages/NeckCoachingRun'
import { criteria } from './neckCandidate'
import './neckWorkspaceSource'

const review = criteria()
const configuration: NeckRunConfiguration = {
  scope: 'candidate-review-only',
  criteria: { ...review, maxFrameAgeMs: 1000, maxFrameGapMs: 1000 },
  plan: {
    motionId: 'neck-side',
    version: review.version,
    source: 'direct',
    maxFrameAgeMs: 1000,
    maxFrameGapMs: 1000,
    steps: [
      { id: 'left', kind: 'hold', targetMs: 50 },
      { id: 'right', kind: 'hold', targetMs: 50 },
    ],
  },
  readGates: () => ({
    authenticated: true,
    motionValidated: window.neckWorkspaceFixture.allow,
    referenceAvatarReady: true,
    userAvatarReady: true,
  }),
}
export function CoachingPage() {
  return <Workspace run={configuration} />
}
