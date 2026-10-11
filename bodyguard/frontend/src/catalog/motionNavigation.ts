// FR-S-06: fixed local destinations; retain only the existing selection context.
import { parseRegion } from './motions'

export function motionNavigationUrl(
  path: '/dev/select' | '/dev/coaching',
  params: URLSearchParams,
  motionId?: string,
) {
  const next = new URLSearchParams()
  const query = (params.get('search') ?? '').slice(0, 120)
  const region = parseRegion(params.get('region'))
  if (query) next.set('search', query)
  if (region !== 'all') next.set('region', region)
  if (motionId) next.set('motion', motionId)
  return next.size ? `${path}?${next}` : path
}
