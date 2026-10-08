import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-avatar-surface-feedback",proof="/private/tmp/bodyguard-surface-feedback-proof.ozUgBj",cache="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-owned-alert-lifecycle"
const sha=b=>createHash('sha256').update(b).digest('hex'),receipt=[]
for(const gender of ['male','female']){const name='bodyguard/frontend/src/avatar/models/bodyguard-'+gender+'-candidate-a37.glb',b=execFileSync('git',['show','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:'+name],{cwd:work,maxBuffer:32*1024*1024});assert(readFileSync('/private/tmp/bodyguard-native-reference-proof.nK3C3o/'+gender+'.glb').equals(b));writeFileSync(proof+'/'+gender+'.glb',b,{flag:'wx'});receipt.push({name,sha256:sha(b),bytes:b.length,unchanged:true})}
mkdirSync(work+'/bodyguard/frontend/public/models',{recursive:true})
const models=readdirSync(cache+'/bodyguard/frontend/public/models').filter(name=>name.endsWith('.task'));assert.equal(models.length,5)
for(const name of models){const b=readFileSync(cache+'/bodyguard/frontend/public/models/'+name),dst=work+'/bodyguard/frontend/public/models/'+name;if(existsSync(dst))assert(readFileSync(dst).equals(b));else writeFileSync(dst,b,{flag:'wx'});receipt.push({name,sha256:sha(b),bytes:b.length})}
writeFileSync(proof+'/assets.json',JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt))
