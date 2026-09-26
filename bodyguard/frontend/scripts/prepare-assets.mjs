// 개발 서버·빌드 전에 MediaPipe 실행 파일과 포즈 모델을 public/에 준비한다.
// 둘 다 레포에 넣지 않는다 (design §4.1, ADR-0015)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// MediaPipe WASM은 Vite가 챙겨 주지 않아서 정적 폴더로 복사한다. 패키지 버전이 바뀌면 다시 복사한다
const pkgDir = join(root, 'node_modules/@mediapipe/tasks-vision')
const version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version
const wasmDst = join(root, 'public/mediapipe/wasm')
const marker = join(root, 'public/mediapipe/VERSION')
const copied = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null
if (copied !== version) {
  rmSync(wasmDst, { recursive: true, force: true })
  mkdirSync(wasmDst, { recursive: true })
  cpSync(join(pkgDir, 'wasm'), wasmDst, { recursive: true })
  writeFileSync(marker, version)
  console.log(`MediaPipe WASM ${version}을 public/mediapipe/wasm에 복사했습니다`)
}

// 모델: Google MediaPipe 공식 저장소, Apache-2.0. 없을 때만 받는다. src/pose/constants.ts와 맞춘다
// 포즈 lite 5.5MB, full 9.0MB, heavy 29.2MB / 손가락·제스처 8.0MB / 얼굴 3.8MB
const MODELS = [
  ['pose_landmarker', 'pose_landmarker_lite'],
  ['pose_landmarker', 'pose_landmarker_full'],
  ['pose_landmarker', 'pose_landmarker_heavy'],
  ['gesture_recognizer', 'gesture_recognizer'],
  ['face_landmarker', 'face_landmarker'],
]
for (const [group, name] of MODELS) {
  const modelPath = join(root, `public/models/${name}.task`)
  if (existsSync(modelPath)) continue
  mkdirSync(dirname(modelPath), { recursive: true })
  const url = `https://storage.googleapis.com/mediapipe-models/${group}/${name}/float16/1/${name}.task`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`모델 ${name}을 받지 못했습니다: HTTP ${res.status}`)
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()))
  console.log(`모델 ${name}을 public/models에 받았습니다`)
}
