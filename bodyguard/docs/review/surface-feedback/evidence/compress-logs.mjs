import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'

const work='/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-avatar-surface-feedback'
const proof='/private/tmp/bodyguard-surface-feedback-proof.ozUgBj'
const dest=work+'/bodyguard/docs/review/surface-feedback'
const manifestPath=dest+'/summary.json'
const summary=JSON.parse(fs.readFileSync(manifestPath))
const backup=proof+'/raw-logs-before-gzip'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
assert.equal(summary.runtime,'e61870a3983b293f8aa71390b8b5758b27c55c19')
assert(!fs.existsSync(backup))
fs.mkdirSync(backup)
const paths=new Set()
function validate(entry) {
 assert.equal(path.normalize(entry.path),entry.path)
 assert(!path.isAbsolute(entry.path) && !entry.path.startsWith('../'))
 assert(!paths.has(entry.path));paths.add(entry.path)
 const target=dest+'/'+entry.path
 assert(fs.lstatSync(target).isFile())
 const stored=fs.readFileSync(target)
 assert.equal(stored.length,entry.storedBytes);assert.equal(sha(stored),entry.storedSHA256)
 const raw=entry.compressed?gunzipSync(stored):stored
 assert.equal(raw.length,entry.bytes);assert.equal(sha(raw),entry.sha256)
 if(entry.kind==='source') assert(raw.equals(execFileSync('git',['show',entry.commit+':'+entry.gitPath],{cwd:work,maxBuffer:8*1024*1024})))
 return raw
}
for(const entry of summary.files)validate(entry)
let compressed=0
for(const entry of summary.files) {
 if(entry.kind!=='evidence' || entry.compressed || !/\.(?:stdout|stderr|log)$/.test(entry.path))continue
 const original=dest+'/'+entry.path,raw=fs.readFileSync(original),stored=gzipSync(raw)
 assert(gunzipSync(stored).equals(raw))
 assert(!fs.existsSync(original+'.gz'))
 fs.writeFileSync(original+'.gz',stored,{flag:'wx'})
 const preserved=backup+'/'+entry.path
 fs.mkdirSync(path.dirname(preserved),{recursive:true});assert(!fs.existsSync(preserved))
 fs.renameSync(original,preserved)
 assert(fs.readFileSync(preserved).equals(raw))
 Object.assign(entry,{path:entry.path+'.gz',compressed:true,storedBytes:stored.length,storedSHA256:sha(stored)})
 compressed++
}
for(const name of ['evidence-diff-first.json','evidence-diff-first.stdout','evidence-diff-first.stderr','compress-logs.mjs']) {
 const raw=fs.readFileSync(proof+'/'+name),compressed=/\.(?:stdout|stderr)$/.test(name),stored=compressed?gzipSync(raw):raw,target='evidence/'+name+(compressed?'.gz':'')
 assert(!fs.existsSync(dest+'/'+target))
 fs.writeFileSync(dest+'/'+target,stored,{flag:'wx'})
 summary.files.push({path:target,kind:'evidence',bytes:raw.length,sha256:sha(raw),storedBytes:stored.length,storedSHA256:sha(stored),compressed})
}
const diff=JSON.parse(fs.readFileSync(proof+'/evidence-diff-first.json'))
assert.equal(diff.exit,2);assert.deepEqual(diff.sourceBefore,diff.sourceAfter)
summary.collectionNote='Collection output and later commit/PR/merge receipts are not part of this manifest. The first staged whitespace failure and byte-preserving log compression are included. Initial uncommitted source snapshots are incomplete.'
paths.clear();for(const entry of summary.files)validate(entry)
fs.copyFileSync(manifestPath,backup+'/summary-before-gzip.json',fs.constants.COPYFILE_EXCL)
fs.writeFileSync(manifestPath,JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({compressed,files:summary.files.length,storedBytes:summary.files.reduce((total,f)=>total+f.storedBytes,0),rawHashesPreserved:true,gitSourceVerified:true,backup}))
