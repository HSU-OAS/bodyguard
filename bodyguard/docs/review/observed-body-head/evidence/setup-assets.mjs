import assert from 'node:assert/strict'
import {constants,copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
const [work,cache,proof]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-observed-body-head'))
const names=['pose_landmarker_lite','pose_landmarker_full','pose_landmarker_heavy','gesture_recognizer','face_landmarker']
mkdirSync(join(work,'bodyguard/frontend/public/models'),{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex')
const resources=names.map(n=>{const name=n+'.task',original=join(cache,'bodyguard/frontend/public/models',name),target=join(work,'bodyguard/frontend/public/models',name);copyFileSync(original,target,constants.COPYFILE_EXCL);const source=sha(readFileSync(original)),copied=sha(readFileSync(target));assert.equal(source,copied);return {name,sha256:source}})
writeFileSync(join(proof,'asset-copy.json'),JSON.stringify({resources},null,2),{flag:'wx'})
