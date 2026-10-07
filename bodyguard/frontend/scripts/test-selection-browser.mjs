// FR-V-03/NFR-08: synthetic account UI testing; owned local TCP sink blocks external egress.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const flags = process.argv.slice(2)
if (flags.length > 1 || (flags.length === 1 && flags[0] !== '--headed'))
  throw new Error('Only optional --headed is supported')
const output = `test-results/selection-${new Date().toISOString().replaceAll(/[-:.]/g, '')}`

const sink = createServer((socket) => socket.destroy())
await new Promise((resolve, reject) => {
  sink.once('error', reject)
  sink.listen(0, '127.0.0.1', resolve)
})
const address = sink.address()
if (!address || typeof address === 'string') throw new Error('Proxy address missing')
const child = spawn(
  'pnpm',
  [
    'exec',
    'playwright',
    'test',
    '--config',
    'playwright.selection.config.ts',
    '--output',
    output,
    ...flags,
  ],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      BODYGUARD_TEST_BLOCKED_PROXY: `http://127.0.0.1:${address.port}`,
      BODYGUARD_TEST_SELECTION_REPORT: `${output}/report.json`,
    },
    stdio: 'inherit',
  },
)
const stop = () => {
  child.kill('SIGTERM')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
try {
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
  process.exitCode = Number(result)
} finally {
  process.removeListener('SIGINT', stop)
  process.removeListener('SIGTERM', stop)
  await new Promise((resolve) => sink.close(resolve))
}
