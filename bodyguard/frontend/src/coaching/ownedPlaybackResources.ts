// FR-S-02/04·FR-M-07·FR-A-03/NFR-07/08: private generation-owned playback cohort.
import { createOwnedPosePlayback } from '../avatar/ownedPosePlayback'
import {
  type OwnedResource,
  ResourceCleanupError,
  type ResourceContext,
  type ResourceNotice,
  ResourcePreparationError,
} from './resources'

type PlaybackOptions = Parameters<typeof createOwnedPosePlayback>[0]
type Source = PlaybackOptions['source']
type Avatars = PlaybackOptions['avatars']
type Failure = Extract<ResourceNotice, { type: 'error' }>['reason']
type Options<C extends OwnedResource, I extends OwnedResource, A extends Avatars> = Readonly<{
  /** FR-M-01/NFR-07: avatar factory must not depend on completed inference. */
  parallelPreparation?: boolean
  camera(context: ResourceContext): C | Promise<C>
  inference(context: ResourceContext, camera: C): I | Promise<I>
  avatars(context: ResourceContext): A | Promise<A>
  source(context: ResourceContext, camera: C, inference: I): Source
  scheduler: PlaybackOptions['scheduler']
  render(avatars: A): unknown
  onFailure(notice: Extract<ResourceNotice, { type: 'error' }>): void | Promise<void>
}>
type Claim = { close: OwnedResource['dispose']; disposal?: Promise<void> }
const consumed = new WeakSet<object>()
const unavailable = () => new Error('Playback resource unavailable')

/** Native factories transfer distinct fresh ownership and reclaim partial failures themselves.
 * Their lifetime signal is NOT controller cancellation: active inference must settle first.
 * Source/pair/rendering stay in browser memory. This is not a release gate or SDK policy.
 */
export function createOwnedPlaybackResources<
  C extends OwnedResource,
  I extends OwnedResource,
  A extends Avatars,
>(options: Options<C, I, A>) {
  let parallelPreparation = false
  try {
    const requested = options.parallelPreparation
    if (requested !== undefined && typeof requested !== 'boolean') throw new Error()
    parallelPreparation = requested === true
  } catch {
    throw unavailable()
  }
  if (
    ['camera', 'inference', 'avatars', 'source', 'render', 'onFailure'].some(
      (key) => typeof options?.[key as keyof typeof options] !== 'function',
    ) ||
    typeof options.scheduler?.request !== 'function' ||
    typeof options.scheduler?.cancel !== 'function'
  )
    throw unavailable()
  type Cohort = {
    context: ResourceContext
    lifetime: AbortController
    capture: AbortController
    claims: Claim[]
    pending: Set<Promise<void>>
    requested: Set<'inference' | 'avatars'>
    camera?: C
    inference?: I
    avatars?: A
    pairClaim?: Claim
    playback?: ReturnType<typeof createOwnedPosePlayback>
    retirement?: Promise<void>
    status: 'preparing' | 'ready' | 'running' | 'retiring' | 'closed' | 'failed'
    failure: Failure | null
    reported: Failure | null
    aborted(): void
  }
  let current: Cohort | null = null,
    lastGeneration = 0,
    closed = false,
    poisoned = false,
    cleanupFailed = false,
    observerFailed = false
  const retiring = new Set<Promise<void>>()
  const live = (cohort: Cohort) =>
    !closed &&
    !poisoned &&
    current === cohort &&
    !cohort.context.signal.aborted &&
    !cohort.retirement
  function ready(cohort: Cohort) {
    if (live(cohort) && cohort.status === 'preparing' && cohort.inference && cohort.avatars)
      cohort.status = 'ready'
  }
  function report(cohort: Cohort, reason: Failure) {
    if (reason === 'cleanup-error') {
      cleanupFailed = true
      poisoned = true
    }
    if (cohort.failure === null || reason === 'cleanup-error') cohort.failure = reason
    cohort.status = 'failed'
    void retire(cohort).catch(() => {})
    if (observerFailed || cohort.reported === cohort.failure) return
    cohort.reported = cohort.failure
    const broke = () => {
      observerFailed = true
      poisoned = true
      void retire(cohort).catch(() => {})
    }
    try {
      void Promise.resolve(
        options.onFailure(
          Object.freeze({
            type: 'error',
            generation: cohort.context.generation,
            reason: cohort.failure,
          }),
        ),
      ).catch(broke)
    } catch {
      broke()
    }
  }
  function claim(resource: OwnedResource): Claim {
    if (
      !resource ||
      typeof resource !== 'object' ||
      typeof resource.dispose !== 'function' ||
      consumed.has(resource)
    )
      throw unavailable()
    consumed.add(resource)
    return { close: resource.dispose.bind(resource) }
  }
  function release(cohort: Cohort, owned: Claim): Promise<void> {
    if (owned.disposal) return owned.disposal
    owned.disposal = Promise.resolve()
      .then(() => owned.close())
      .catch(() => {
        report(cohort, 'cleanup-error')
        throw new ResourceCleanupError()
      })
      .finally(() => {
        owned.close = () => {}
      })
    return owned.disposal
  }
  function retire(cohort: Cohort): Promise<void> {
    if (cohort.retirement) return cohort.retirement
    if (cohort.status !== 'failed') cohort.status = 'retiring'
    // Publish before foreign abort/dispose code can reenter: all wrappers share this barrier.
    cohort.retirement = Promise.resolve().then(async () => {
      let failed = cohort.failure === 'cleanup-error'
      try {
        await cohort.playback?.dispose()
      } catch {
        failed = true
      }
      // Abort cannot dismiss a permission popup; reclaim its late owned return. Replacement
      // waits instead of opening a second camera while the old native factory is pending.
      while (cohort.pending.size) await Promise.all([...cohort.pending])
      cohort.lifetime.abort()
      for (const owned of [...cohort.claims].reverse()) {
        try {
          await release(cohort, owned)
        } catch {
          failed = true
        }
      }
      try {
        cohort.context.signal.removeEventListener('abort', cohort.aborted)
      } catch {
        failed = true
      }
      cohort.camera = undefined
      cohort.inference = undefined
      cohort.avatars = undefined
      cohort.playback = undefined
      cohort.pairClaim = undefined
      cohort.claims.length = 0
      cohort.status = cohort.failure ? 'failed' : 'closed'
      if (failed || cohort.failure === 'cleanup-error') {
        report(cohort, 'cleanup-error')
        throw new ResourceCleanupError()
      }
    })
    retiring.add(cohort.retirement)
    void cohort.retirement.then(
      () => retiring.delete(cohort.retirement as Promise<void>),
      () => retiring.delete(cohort.retirement as Promise<void>),
    )
    // Invalidate saved callbacks in the same abort turn, not in a later microtask.
    cohort.capture.abort()
    if (!cohort.playback) cohort.lifetime.abort()
    return cohort.retirement
  }
  async function settle() {
    while (retiring.size) await Promise.allSettled([...retiring])
  }
  function matches(context: ResourceContext): Cohort {
    if (
      !current ||
      context.generation !== current.context.generation ||
      context.signal !== current.context.signal ||
      !live(current)
    )
      throw unavailable()
    return current
  }
  async function acquire<T extends OwnedResource>(
    cohort: Cohort,
    factory: () => T | Promise<T>,
    assign: (value: T, owned: Claim) => void,
    reason: ResourcePreparationError['reason'],
  ): Promise<OwnedResource> {
    if (!live(cohort)) throw unavailable()
    let value: T | undefined
    const pending = Promise.resolve()
      .then(factory)
      .then((resource) => {
        const owned = claim(resource)
        cohort.claims.push(owned)
        value = resource
        assign(resource, owned)
      })
      .catch((error) => {
        if (error instanceof ResourceCleanupError) {
          report(cohort, 'cleanup-error')
          throw new ResourceCleanupError()
        }
        // Save the original stage before retirement aborts the other pending factory.
        // The outer controller reports it once; onFailure is reserved for runtime/cleanup.
        if (live(cohort) && cohort.failure === null) {
          cohort.failure = reason
          cohort.status = 'failed'
        }
        void retire(cohort).catch(() => {})
        throw preparationFailure(cohort)
      })
    const settled = pending.then(
      () => {},
      () => {},
    )
    cohort.pending.add(settled)
    void settled.then(() => cohort.pending.delete(settled))
    await pending
    if (!value || !live(cohort)) {
      void retire(cohort).catch(() => {})
      throw preparationFailure(cohort)
    }
    return Object.freeze({ dispose: () => retire(cohort) })
  }
  function preparationFailure(cohort: Cohort): Error {
    if (cohort.failure === 'cleanup-error') return new ResourceCleanupError()
    if (
      cohort.failure === 'camera-error' ||
      cohort.failure === 'inference-error' ||
      cohort.failure === 'asset-error'
    )
      return new ResourcePreparationError(cohort.failure)
    return unavailable()
  }
  const ports = Object.freeze({
    parallelPreparation,
    async camera(context: ResourceContext) {
      if (
        !context ||
        !Number.isSafeInteger(context.generation) ||
        context.generation <= lastGeneration ||
        !context.signal ||
        context.signal.aborted ||
        closed ||
        poisoned
      )
        throw unavailable()
      lastGeneration = context.generation
      const previous = current
      if (previous) {
        try {
          await retire(previous)
        } catch {
          throw new ResourceCleanupError()
        }
      }
      await settle()
      if (context.signal.aborted || context.generation !== lastGeneration || closed || poisoned)
        throw unavailable()
      const cohort: Cohort = {
        context: Object.freeze({ generation: context.generation, signal: context.signal }),
        lifetime: new AbortController(),
        capture: new AbortController(),
        claims: [],
        pending: new Set(),
        requested: new Set(),
        status: 'preparing',
        failure: null,
        reported: null,
        aborted: () => {
          void retire(cohort).catch(() => {})
        },
      }
      current = cohort
      context.signal.addEventListener('abort', cohort.aborted, { once: true })
      if (context.signal.aborted) cohort.aborted()
      return acquire(
        cohort,
        () =>
          options.camera(
            Object.freeze({ generation: context.generation, signal: cohort.lifetime.signal }),
          ),
        (value) => {
          cohort.camera = value
        },
        'camera-error',
      )
    },
    inference(context: ResourceContext) {
      const cohort = matches(context)
      if (!cohort.camera || cohort.requested.has('inference')) throw unavailable()
      cohort.requested.add('inference')
      const camera = cohort.camera
      return acquire(
        cohort,
        () =>
          options.inference(
            Object.freeze({ generation: context.generation, signal: cohort.lifetime.signal }),
            camera,
          ),
        (value) => {
          cohort.inference = value
          ready(cohort)
        },
        'inference-error',
      )
    },
    async avatars(context: ResourceContext) {
      const cohort = matches(context)
      if (
        !(parallelPreparation ? cohort.camera : cohort.inference) ||
        cohort.requested.has('avatars')
      )
        throw unavailable()
      cohort.requested.add('avatars')
      const wrapper = await acquire(
        cohort,
        () =>
          options.avatars(
            Object.freeze({ generation: context.generation, signal: cohort.lifetime.signal }),
          ),
        (value, owned) => {
          cohort.avatars = value
          cohort.pairClaim = owned
          ready(cohort)
        },
        'asset-error',
      )
      return wrapper
    },
  })
  function start(generation: number): boolean {
    const cohort = current
    if (
      !cohort ||
      !live(cohort) ||
      generation !== cohort.context.generation ||
      cohort.status !== 'ready' ||
      !cohort.camera ||
      !cohort.inference ||
      !cohort.avatars ||
      !cohort.pairClaim
    )
      return false
    const avatars = cohort.avatars,
      pairClaim = cohort.pairClaim
    try {
      const source = options.source(
        Object.freeze({ generation, signal: cohort.capture.signal }),
        cohort.camera,
        cohort.inference,
      )
      const sourceClaim = claim(source)
      cohort.claims.push(sourceClaim)
      const read = source.read.bind(source),
        observe = avatars.observe.bind(avatars),
        render = avatars.render.bind(avatars)
      cohort.playback = createOwnedPosePlayback({
        context: Object.freeze({ generation, signal: cohort.capture.signal }),
        source: { read, dispose: () => release(cohort, sourceClaim) },
        avatars: {
          observe,
          render,
          dispose: () => {
            void release(cohort, pairClaim).catch(() => {})
          },
        },
        scheduler: options.scheduler,
        render: () => options.render(avatars),
        onFailure: (reason) => {
          poisoned = true
          report(cohort, reason === 'callback-error' ? 'asset-error' : reason)
        },
      })
      if (!cohort.playback.start() || !live(cohort)) return false
      cohort.status = 'running'
      return true
    } catch (error) {
      poisoned = true
      report(cohort, error instanceof ResourceCleanupError ? 'cleanup-error' : 'asset-error')
      return false
    }
  }

  // FR-S-03/04·FR-U-04: use controller authority, not the delayed borrowed-frame lifetime.
  function command(generation: number, action: (avatars: A) => boolean): boolean {
    const cohort = current
    if (
      !cohort ||
      !live(cohort) ||
      cohort.context.generation !== generation ||
      (cohort.status !== 'ready' && cohort.status !== 'running') ||
      !cohort.avatars ||
      typeof action !== 'function'
    )
      return false
    try {
      const accepted = action(cohort.avatars)
      return accepted === true && live(cohort)
    } catch {
      if (live(cohort)) report(cohort, 'asset-error')
      return false
    }
  }
  async function close() {
    closed = true
    if (current) {
      try {
        await retire(current)
      } catch {
        /* Persistent cleanup failure is reported below. */
      }
    }
    await settle()
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  return Object.freeze({
    ports,
    start,
    command,
    close,
    getSnapshot: () =>
      Object.freeze({
        generation: current?.context.generation ?? null,
        status: current?.status ?? 'idle',
        failure: current?.failure ?? null,
        closed,
        poisoned,
      }),
  })
}
