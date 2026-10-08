import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gunzipSync,gzipSync} from 'node:zlib'
const work='/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-avatar-surface-feedback'
const proof='/private/tmp/bodyguard-surface-feedback-proof.ozUgBj',dest=work+'/bodyguard/docs/review/surface-feedback'
const sha=b=>createHash('sha256').update(b).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:8*1024*1024})
const summary=JSON.parse(fs.readFileSync(dest+'/summary.json'))
if(process.argv.includes('--append-failures')) {
 for(const name of ['stage-evidence-fixed.json','stage-evidence-fixed.stdout','stage-evidence-fixed.stderr','evidence-diff-fixed.json','evidence-diff-fixed.stdout','evidence-diff-fixed.stderr','verify-evidence.mjs']) {
  const raw=fs.readFileSync(proof+'/'+name),compressed=!name.endsWith('.mjs'),stored=compressed?gzipSync(raw):raw,target='evidence/'+name+(compressed?'.gz':'')
  assert(!summary.files.some(f=>f.path===target));assert(!fs.existsSync(dest+'/'+target))
  fs.writeFileSync(dest+'/'+target,stored,{flag:'wx'});summary.files.push({path:target,kind:'evidence',bytes:raw.length,sha256:sha(raw),storedBytes:stored.length,storedSHA256:sha(stored),compressed})
 }
 fs.copyFileSync(dest+'/summary.json',proof+'/summary-before-append.json',fs.constants.COPYFILE_EXCL)
 fs.writeFileSync(dest+'/summary.json',JSON.stringify(summary,null,2)+'\n')
}
const names=new Set()
for(const entry of summary.files) {
 assert.equal(path.normalize(entry.path),entry.path);assert(!path.isAbsolute(entry.path)&&!entry.path.startsWith('../'));assert(!names.has(entry.path));names.add(entry.path)
 const stored=fs.readFileSync(dest+'/'+entry.path),raw=entry.compressed?gunzipSync(stored):stored
 assert.equal(stored.length,entry.storedBytes);assert.equal(sha(stored),entry.storedSHA256);assert.equal(raw.length,entry.bytes);assert.equal(sha(raw),entry.sha256)
 if(entry.kind==='source') {
  assert.equal(entry.commit,summary.runtime);assert(raw.equals(git('show',entry.commit+':'+entry.gitPath)))
  if(!entry.gitPath.startsWith('bodyguard/docs/'))assert(raw.equals(fs.readFileSync(work+'/'+entry.gitPath)))
 }
}
const expected=git('diff','--name-only','-z',summary.baseline+'..'+summary.runtime).toString().split('\0').filter(Boolean).sort()
assert.deepEqual(summary.files.filter(f=>f.kind==='source').map(f=>f.gitPath).sort(),expected)
assert.equal(summary.actualWebGL,true);assert.equal(summary.actualCamera,false);assert.equal(summary.actualSDK,false);assert.equal(summary.allStagesComplete,false)
for(const label of ['committed-all-tests','committed-types-final','committed-biome-final','committed-prepare-final','committed-public-build-final','committed-guard-final','committed-diff-final','probe-build-committed','browser-exec-committed','guard-restored']) {
 const receipt=JSON.parse(fs.readFileSync(proof+'/'+label+'.json'));assert.equal(receipt.head,summary.runtime);assert.equal(receipt.exit,0);assert.deepEqual(receipt.sourceBefore,receipt.sourceAfter)
 for(const [name,hash]of Object.entries(receipt.sourceAfter))if(!name.startsWith('bodyguard/docs/'))assert.equal(sha(fs.readFileSync(work+'/'+name)),hash)
}
const report=JSON.parse(fs.readFileSync(proof+'/browser-committed.json'));assert.equal(report.head,summary.runtime);assert.equal(report.samples.length,2);assert(report.samples.every(s=>s.passed));assert.deepEqual(report.sourceBefore,report.sourceAfter)
for(const entry of summary.publicAssets)assert.equal(sha(fs.readFileSync(work+'/bodyguard/frontend/dist/assets/'+entry.name)),entry.sha256)
const forbiddenChanges=git('diff','--name-only',summary.baseline,'--','.github','docs','bodyguard/backend','bodyguard/assets').toString().trim();assert.equal(forbiddenChanges,'')
console.log(JSON.stringify({files:summary.files.length,source:expected.length,sourceUnchanged:true,actualWebGL:2,syntheticObservation:true,actualCamera:false,actualSDK:false,publicBytesUnchanged:true,rawHashesVerified:true,allStagesComplete:false}))
