import assert from 'node:assert/strict'
import {spawnSync,execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync,readdirSync,cpSync} from 'node:fs'
import {createHash} from 'node:crypto'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-reference",proof="/private/tmp/bodyguard-native-reference-proof.nK3C3o",db="/private/tmp/bodyguard-auth-test.qBT4Tf",python="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-account-web/bodyguard/backend/.venv/bin/python"
const[label,suite='nativereference']=process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(label??''));assert(['nativereference','nativehead','nativehands'].includes(suite))
assert(!existsSync(proof+'/browser-'+label+'.json'))
const env={...process.env,PATH:proof+'/bin:'+work+'/bodyguard/frontend/node_modules/.bin:'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db}
for(const key of ['BODYGUARD_TEST_COACHING_AUTH_PROBE','BODYGUARD_TEST_NATIVE_AUTH_PROBE','BODYGUARD_TEST_NATIVE_RECOVERY_PROBE','BODYGUARD_TEST_NATIVE_HEAD_PROBE','BODYGUARD_TEST_NATIVE_HANDS_PROBE','BODYGUARD_TEST_NATIVE_REFERENCE_PROBE'])delete env[key]
if(suite==='nativereference') env.BODYGUARD_TEST_NATIVE_REFERENCE_PROBE=proof+'/probe-'+label
else env[suite==='nativehands'?'BODYGUARD_TEST_NATIVE_HANDS_PROBE':'BODYGUARD_TEST_NATIVE_HEAD_PROBE']=suite==='nativehands'?'/private/tmp/bodyguard-native-hands-proof.iLR5n9/probe':'/private/tmp/bodyguard-native-body-head-proof.kQhhIy/probe'
const names=['bodyguard/frontend/src/coaching/nativePlaybackResources.ts','bodyguard/frontend/src/coaching/ownedPlaybackResources.ts','bodyguard/frontend/src/avatar/referencePlayback.ts','bodyguard/frontend/src/avatar/ownedAvatarPair.ts','bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts','bodyguard/frontend/e2e/fixtures/nativeReferenceProgram.ts','bodyguard/frontend/e2e/nativehead.spec.ts','bodyguard/frontend/e2e/nativereference.spec.ts','bodyguard/frontend/e2e/fixtures/nativeHead.vite.ts','bodyguard/frontend/playwright.account.config.ts','bodyguard/backend/tests/run_browser.py']
const hashes=()=>Object.fromEntries(names.map(n=>[n,createHash('sha256').update(readFileSync(work+'/'+n)).digest('hex')]))
const output=work+'/bodyguard/frontend/test-results',before=new Set(existsSync(output)?readdirSync(output):[])
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),sourceBefore:hashes(),started:new Date().toISOString(),suite,
 actualApiDbAuthProvider:true,actualSdk:true,fakeCamera:true,fakeMail:true,syntheticMotionObservations:suite==='nativereference',actualHuman:false,actualPhysicalCamera:false,productSdkEgressApproved:false}
const r=spawnSync(python,['-m','tests.run_browser',suite],{cwd:work+'/bodyguard/backend',env,maxBuffer:64*1024*1024})
writeFileSync(proof+'/browser-'+label+'.stdout',r.stdout??Buffer.alloc(0),{flag:'wx'})
writeFileSync(proof+'/browser-'+label+'.stderr',r.stderr??Buffer.alloc(0),{flag:'wx'})
Object.assign(receipt,{exit:r.status,signal:r.signal,finished:new Date().toISOString(),sourceAfter:hashes(),outputs:[]})
if(existsSync(output)) for(const n of readdirSync(output)){if(!before.has(n)&&n.startsWith(suite+'-')){cpSync(output+'/'+n,proof+'/browser-'+label+'-outputs/'+n,{recursive:true,errorOnExist:true,force:false});receipt.outputs.push(n)}}
writeFileSync(proof+'/browser-'+label+'.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({label,suite,exit:r.status,outputs:receipt.outputs,stdout:r.stdout?.toString().slice(-2500),stderr:r.stderr?.toString().slice(-1000)}))
process.exitCode=r.status??1
