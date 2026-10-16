// FR-A-02·FR-S-03·NFR-08: fixed read-only dev assets; never public/camera/user data.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'
import { referenceContentAsset } from '../src/avatar/referenceContentAssets.ts'
import { REVIEW_AVATAR_ASSETS } from '../src/avatar/reviewAvatarAssets.ts'

const exec = promisify(execFile)
export function devReferenceContentPlugin(): Plugin {
  return {
    name: 'bodyguard-development-reference-content',
    apply: 'serve',
    configureServer(server) {
      const entries = new Map<
        string,
        { bytes: number; sha256: string; file: string; source: 'git' | 'file' }
      >()
      for (const gender of ['male', 'female'] as const) {
        const body = REVIEW_AVATAR_ASSETS[gender]
        entries.set(body.url, {
          ...body,
          source: 'git',
          file: `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
        })
        for (const motion of ['neck-side', 'shoulder-shrug', 'arm-overhead'] as const) {
          const asset = referenceContentAsset(gender, motion)
          entries.set(asset.url, {
            ...asset,
            source: 'file',
            file: fileURLToPath(
              new URL(
                `../../docs/review/blender-reference-content/animations/${gender}-${motion}.glb`,
                import.meta.url,
              ),
            ),
          })
        }
      }
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (
          !path.startsWith('/__bodyguard/reference-content/') &&
          !path.startsWith('/__bodyguard/review-avatar/')
        )
          return next()
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        const asset = entries.get(path)
        if (!asset) {
          res.statusCode = 404
          res.end()
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405
          res.end()
          return
        }
        void (async () => {
          let bytes: Buffer
          if (asset.source === 'git') {
            const result = await exec('git', ['show', asset.file], {
              cwd: fileURLToPath(new URL('../', import.meta.url)),
              encoding: 'buffer',
              maxBuffer: 16_000_000,
              timeout: 30_000,
            })
            bytes = result.stdout
          } else {
            const info = await lstat(asset.file)
            if (!info.isFile() || info.size !== asset.bytes) throw new Error()
            bytes = await readFile(asset.file)
          }
          if (
            bytes.length !== asset.bytes ||
            createHash('sha256').update(bytes).digest('hex') !== asset.sha256
          )
            throw new Error()
          if (res.destroyed) return
          res.setHeader('Content-Type', 'model/gltf-binary')
          res.setHeader('Content-Length', bytes.length)
          res.end(req.method === 'HEAD' ? undefined : bytes)
        })().catch(() => {
          if (!res.destroyed) {
            res.statusCode = 503
            res.end()
          }
        })
      })
    },
  }
}
