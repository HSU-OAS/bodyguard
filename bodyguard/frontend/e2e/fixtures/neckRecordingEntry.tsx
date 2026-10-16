// FR-R-03/FR-U-04: isolated test API only; mathematical profile is NOT release authority.
import { CoachingPage as Workspace } from '../../src/pages/CoachingPage'
import { configuration } from './neckWorkspaceEntry'

const recording = { ...configuration, recording: 'isolated-local-test' as const }
export function CoachingPage() {
  return <Workspace run={recording} />
}
