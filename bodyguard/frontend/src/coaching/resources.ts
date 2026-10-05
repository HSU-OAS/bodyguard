// FR-S-02/04·FR-M-07·FR-A-03/NFR-07/08: generation-owned resources, no classification or public route.
export type OwnedResource = Readonly<{ dispose(): void | Promise<void> }>
export type ResourceContext = Readonly<{ generation: number; signal: AbortSignal }>
type Factory = (context: ResourceContext) => OwnedResource | Promise<OwnedResource>
type Ports = Readonly<{ camera: Factory; inference: Factory; avatars: Factory }>
type Failure =
  | 'camera-error'
  | 'inference-error'
  | 'asset-error'
  | 'ownership-error'
  | 'cleanup-error'
export type ResourceNotice = Readonly<
  { type: 'ready'; generation: number } | { type: 'error'; generation: number; reason: Failure }
>
type Effect = Readonly<{ type: 'request-camera' | 'release-resources'; generation: number }>
type Observer = (notice: ResourceNotice) => void | Promise<void>
type Owner = {
  generation: number
  abort: AbortController
  claims: Claim[]
}
type Claim = {
  owner: Owner
  resource: OwnedResource
  dispose: OwnedResource['dispose']
  disposal?: Promise<void>
}

/** Independent ownership controller. Real ports must supply distinct, fully owned resources.
 * AbortSignal cannot dismiss a getUserMedia permission popup; late values are still reclaimed.
 * Neither an effect nor ready establishes authentication, clinical validity, or avatar quality.
 */
export function createResourceController(ports: Ports, notify: Observer) {
  const claims = new WeakMap<object, Claim>()
  const pendingCleanup = new Set<Promise<void>>()
  let current: Owner | null = null
  let lastGeneration = 0
  let closed = false
  let poisoned = false
  let observerFailed = false
  let cleanupReported = false

  const owns = (owner: Owner) => current === owner && !closed && !poisoned

  function detach(): Owner | null {
    const previous = current
    current = null
    previous?.abort.abort()
    return previous
  }

  function observerBroke() {
    if (!observerFailed) {
      // A broken observer cannot be called recursively or leave a live acquisition behind.
      observerFailed = true
      poisoned = true
      const owner = detach()
      if (owner) void retire(owner)
    }
  }

  function emit(notice: ResourceNotice) {
    if (observerFailed) return
    try {
      // Notifications are non-blocking: an observer may itself await release/close.
      // Awaiting it inside a disposal would create a cleanup↔observer deadlock.
      void Promise.resolve(notify(Object.freeze(notice))).catch(observerBroke)
    } catch {
      observerBroke()
    }
  }

  function dispose(claim: Claim): Promise<void> {
    if (claim.disposal) return claim.disposal
    // Register the promise before invoking user code: reentrant release/close cannot dispose twice.
    const task = Promise.resolve()
      .then(() => claim.dispose.call(claim.resource))
      .catch(() => {
        poisoned = true
        const owner = detach()
        if (owner) void retire(owner)
        if (!cleanupReported) {
          cleanupReported = true
          emit({ type: 'error', generation: claim.owner.generation, reason: 'cleanup-error' })
        }
      })
    claim.disposal = task
    pendingCleanup.add(task)
    void task.then(() => pendingCleanup.delete(task))
    return task
  }

  async function retire(owner: Owner) {
    owner.abort.abort()
    // Start every cleanup even when another one is pending or fails.
    await Promise.all(owner.claims.map(dispose))
  }

  async function settleCleanup() {
    // Includes an older generation's cleanup even when two replacement requests race.
    while (pendingCleanup.size > 0) await Promise.all([...pendingCleanup])
  }

  async function fail(owner: Owner, reason: Failure) {
    if (!owns(owner)) return
    detach()
    await retire(owner)
    await settleCleanup()
    if (!closed && !poisoned && owner.generation === lastGeneration) {
      await emit({ type: 'error', generation: owner.generation, reason })
      await settleCleanup()
    }
  }

  async function acquire(owner: Owner, factory: Factory, reason: Failure): Promise<boolean> {
    if (!owns(owner)) return false
    let resource: OwnedResource
    let cleanup: OwnedResource['dispose']
    try {
      resource = await factory(
        Object.freeze({ generation: owner.generation, signal: owner.abort.signal }),
      )
      if (
        resource === null ||
        typeof resource !== 'object' ||
        typeof resource.dispose !== 'function'
      ) {
        await fail(owner, reason)
        return false
      }
      cleanup = resource.dispose
    } catch {
      await fail(owner, reason)
      return false
    }
    if (claims.has(resource)) {
      // Never free another owner's object, including a late old factory aliasing the current one.
      await fail(owner, 'ownership-error')
      return false
    }
    const claim: Claim = { owner, resource, dispose: cleanup }
    claims.set(resource, claim)
    owner.claims.push(claim)
    if (!owns(owner)) {
      await dispose(claim)
      await settleCleanup()
      return false
    }
    return true
  }

  async function run(effect: Effect): Promise<void> {
    if (
      !effect ||
      !['request-camera', 'release-resources'].includes(effect.type) ||
      !Number.isSafeInteger(effect.generation) ||
      effect.generation <= 0
    )
      return
    if (effect.type === 'release-resources') {
      if (current?.generation === effect.generation) {
        const owner = detach()
        if (owner) await retire(owner)
      }
      await settleCleanup()
      return
    }
    if (closed || poisoned || effect.generation <= lastGeneration) return
    lastGeneration = effect.generation
    const previous = detach()
    const owner: Owner = { generation: effect.generation, abort: new AbortController(), claims: [] }
    current = owner
    if (previous) await retire(previous)
    await settleCleanup()
    if (!owns(owner)) return
    if (!(await acquire(owner, ports.camera, 'camera-error'))) return
    if (!(await acquire(owner, ports.inference, 'inference-error'))) return
    if (!(await acquire(owner, ports.avatars, 'asset-error'))) return
    if (owns(owner)) await emit({ type: 'ready', generation: owner.generation })
    await settleCleanup()
  }

  async function close(): Promise<void> {
    closed = true
    const owner = detach()
    if (owner) await retire(owner)
    await settleCleanup()
    // Pending factories aren't awaited; their success/rejection handlers remain generation-bound.
  }

  return Object.freeze({ run, close })
}
