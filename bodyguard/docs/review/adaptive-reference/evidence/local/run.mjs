import assert from 'node:assert/strict'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU"
const [label,command,...args]=process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(label??''));assert(!existsSync(proof+'/'+label+'.json'))
assert(!args.includes('--outputFile='+proof+'/'+label+'.json'),'Reporter and receipt paths must differ')
const git=(...args)=>execFileSync('git',args,{cwd:work,encoding:'utf8'})
const hashes=()=>Object.fromEntries(git('ls-files','-z','--cached','--others','--exclude-standard','bodyguard/frontend/src/avatar','bodyguard/frontend/src/coaching','bodyguard/frontend/e2e','bodyguard/docs/stories/adaptive-reference.md').split('\0').filter(Boolean).map(name=>[name,createHash('sha256').update(readFileSync(work+'/'+name)).digest('hex')]))
const receipt={head:git('rev-parse','HEAD').trim(),sourceBefore:hashes(),started:new Date().toISOString(),command,args}
const result=spawnSync(command,args,{cwd:work+'/bodyguard/frontend',env:process.env,maxBuffer:64*1024*1024})
writeFileSync(proof+'/'+label+'.stdout',result.stdout??Buffer.alloc(0),{flag:'wx'});writeFileSync(proof+'/'+label+'.stderr',result.stderr??Buffer.alloc(0),{flag:'wx'})
Object.assign(receipt,{exit:result.status,signal:result.signal,error:result.error?.code??null,finished:new Date().toISOString(),sourceAfter:hashes()})
writeFileSync(proof+'/'+label+'.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({label,exit:result.status,stdout:result.stdout?.toString().slice(-1400),stderr:result.stderr?.toString().slice(-1400)}));process.exitCode=result.status??1
