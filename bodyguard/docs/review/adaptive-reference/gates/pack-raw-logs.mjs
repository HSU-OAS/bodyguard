import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU",root=work+'/bodyguard/docs/review/adaptive-reference'
const diff=spawnSync('git',['diff','--cached','--check'],{cwd:work,maxBuffer:20*1024*1024})
fs.writeFileSync(proof+'/diff-raw-logs.stdout',diff.stdout,{flag:'wx'})
fs.writeFileSync(proof+'/diff-raw-logs.stderr',diff.stderr,{flag:'wx'})
assert.equal(diff.status,2)
const file=root+'/summary.json',summary=JSON.parse(fs.readFileSync(file))
const sha=b=>createHash('sha256').update(b).digest('hex')
const preserved=proof+'/unpacked-raw-logs';fs.mkdirSync(preserved)
let packed=0
for(const row of summary.manifest){
 if(!/\.(stdout|stderr|log)$/.test(row.path))continue
 const original=fs.readFileSync(root+'/'+row.path);assert.equal(sha(original),row.sha256)
 const compressed=gzipSync(original)
 const saved=preserved+'/'+row.path.split('/').at(-1)
 fs.copyFileSync(root+'/'+row.path,saved,fs.constants.COPYFILE_EXCL)
 assert.equal(sha(fs.readFileSync(saved)),row.sha256)
 fs.writeFileSync(root+'/'+row.path+'.gz',compressed,{flag:'wx'})
 assert(gunzipSync(fs.readFileSync(root+'/'+row.path+'.gz')).equals(original))
 // Only newly collected duplicate log files, exact manifest paths, with originals preserved above.
 fs.unlinkSync(root+'/'+row.path)
 Object.assign(row,{path:row.path+'.gz',bytes:compressed.length,sha256:sha(compressed),uncompressedBytes:original.length,uncompressedSha256:sha(original)})
 packed++
}
fs.writeFileSync(file,JSON.stringify(summary,null,2))
const receipt={rawDiffCheckExit:diff.status,rawLogsPacked:packed,originalsPreserved:preserved,files:summary.manifest.length,bytes:summary.manifest.reduce((n,r)=>n+r.bytes,0),whitespaceNotStripped:true}
fs.writeFileSync(proof+'/raw-log-pack.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify(receipt))
