// FR-M-07/NFR-08: test Vite transform only; never changes SDK/timeout/result authority.
export function instrumentWorkerFailure(source: string) {
  function once(before: string, after: string) {
    if (source.split(before).length !== 2) throw new Error('Native diagnostic source mismatch')
    source = source.replace(before, after)
  }
  once(
    '  function failed() {',
    `  function failed(__cause?: unknown) {
    workerFailureNote(typeof __cause === 'string' ? __cause : 'worker-event', {
      ready, pending: !!pending, retiring, initSent, cleanupFailed,
      lateByMs: responseDeadline === undefined ? null : performance.now() - responseDeadline,
    })`,
  )
  once(
    'responseTimer = undefined\n      failed()',
    "responseTimer = undefined\n      failed('response-timeout')",
  )
  once(
    '    } catch {\n      failed()\n    }\n  }\n  function dispose()',
    "    } catch {\n      failed('protocol')\n    }\n  }\n  function dispose()",
  )
  once(
    '        } catch {\n          failed()\n        } finally {',
    "        } catch {\n          failed('post-frame')\n        } finally {",
  )
  once(
    '            cleanupFailed = true\n            failed()',
    "            cleanupFailed = true\n            failed('frame-release')",
  )
  once(
    '          cleanupFailed = true\n          failed()',
    "          cleanupFailed = true\n          failed('frame-release')",
  )
  once(
    '      finishDisposal = (clean) => {',
    `      finishDisposal = (clean) => {
        if (!clean || cleanupFailed) workerFailureNote('close-unclean', {
          ready, pending: !!pending, retiring, initSent, cleanupFailed, lateByMs: null,
        })`,
  )
  return `import { workerFailureNote } from '/e2e/fixtures/nativeCleanupDiagnostics.ts';\n${source}`
}
