// FR-A-02·NFR-08: dev-only, read-only immutable Git objects; no public asset copy.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'
import { REVIEW_AVATAR_ASSETS } from '../src/avatar/reviewAvatarAssets.ts'

const exec = promisify(execFile)
const commit = '2be0ebebe731d4b2e44cd93f453ddbf76b6b581f'
export function devReviewAvatarPlugin(): Plugin {
  return {
    name: 'bodyguard-development-review-avatar',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const entry = Object.entries(REVIEW_AVATAR_ASSETS).find(
          ([, asset]) => req.url?.split('?')[0] === asset.url,
        )
        if (!entry) return next()
        res.setHeader('Cache-Control', 'no-store')
        if (!['GET', 'HEAD'].includes(req.method ?? '')) {
          res.statusCode = 405
          res.end()
          return
        }
        const [gender, asset] = entry
        void exec(
          'git',
          [
            'show',
            `${commit}:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
          ],
          {
            cwd: fileURLToPath(new URL('../', import.meta.url)),
            encoding: 'buffer',
            maxBuffer: 16 * 1024 * 1024,
          },
        )
          .then(({ stdout }) => {
            if (createHash('sha256').update(stdout).digest('hex') !== asset.sha256)
              throw new Error()
            if (res.destroyed) return
            res.setHeader('Content-Type', 'model/gltf-binary')
            res.end(req.method === 'HEAD' ? undefined : stdout)
          })
          .catch(() => {
            if (res.destroyed) return
            res.statusCode = 503
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Review avatar unavailable')
          })
      })
    },
  }
}
