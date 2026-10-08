import assert from 'node:assert/strict'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-reference"
const proof="/private/tmp/bodyguard-native-reference-proof.nK3C3o"
const [label,command,...args]=process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(label??''))
assert(!existsSync(proof+'/'+label+'.json'))
const names=()=>execFileSync('git',['ls-files','--cached','--others','--exclude-standard',
 'bodyguard/frontend/src/coaching','bodyguard/frontend/src/avatar/referencePlayback.ts',
 'bodyguard/frontend/e2e/*native*','bodyguard/frontend/e2e/fixtures/native*',
 'bodyguard/frontend/playwright.account.config.ts','bodyguard/backend/tests/run_browser.py',
 'bodyguard/docs/stories/native-reference.md'],{cwd:work,encoding:'utf8'}).trim().split('\n').filter(Boolean)
const hashes=()=>Object.fromEntries([...new Set(names())].map(n=>[n,createHash('sha256').update(readFileSync(work+'/'+n)).digest('hex')]))
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),sourceBefore:hashes(),started:new Date().toISOString(),command,args}
const r=spawnSync(command,args,{cwd:work+'/bodyguard/frontend',env:process.env,maxBuffer:64*1024*1024})
writeFileSync(proof+'/'+label+'.stdout',r.stdout??Buffer.alloc(0),{flag:'wx'})
writeFileSync(proof+'/'+label+'.stderr',r.stderr??Buffer.alloc(0),{flag:'wx'})
Object.assign(receipt,{exit:r.status,signal:r.signal,error:r.error?.code??null,finished:new Date().toISOString(),sourceAfter:hashes()})
writeFileSync(proof+'/'+label+'.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({label,exit:r.status,stdout:r.stdout?.toString().slice(-1800),stderr:r.stderr?.toString().slice(-1000)}))
process.exitCode=r.status??1
