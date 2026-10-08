import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-feedback",proof="/private/tmp/bodyguard-native-feedback-proof.QfzMIt",dest=work+'/bodyguard/docs/review/native-feedback'
const sha=b=>createHash('sha256').update(b).digest('hex')
const summary=JSON.parse(fs.readFileSync(dest+'/summary.json')),names=new Set()
for(const f of summary.files){
 assert.equal(path.normalize(f.path),f.path);assert(!path.isAbsolute(f.path)&&!f.path.startsWith('../'));assert(!names.has(f.path));names.add(f.path)
 const stored=fs.readFileSync(dest+'/'+f.path),raw=f.path.endsWith('.gz')?gunzipSync(stored):stored
 assert.equal(stored.length,f.bytes);assert.equal(sha(stored),f.sha256)
 assert.equal(raw.length,f.originalBytes);assert.equal(sha(raw),f.originalSha256)
 if(f.kind==='source'){
  assert.equal(f.commit,summary.runtime)
  const original=execFileSync('git',['show',f.commit+':'+f.sourcePath],{cwd:work,maxBuffer:8*1024*1024})
  assert(raw.equals(original));if(!f.sourcePath.startsWith('bodyguard/docs/'))assert(raw.equals(fs.readFileSync(work+'/'+f.sourcePath)))
 }
}
for(const label of ['unit','types','biome','assets','build','guard','ruff','diff']){
 const r=JSON.parse(fs.readFileSync(proof+'/'+label+'-committed.json'));assert.equal(r.exit,0);assert.equal(r.head,summary.runtime);assert.deepEqual(r.sourceBefore,r.sourceAfter)
 for(const[n,h]of Object.entries(r.sourceAfter))if(!n.startsWith('bodyguard/docs/'))assert.equal(sha(fs.readFileSync(work+'/'+n)),h)
}
for(const label of ['committed','control']){
 const r=JSON.parse(fs.readFileSync(proof+'/browser-'+label+'.json'));assert.equal(r.exit,0);assert.deepEqual(r.sourceBefore,r.sourceAfter)
 if(label==='committed')assert.equal(r.head,summary.runtime)
 for(const[n,h]of Object.entries(r.sourceAfter))assert.equal(sha(fs.readFileSync(work+'/'+n)),h)
}
for(const b of summary.binaries)assert.equal(sha(fs.readFileSync(b.preservedAt)),b.sha256)
for(const b of summary.publicAssets)assert.equal(sha(fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+b.name)),b.sha256)
assert.equal(summary.qualifiedReleaseMotions,0);assert.equal(summary.actualPhysicalCamera,false);assert.equal(summary.finalAvatarApproved,false)
const diff=execFileSync('git',['diff','--name-only',summary.baseline,'--','.github','docs','bodyguard/assets','bodyguard/frontend/src/avatar/models','bodyguard/backend/app','bodyguard/backend/alembic'],{cwd:work,encoding:'utf8'}).trim();assert.equal(diff,'')
console.log(JSON.stringify({files:summary.files.length,sourceCount:summary.sourceCount,sourceEqual:true,rawHashesVerified:true,publicBytesEqual:true,allStagesComplete:false}))
