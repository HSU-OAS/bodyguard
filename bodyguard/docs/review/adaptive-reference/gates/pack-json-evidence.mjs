import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
const root="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference/bodyguard/docs/review/adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU"
const summary=JSON.parse(fs.readFileSync(root+'/summary.json'))
const sha=b=>createHash('sha256').update(b).digest('hex')
const originals=proof+'/unpacked-json-evidence';fs.mkdirSync(originals)
let packed=0
for(const row of summary.manifest){
 if(!row.path.startsWith('evidence/')||!row.path.endsWith('.json')||['evidence/flow.json','evidence/production.json'].includes(row.path))continue
 const b=fs.readFileSync(root+'/'+row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256)
 const saved=originals+'/'+packed+'.json';fs.copyFileSync(root+'/'+row.path,saved,fs.constants.COPYFILE_EXCL)
 assert(fs.readFileSync(saved).equals(b))
 const compressed=gzipSync(b);fs.writeFileSync(root+'/'+row.path+'.gz',compressed,{flag:'wx'})
 assert(gunzipSync(fs.readFileSync(root+'/'+row.path+'.gz')).equals(b))
 fs.unlinkSync(root+'/'+row.path)
 Object.assign(row,{path:row.path+'.gz',bytes:compressed.length,sha256:sha(compressed),uncompressedBytes:b.length,uncompressedSha256:sha(b)})
 packed++
}
fs.writeFileSync(root+'/summary.json',JSON.stringify(summary,null,2))
const receipt={packedJson:packed,files:summary.manifest.length,bytes:summary.manifest.reduce((n,r)=>n+r.bytes,0),originalsPreserved:originals,notEditedOriginal:true}
fs.writeFileSync(proof+'/json-pack.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify(receipt))
