import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const work='/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-feedback',proof='/private/tmp/bodyguard-native-feedback-proof.QfzMIt',base='/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-owned-alert-lifecycle'
const hash=b=>createHash('sha256').update(b).digest('hex'),receipt=[]
mkdirSync(work+'/bodyguard/frontend/public/models',{recursive:true})
const models=readdirSync(base+'/bodyguard/frontend/public/models').filter(n=>n.endsWith('.task')).sort();assert.equal(models.length,5)
for(const n of models){const b=readFileSync(base+'/bodyguard/frontend/public/models/'+n),dst=work+'/bodyguard/frontend/public/models/'+n;if(existsSync(dst))assert(readFileSync(dst).equals(b));else writeFileSync(dst,b,{flag:'wx'});receipt.push({name:n,bytes:b.length,sha256:hash(b)})}
for(const gender of ['male','female']){const gitPath='bodyguard/frontend/src/avatar/models/bodyguard-'+gender+'-candidate-a37.glb',b=execFileSync('git',['show','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:'+gitPath],{cwd:work,maxBuffer:35*1024*1024});assert(readFileSync('/private/tmp/bodyguard-native-reference-proof.nK3C3o/'+gender+'.glb').equals(b));writeFileSync(proof+'/'+gender+'.glb',b,{flag:'wx'});receipt.push({gitPath,bytes:b.length,sha256:hash(b),unchanged:true})}
const b=readFileSync('/private/tmp/bodyguard-native-reference-proof.nK3C3o/authored-fixture.json');assert(JSON.parse(b).fixture_not_release);writeFileSync(proof+'/authored-fixture.json',b,{flag:'wx'});receipt.push({path:'preserved PR81 authored fixture',bytes:b.length,sha256:hash(b),reusedNotReauthored:true})
writeFileSync(proof+'/assets.json',JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify({sdkModels:5,glbs:2,blenderRun:false,assetReexport:false,unchanged:true}))
