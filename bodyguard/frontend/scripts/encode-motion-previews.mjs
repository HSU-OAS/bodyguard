// FR-S-06·FR-A-01: encode generated Blender frames only; no camera/person material.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const [source, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-motion-media\.[A-Za-z0-9]+\/rendered-[a-z]+$/.test(source))
assert(/^[a-z][a-z0-9-]+$/.test(label))
const output = `${source}/${label}`
mkdirSync(output)
const report = JSON.parse(readFileSync(`${source}/report.json`, 'utf8'))
assert.deepEqual(report.before, report.after)
assert.equal(report.reports.length, 6)
const ffmpeg = '/opt/homebrew/bin/ffmpeg',
  ffprobe = '/opt/homebrew/bin/ffprobe'
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const assets = [],
  streams = []
for (const item of report.reports) {
  const { gender, motion, end, poster } = item
  assert(
    ['male', 'female'].includes(gender) &&
      ['neck-side', 'shoulder-shrug', 'arm-overhead'].includes(motion),
  )
  const name = `${gender}-${motion}`,
    folder = `${source}/${name}`
  assert.equal(readdirSync(folder).filter((f) => /^\d{4}\.png$/.test(f)).length, end)
  for (let n = 1; n <= end; n++) assert(existsSync(`${folder}/${String(n).padStart(4, '0')}.png`))
  execFileSync(ffmpeg, [
    '-nostdin',
    '-v',
    'error',
    '-n',
    '-framerate',
    '24',
    '-i',
    `${folder}/%04d.png`,
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=512x512:r=24',
    '-filter_complex',
    '[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p[v]',
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-crf',
    '20',
    '-preset',
    'fast',
    '-movflags',
    '+faststart',
    `${output}/${name}.mp4`,
  ])
  execFileSync(ffmpeg, [
    '-nostdin',
    '-v',
    'error',
    '-n',
    '-i',
    `${folder}/${String(poster).padStart(4, '0')}.png`,
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=512x512',
    '-filter_complex',
    '[1:v][0:v]overlay=shortest=1:format=auto,format=rgb24[v]',
    '-map',
    '[v]',
    '-frames:v',
    '1',
    `${output}/${name}.png`,
  ])
  const probe = JSON.parse(
    execFileSync(
      ffprobe,
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames:format=duration',
        '-of',
        'json',
        `${output}/${name}.mp4`,
      ],
      { encoding: 'utf8' },
    ),
  )
  assert.equal(probe.streams.length, 1)
  assert.equal(probe.streams[0].codec_name, 'h264')
  assert.equal(probe.streams[0].width, 512)
  assert.equal(probe.streams[0].height, 512)
  assert.equal(probe.streams[0].r_frame_rate, '24/1')
  assert.equal(Number(probe.streams[0].nb_frames), end)
  assert(Math.abs(Number(probe.format.duration) - end / 24) < 0.01)
  streams.push({ name, ...probe })
  for (const format of ['png', 'mp4']) {
    const file = `${name}.${format}`,
      bytes = readFileSync(`${output}/${file}`).length
    assert(bytes > 0 && bytes <= 4_000_000)
    assets.push({ file, bytes, sha256: sha(`${output}/${file}`) })
  }
}
const target = resolve('../docs/review/motion-preview-content/media'),
  native = resolve('../docs/review/motion-preview-content/native')
mkdirSync(target, { recursive: true })
mkdirSync(native, { recursive: true })
for (const entry of assets) assert(!existsSync(`${target}/${entry.file}`))
assert(!existsSync(`${target}/manifest.json`))
for (const entry of assets)
  copyFileSync(`${output}/${entry.file}`, `${target}/${entry.file}`, constants.COPYFILE_EXCL)
copyFileSync(
  `${source}/motion-preview-authoring.blend`,
  `${native}/motion-preview-authoring.blend`,
  constants.COPYFILE_EXCL,
)
copyFileSync(`${source}/report.json`, `${native}/render-report.json`, constants.COPYFILE_EXCL)
writeFileSync(
  `${native}/encoding-report.json`,
  JSON.stringify(
    {
      method: 'own Blender frames, opaque white composition and h264 encoding; no people/camera',
      streams,
      sourceNativeSha256: sha(`${source}/motion-preview-authoring.blend`),
    },
    null,
    2,
  ),
  { flag: 'wx' },
)
writeFileSync(
  `${target}/manifest.json`,
  JSON.stringify(
    { candidate: true, sourceCommit: '2be0ebebe731d4b2e44cd93f453ddbf76b6b581f', assets },
    null,
    2,
  ),
  { flag: 'wx' },
)
console.log(JSON.stringify({ target, assets: assets.length, videos: streams.length }))
