// FR-S-06·NFR-08: immutable allowlisted development media; no public directory/production copy.
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const genders = ['male', 'female'] as const
const motions = ['neck-side', 'shoulder-shrug', 'arm-overhead'] as const
const formats = ['png', 'mp4'] as const
const entries = new Map<string, string>()
for (const gender of genders)
  for (const motion of motions)
    for (const format of formats)
      entries.set(
        `/__bodyguard/motion-media/${gender}/${motion}.${format}`,
        `${gender}-${motion}.${format}`,
      )
type Entry = { file: string; bytes: number; sha256: string }

export function devMotionMediaPlugin(): Plugin {
  return {
    name: 'bodyguard-private-motion-media',
    apply: 'serve',
    configureServer(server) {
      const root = fileURLToPath(
        new URL('../../docs/review/motion-preview-content/media/', import.meta.url),
      )
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/__bodyguard/motion-media/')) return next()
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        const file = entries.get(path)
        if (!file) {
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
          const manifest = JSON.parse(await readFile(`${root}manifest.json`, 'utf8')) as {
            assets: Entry[]
          }
          const entry = manifest.assets.find((asset) => asset.file === file)
          if (
            !entry ||
            !Number.isSafeInteger(entry.bytes) ||
            entry.bytes <= 0 ||
            entry.bytes > 4_000_000 ||
            !/^[0-9a-f]{64}$/.test(entry.sha256)
          )
            throw new Error()
          const info = await lstat(`${root}${file}`)
          if (!info.isFile() || info.size !== entry.bytes) throw new Error()
          const bytes = await readFile(`${root}${file}`)
          if (
            bytes.length !== entry.bytes ||
            createHash('sha256').update(bytes).digest('hex') !== entry.sha256
          )
            throw new Error()
          if (res.destroyed) return
          res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'video/mp4')
          res.setHeader('Content-Length', bytes.length)
          // Small bounded files may be served whole; a Range request never selects a path or bypasses SHA.
          res.end(req.method === 'HEAD' ? undefined : bytes)
        })().catch(() => {
          if (res.destroyed) return
          res.statusCode = 503
          res.end()
        })
      })
    },
  }
}
