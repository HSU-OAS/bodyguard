// FR-S-02/04·FR-R-03: real modules/session/DTO; generated points/resources and mock HTTP.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createLogger, createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-overhead\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/posture/armOverheadObservation.ts',
  'src/posture/shoulderShrugObservation.ts',
  'src/posture/thresholds.ts',
  'src/stretch/overheadCandidateClassifier.ts',
  'src/coaching/overheadCandidateFeedback.ts',
  'src/coaching/session.ts',
  'src/coaching/resources.ts',
  'src/stretch/progression.ts',
  'src/coaching/resultRecord.ts',
  'src/api/records.ts',
  'src/api/auth.ts',
  'e2e/fixtures/overheadCandidate.ts',
  'scripts/test-overhead-candidate.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(
    files.map((f) => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]),
  )
const before = snapshot(),
  cases = [],
  saved = [],
  live = [],
  environmentErrors = []
let server,
  failure = null
const originalFetch = globalThis.fetch
try {
  server = await createServer(
    mergeConfig(config, {
      configFile: false,
      envDir: scratch,
      logLevel: 'error',
      customLogger: (() => {
        const logger = createLogger('error'),
          report = logger.error.bind(logger)
        logger.error = (message, options) => {
          environmentErrors.push('vite-error')
          report(message, options)
        }
        return logger
      })(),
      server: { middlewareMode: true, host: '127.0.0.1', hmr: false, ws: false, watch: null },
    }),
  )
  assert.equal(server.httpServer, null)
  assert.equal(server.config.server.ws, false)
  const { overheadCriteria, overheadFrame } = await server.ssrLoadModule(
    '/e2e/fixtures/overheadCandidate.ts',
  )
  const { createOverheadCandidateFeedback } = await server.ssrLoadModule(
    '/src/coaching/overheadCandidateFeedback.ts',
  )
  const { createCoachingSession } = await server.ssrLoadModule('/src/coaching/session.ts')
  const { resultRecord, saveResultRecord } = await server.ssrLoadModule(
    '/src/coaching/resultRecord.ts',
  )
  const regions = {
    left: {
      'overhead-head': 'head',
      'overhead-trunk': 'trunk',
      'overhead-other-arm': 'right-arm',
      'overhead-elbow': 'left-arm',
      'overhead-range': 'left-arm',
    },
    right: {
      'overhead-head': 'head',
      'overhead-trunk': 'trunk',
      'overhead-other-arm': 'left-arm',
      'overhead-elbow': 'right-arm',
      'overhead-range': 'right-arm',
    },
  }
  async function fixture(repetitions = 0, validated = true) {
    let now = 20,
      seq = 0
    const criteria = overheadCriteria(),
      gates = {
        authenticated: true,
        motionValidated: validated,
        referenceAvatarReady: true,
        userAvatarReady: true,
      },
      resources = []
    const acquire = async () => {
      const r = {
        closes: 0,
        dispose() {
          this.closes++
        },
      }
      resources.push(r)
      return r
    }
    const plan = {
      motionId: 'arm-overhead',
      version: criteria.version,
      source: 'direct',
      maxFrameAgeMs: criteria.maxFrameAgeMs,
      maxFrameGapMs: criteria.maxFrameGapMs,
      steps: ['left', 'right'].map((id) =>
        repetitions
          ? { id, kind: 'repetitions', targetMs: 50, repetitions }
          : { id, kind: 'hold', targetMs: 50 },
      ),
    }
    const session = createCoachingSession({
      plan,
      ports: { camera: acquire, inference: acquire, avatars: acquire },
      now: () => now,
      readGates: () => gates,
      onChange() {},
    })
    live.push(session)
    await session.start()
    const pending = []
    const make = (generation) =>
      createOverheadCandidateFeedback({
        criteria,
        generation,
        now: () => now,
        session,
        regions,
        observe(input) {
          pending.push(session.observe(input))
          return session.getSnapshot()
        },
      })
    const adapter = make(1)
    return {
      session,
      adapter,
      make,
      gates,
      resources,
      pending,
      at: (n) => {
        now = n
      },
      send(l, r, t, mutate, owner = adapter, generation = 1) {
        now = t
        const f = overheadFrame(l, r, ++seq, t, { generation })
        mutate?.(f)
        return owner.evaluate(f)
      },
      async settle() {
        await Promise.all(pending)
      },
      async end(t = 400) {
        now = t
        await session.end('user-stop')
        await Promise.all(pending)
      },
    }
  }
  const complete = async (repetitions) => {
    const f = await fixture(repetitions)
    let t = 30
    for (const side of ['left', 'right'])
      for (let n = 0; n < (repetitions || 1); n++) {
        for (const [l, r, at] of [
          [0, 0, t],
          [side === 'left' ? Math.PI : 0, side === 'right' ? Math.PI : 0, t + 10],
          [side === 'left' ? Math.PI : 0, side === 'right' ? Math.PI : 0, t + 60],
          [0, 0, t + 70],
        ])
          f.send(l, r, at)
        t += 80
      }
    await f.settle()
    assert.equal(f.session.getSnapshot().state.result?.outcome, 'completed')
    for (const r of f.resources) assert.equal(r.closes, 1)
    return f
  }
  const completed = await complete(0),
    repeated = await complete(2)
  assert.equal(
    repeated.session.getSnapshot().state.result.steps.reduce((n, s) => n + s.repetitions, 0),
    4,
  )
  cases.push(
    'left and right hold completion each requires neutral start and return',
    'two repetitions per arm require all four actual returns',
  )
  const row = resultRecord({
    snapshot: completed.session.getSnapshot(),
    recordId: '00000000-0000-4000-8000-000000000001',
    startedUtcAt: '2026-10-17T00:00:00.000Z',
  })
  assert.deepEqual(
    Object.keys(row).sort(),
    [
      'id',
      'motion_id',
      'protocol_version',
      'started_at',
      'ended_at',
      'outcome',
      'observed_ms',
      'repetitions',
    ].sort(),
  )
  assert.equal(row.observed_ms, 100)
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/v1/records/stretch')
    assert.equal(init.method, 'POST')
    saved.push(JSON.parse(init.body))
    return new Response(
      JSON.stringify({
        ...row,
        created_at: '2026-10-17T00:00:00.000Z',
        provenance: 'client-reported',
      }),
      { status: 201 },
    )
  }
  await saveResultRecord(row, { csrfProof: 'a'.repeat(64), signal: new AbortController().signal })
  assert.equal(saved.length, 1)
  assert(!/landmarks|Elbow|Wrist|regionId|classification|generation/.test(JSON.stringify(saved)))
  cases.push('existing result contract writes bounded summary only to mock same-origin HTTP')
  for (const kind of ['wrong-arm', 'both-arms', 'head', 'trunk', 'elbow']) {
    const f = await fixture()
    f.send(0, 0, 30)
    f.send(Math.PI, 0, 40)
    const d = f.send(
      kind === 'wrong-arm' ? 0 : Math.PI,
      kind === 'wrong-arm' || kind === 'both-arms' ? Math.PI : 0,
      60,
      (frame) => {
        const p = frame.result.landmarks[0]
        if (kind === 'head') for (const i of [0, 7, 8]) p[i].x += 40 / 640
        if (kind === 'trunk') for (const i of [11, 12]) p[i].x += 40 / 640
        if (kind === 'elbow') p[15] = { ...p[13], x: p[13].x - 80 / 640 }
      },
    )
    assert(d.errors.length > 0)
    assert.equal(f.session.getSnapshot().state.progress[0].holdMs, 0)
    await f.end()
    cases.push(`${kind} does not accrue target hold or fabricate completion`)
  }
  for (const kind of ['hips', 'presence', 'multiple', 'gap']) {
    const f = await fixture()
    f.send(0, 0, 30)
    f.send(Math.PI, 0, 40)
    const d = f.send(Math.PI, 0, kind === 'gap' ? 150 : 60, (frame) => {
      if (kind === 'hips') frame.result.landmarks[0][23].visibility = 0
      if (kind === 'presence') frame.result.landmarks[0][16].presence = 0
      if (kind === 'multiple') frame.result.landmarks.push(frame.result.landmarks[0])
    })
    assert.deepEqual(d.errors, [])
    assert.equal(f.session.getSnapshot().state.progress[0].holdMs, 0)
    await f.end()
    cases.push(`${kind} revokes the previous target rather than bridging hold`)
  }
  const denied = await fixture(0, false)
  assert.equal(denied.resources.length, 0)
  assert.equal(denied.send(0, 0, 30), null)
  cases.push('false validation gate acquires no resource and cannot be bypassed')
  const revoked = await fixture()
  revoked.gates.authenticated = false
  revoked.send(0, 0, 30)
  await revoked.settle()
  assert.equal(revoked.session.getSnapshot().state.result?.reason, 'session-expired')
  cases.push('revoked authentication ends rather than completing a candidate')
  const resumed = await fixture()
  resumed.send(0, 0, 30)
  resumed.at(40)
  await resumed.session.pause()
  resumed.at(50)
  await resumed.session.resume()
  const fresh = resumed.make(2)
  assert.equal(resumed.send(Math.PI, 0, 60), null)
  assert.equal(resumed.send(Math.PI, 0, 70, undefined, fresh, 1), null)
  resumed.send(0, 0, 80, undefined, fresh, 2)
  resumed.send(Math.PI, 0, 90, undefined, fresh, 2)
  assert.equal(resumed.session.getSnapshot().state.phase, 'holding')
  await resumed.end()
  for (const r of resumed.resources) assert.equal(r.closes, 1)
  cases.push('pause retires the old cohort and only a fresh generation can observe after resume')
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack }
} finally {
  globalThis.fetch = originalFetch
  for (const session of live) await session.close('user-stop')
  await server?.close()
  if (!failure && environmentErrors.length)
    failure = { name: 'Error', message: 'Vite harness reported environment errors' }
  const after = snapshot()
  assert.deepEqual(after, before)
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'Vite SSR actual pure classifier/session/engine/result modules; generated points/resources, mock HTTP, no browser/SDK/person/SQL/clinical accuracy',
        before,
        after,
        cases,
        saved,
        environmentErrors,
        failure,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output: `${scratch}/${label}.json`, passed: cases.length, failure }))
if (failure) process.exitCode = 1
