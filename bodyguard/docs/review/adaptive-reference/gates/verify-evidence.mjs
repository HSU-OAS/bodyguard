import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU",root=work+'/bodyguard/docs/review/adaptive-reference'
const summary=JSON.parse(fs.readFileSync(root+'/summary.json'))
const sha=b=>createHash('sha256').update(b).digest('hex')
for(const row of summary.manifest){
 const b=fs.readFileSync(root+'/'+row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256)
 if(row.uncompressedSha256){const original=gunzipSync(b);assert.equal(original.length,row.uncompressedBytes);assert.equal(sha(original),row.uncompressedSha256)}
 if(row.path.startsWith('source/'))assert(b.equals(execFileSync('git',['show',summary.runtime+':'+row.path.slice(7)],{cwd:work,maxBuffer:64*1024*1024})))
}
let links=0
for(const file of ['bodyguard/docs/review/adaptive-reference/README.md','bodyguard/docs/stories/adaptive-reference.md','bodyguard/docs/tasks.md','bodyguard/docs/stage2-carryover.md']){
 const text=fs.readFileSync(work+'/'+file,'utf8')
 for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1];if(/^(?:https?:|codex:|#)/.test(target))continue
  assert(fs.existsSync(path.resolve(work,path.dirname(file),target.split('#')[0])),file+' '+target);links++
 }
}
const credentials=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/
let scanned=0
for(const row of summary.manifest){
 if(row.path.endsWith('.png'))continue
 let b=fs.readFileSync(root+'/'+row.path);if(row.uncompressedSha256)b=gunzipSync(b)
 assert(!credentials.test(b.toString('utf8')),'Credential format in '+row.path);scanned++
}
const result={manifestFiles:summary.manifest.length,bytesAndShaVerified:true,compressedOriginalVerified:true,runtimeSourceVerified:true,localLinks:links,credentialPatternFiles:scanned,credentialPatternMatches:0,notFullSecurityAudit:true}
fs.writeFileSync(proof+'/evidence-verification.json',JSON.stringify(result,null,2),{flag:'wx'})
console.log(JSON.stringify(result))
