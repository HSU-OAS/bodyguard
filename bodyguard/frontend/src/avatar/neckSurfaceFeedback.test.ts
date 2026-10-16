// FR-A-01/03: display projection is not observed individual neck/clavicle rotation.
import { expect, it } from 'vitest'
import { PROJECTED_SURFACE_REGIONS } from './projectedSurfaceRegions'
import { copyFeedbackProgram } from './surfaceFeedback'

it('requires explicit fixed projected masks and does not turn neck/clavicle names into observed bone evidence', () => {
  const p = {
    motionId: 'neck-side',
    version: 'math-neck-v1',
    regions: [
      {
        id: 'head-position',
        bones: PROJECTED_SURFACE_REGIONS['neck-head-line'],
        projection: 'neck-head-line' as const,
      },
    ],
  }
  expect(copyFeedbackProgram(p).regions[0].projection).toBe('neck-head-line')
  for (const region of [
    { id: 'neck', bones: ['neck01'] },
    { id: 'neck', bones: ['neck01'], projection: 'neck-head-line' as const },
    { id: 'neck', bones: ['head', 'neck02', 'neck03'], projection: 'neck-head-line' as const },
    { id: 'neck', bones: ['clavicleL', 'clavicleR'], projection: 'neck-head-line' as const },
  ])
    expect(() => copyFeedbackProgram({ ...p, regions: [region] })).toThrow(
      'Invalid avatar feedback',
    )
})
