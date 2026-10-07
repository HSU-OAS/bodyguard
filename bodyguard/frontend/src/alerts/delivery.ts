// FR-N-04/05: private delivery contract; no classifier, raw data or public producer.
export type AlertKind = 'posture' | 'sitting'
export type Permission = NotificationPermission | 'unsupported' | 'failed' | 'requesting'
export type NotificationHandle = { close(): void }
export type NotificationPort = {
  permission(): NotificationPermission | 'unsupported'
  requestPermission(): Promise<NotificationPermission>
  show(kind: AlertKind, click: () => void, fail: () => void): NotificationHandle
}
export type DeliverySnapshot = Readonly<{
  permission: Permission
  alerts: ReadonlyArray<AlertKind>
  browserFailed: boolean
  closed: boolean
}>
export function createAlertDelivery(options: {
  port: NotificationPort
  isCurrent(): boolean
  enabled: Readonly<Record<AlertKind, boolean>>
  onChoose(kind: AlertKind): void
}) {
  type Entry = { handle: NotificationHandle | null; failed: boolean; choosing: boolean }
  const entries = new Map<AlertKind, Entry>()
  const listeners = new Set<() => void>()
  let enabled = copyEnabled(options.enabled)
  let closed = false
  let waiting = false
  let browserFailed = false
  let permission: Permission = readPermission()
  let snapshot = makeSnapshot()
  function copyEnabled(value: Readonly<Record<AlertKind, boolean>>) {
    if (
      Object.keys(value).length !== 2 ||
      typeof value.posture !== 'boolean' ||
      typeof value.sitting !== 'boolean'
    )
      throw new Error('Invalid alert delivery settings')
    return { posture: value.posture, sitting: value.sitting }
  }
  function readPermission(): Permission {
    try {
      const value = options.port.permission()
      return ['default', 'granted', 'denied', 'unsupported'].includes(value) ? value : 'failed'
    } catch {
      return 'failed'
    }
  }
  function makeSnapshot(): DeliverySnapshot {
    return Object.freeze({
      permission,
      alerts: Object.freeze([...entries.keys()]),
      browserFailed,
      closed,
    })
  }
  function publish() {
    snapshot = makeSnapshot()
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        /* A subscriber cannot prevent reclamation. */
      }
    }
  }
  function closeHandle(entry: Entry) {
    const handle = entry.handle
    entry.handle = null
    try {
      handle?.close()
    } catch {
      /* Screen/lifecycle removal still proceeds. */
    }
  }
  function remove(kind: AlertKind) {
    const entry = entries.get(kind)
    entries.delete(kind)
    if (entry) closeHandle(entry)
  }
  function dispose() {
    if (closed) return
    closed = true
    for (const kind of [...entries.keys()]) remove(kind)
    publish()
    listeners.clear()
  }
  function alive() {
    if (closed) return false
    try {
      if (options.isCurrent()) return true
    } catch {
      /* Failed authority is not permission. */
    }
    dispose()
    return false
  }
  function choose(kind: AlertKind) {
    if (!alive()) return false
    const entry = entries.get(kind)
    if (!entry || entry.choosing) return false
    entry.choosing = true
    try {
      options.onChoose(kind)
    } catch {
      return false
    } finally {
      entry.choosing = false
    }
    if (!alive()) return false
    if (entries.get(kind) === entry) {
      remove(kind)
      publish()
    }
    return true
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!closed) listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    receive(kind: AlertKind) {
      if (!alive() || !['posture', 'sitting'].includes(kind) || !enabled[kind]) return false
      remove(kind)
      const entry: Entry = { handle: null, failed: false, choosing: false }
      entries.set(kind, entry)
      permission = waiting ? 'requesting' : readPermission()
      publish()
      if (permission !== 'granted' || !alive() || entries.get(kind) !== entry) return true
      const fail = () => {
        if (!alive() || entries.get(kind) !== entry) return
        entry.failed = true
        closeHandle(entry)
        browserFailed = true
        publish()
      }
      try {
        const handle = options.port.show(
          kind,
          () => {
            if (alive() && entries.get(kind) === entry) choose(kind)
          },
          fail,
        )
        if (!alive() || entries.get(kind) !== entry || entry.failed) {
          try {
            handle.close()
          } catch {
            /* Reentrant disposal also closes late handles. */
          }
        } else entry.handle = handle
      } catch {
        fail()
      }
      return true
    },
    async requestPermission() {
      if (!alive() || waiting) return
      permission = readPermission()
      if (!['default', 'failed'].includes(permission)) {
        publish()
        return
      }
      waiting = true
      permission = 'requesting'
      publish()
      // FR-N-05: a subscriber may revoke the page while showing request intent.
      if (!alive()) {
        waiting = false
        return
      }
      try {
        const result = await options.port.requestPermission()
        if (!alive()) return
        permission = ['default', 'granted', 'denied'].includes(result) ? result : 'failed'
      } catch {
        if (alive()) permission = 'failed'
      } finally {
        waiting = false
        if (!closed) publish()
      }
    },
    refreshPermission() {
      if (!alive() || waiting) return
      permission = readPermission()
      publish()
    },
    setEnabled(value: Readonly<Record<AlertKind, boolean>>) {
      if (!alive()) return
      enabled = copyEnabled(value)
      for (const kind of [...entries.keys()]) if (!enabled[kind]) remove(kind)
      publish()
    },
    choose,
    dismiss(kind: AlertKind) {
      if (!alive() || !entries.has(kind)) return
      remove(kind)
      publish()
    },
    dispose,
  }
}
export type AlertDelivery = ReturnType<typeof createAlertDelivery>
