// FR-V-03/NFR-08: owned test-only local fixture, not a production authentication service.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer as createSink } from 'node:net'
import { fileURLToPath } from 'node:url'
import { createServer, preview } from 'vite'

const flags = process.argv.slice(2)
if (
  new Set(flags).size !== flags.length ||
  flags.some(
    (flag) => !['--headed', '--boundaries-only', '--negative-artifacts-only'].includes(flag),
  ) ||
  (flags.includes('--boundaries-only') && flags.includes('--negative-artifacts-only'))
)
  throw new Error('Use --headed and at most one scoped startup diagnostic mode')
const root = fileURLToPath(new URL('..', import.meta.url))
const output = `test-results/startup-${new Date().toISOString().replaceAll(/[-:.]/g, '')}`
mkdirSync(new URL('../test-results', import.meta.url), { recursive: true })
mkdirSync(new URL(`../${output}`, import.meta.url))
const syntheticMe = JSON.stringify({ id: 'startup-fixture', email: 'fixture@example.com' })
const fixture = {
  name: 'bodyguard-startup-test-only',
  configureServer: installFixture,
  configurePreviewServer: installFixture,
}
function installFixture(server) {
  server.middlewares.use((request, response, next) => {
    if (!request.url?.startsWith('/api')) return next()
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    response.statusCode = request.method === 'GET' && request.url === '/api/v1/me' ? 200 : 403
    response.end(response.statusCode === 200 ? syntheticMe : '{}')
  })
}
function origin(server) {
  const address = server.address()
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1')
    throw new Error('Owned loopback listener required')
  return `http://127.0.0.1:${address.port}`
}
const sink = createSink((socket) => socket.destroy())
let dev
let built
let child
let interrupted = false
const stop = () => {
  interrupted = true
  // Vite has its own signal handler: cancellation must never become exit 0.
  process.exitCode = 1
  child?.kill('SIGTERM')
}
const checkInterrupted = () => {
  if (interrupted) throw new Error('Startup harness interrupted')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
try {
  await new Promise((resolve, reject) => {
    sink.once('error', reject)
    sink.listen(0, '127.0.0.1', resolve)
  })
  // Optional parent IPC permits a signal test against only this runner's own listener.
  process.send?.({ phase: 'proxy-ready', origin: origin(sink) })
  checkInterrupted()
  // Keep the checked-in product config; only the owned test fixture/listeners differ.
  dev = await createServer({
    root,
    plugins: [fixture],
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  })
  checkInterrupted()
  await dev.listen()
  process.send?.({ phase: 'dev-ready', origin: origin(dev.httpServer) })
  checkInterrupted()
  built = await preview({
    root,
    plugins: [fixture],
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  })
  checkInterrupted()
  child = spawn(
    process.execPath,
    [
      createRequire(import.meta.url).resolve('@playwright/test/cli'),
      'test',
      '--config',
      'playwright.startup.config.ts',
      '--output',
      output,
      ...flags.filter((flag) => flag === '--headed'),
      ...(flags.includes('--boundaries-only') ? ['--grep', 'startup boundary:'] : []),
      ...(flags.includes('--negative-artifacts-only') ? ['--grep', 'startup negative:'] : []),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        BODYGUARD_STARTUP_DEV: origin(dev.httpServer),
        BODYGUARD_STARTUP_PRODUCTION: origin(built.httpServer),
        BODYGUARD_TEST_BLOCKED_PROXY: origin(sink),
        BODYGUARD_STARTUP_REPORT: `${output}/report.json`,
        BODYGUARD_STARTUP_NEGATIVE_ARTIFACTS: flags.includes('--negative-artifacts-only')
          ? '1'
          : '0',
      },
      stdio: 'inherit',
    },
  )
  const childExit = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
  process.exitCode = interrupted ? 1 : childExit
} finally {
  process.removeListener('SIGINT', stop)
  process.removeListener('SIGTERM', stop)
  await dev?.close()
  if (built) {
    built.httpServer.closeAllConnections()
    await new Promise((resolve) => built.httpServer.close(resolve))
  }
  await new Promise((resolve) => sink.close(resolve))
}
