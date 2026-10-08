import assert from 'node:assert/strict'
import {spawnSync,execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync,readdirSync,cpSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU",browser="/private/tmp/bodyguard-native-feedback-proof.rA4Lb7",db="/private/tmp/bodyguard-auth-test.hpGuWj"
const python="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-account-web/bodyguard/backend/.venv/bin/python"
const[label]=process.argv.slice(2),suite='nativefeedback'
assert(/^[a-z][a-z0-9-]*$/.test(label??''));assert(!existsSync(proof+'/browser-'+label+'.json'))
const env={...process.env,PATH:proof+'/bin:'+work+'/bodyguard/frontend/node_modules/.bin:'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db}
for(const key of Object.keys(env))if(key.endsWith('_PROBE'))delete env[key]
env.BODYGUARD_TEST_NATIVE_FEEDBACK_PROBE=browser+'/probe-'+label
assert(!existsSync(env.BODYGUARD_TEST_NATIVE_FEEDBACK_PROBE))
const git=(...args)=>execFileSync('git',args,{cwd:work,encoding:'utf8'})
const hashes=()=>Object.fromEntries(git('ls-files','-z','--cached','--others','--exclude-standard','bodyguard/frontend/src/avatar','bodyguard/frontend/src/coaching','bodyguard/frontend/e2e','bodyguard/backend/tests/run_browser.py').split('\0').filter(Boolean).map(n=>[n,createHash('sha256').update(readFileSync(work+'/'+n)).digest('hex')]))
const output=work+'/bodyguard/frontend/test-results',before=new Set(existsSync(output)?readdirSync(output):[])
const receipt={head:git('rev-parse','HEAD').trim(),sourceBefore:hashes(),started:new Date().toISOString(),suite,actualApiDbAuthProvider:true,actualSdk:true,fakeCamera:true,fakeMail:true,syntheticBodyResultReplacement:true,actualHuman:false,actualPhysicalCamera:false,productSdkEgressApproved:false}
writeFileSync(proof+'/browser-'+label+'-before.json',JSON.stringify(receipt,null,2),{flag:'wx'})
const r=spawnSync(python,['-m','tests.run_browser',suite],{cwd:work+'/bodyguard/backend',env,maxBuffer:64*1024*1024})
writeFileSync(proof+'/browser-'+label+'.stdout',r.stdout??Buffer.alloc(0),{flag:'wx'});writeFileSync(proof+'/browser-'+label+'.stderr',r.stderr??Buffer.alloc(0),{flag:'wx'})
Object.assign(receipt,{exit:r.status,signal:r.signal,finished:new Date().toISOString(),sourceAfter:hashes(),outputs:[]})
if(existsSync(output))for(const n of readdirSync(output)){if(!before.has(n)&&n.startsWith(suite+'-')){cpSync(output+'/'+n,proof+'/browser-'+label+'-outputs/'+n,{recursive:true,errorOnExist:true,force:false});receipt.outputs.push(n)}}
writeFileSync(proof+'/browser-'+label+'.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({label,suite,exit:r.status,outputs:receipt.outputs,stdout:r.stdout?.toString().slice(-3500),stderr:r.stderr?.toString().slice(-1200)}));process.exitCode=r.status??1
