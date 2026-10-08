import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),work=path.resolve(root,'../../../..')
const summary=JSON.parse(fs.readFileSync(root+'/summary.json')),sha=b=>createHash('sha256').update(b).digest('hex')
let scanned=0,links=0
const credentials=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/
for(const row of summary.manifest){
 const file=path.resolve(root,row.path);assert(file.startsWith(root+'/'));assert.equal(fs.realpathSync(file),file)
 let b=fs.readFileSync(file);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256)
 if(row.uncompressedSha256){b=gunzipSync(b,{maxOutputLength:32*1024*1024});assert.equal(b.length,row.uncompressedBytes);assert.equal(sha(b),row.uncompressedSha256)}
 if(row.path.startsWith('source/'))assert(b.equals(execFileSync('git',['show',summary.runtime+':'+row.path.slice(7)],{cwd:work,maxBuffer:16*1024*1024})))
 assert(!credentials.test(b.toString('utf8')),row.path+' credential pattern');scanned++
}
for(const n of ['bodyguard/docs/review/native-startup-timing/README.md','bodyguard/docs/stories/native-startup-timing.md','bodyguard/docs/tasks.md','bodyguard/docs/stage2-carryover.md']){
 for(const m of fs.readFileSync(work+'/'+n,'utf8').matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  if(/^(?:https?:|codex:|#)/.test(m[1]))continue
  assert(fs.existsSync(path.resolve(work,path.dirname(n),m[1].split('#')[0])),n+' '+m[1]);links++
 }
}
const out={runtime:summary.runtime,manifestFiles:summary.manifest.length,bytesAndShaVerified:true,compressedOriginalVerified:true,runtimeSourceVerified:true,credentialPatternFiles:scanned,credentialPatternMatches:0,notFullSecurityAudit:true,localLinks:links}
console.log(JSON.stringify(out))
