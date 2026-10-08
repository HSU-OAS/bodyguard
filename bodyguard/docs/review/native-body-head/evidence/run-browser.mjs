import fs from 'node:fs'
import path from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const [work,proof,db,python,label]=process.argv.slice(2)
if (!work.endsWith('/BODYGUARD-native-body-head') || !/^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+$/.test(proof)) throw Error('Owned harness required')
if(fs.existsSync(proof+'/browser-'+label+'.log')||fs.existsSync(proof+'/browser-'+label+'-receipt.json')) throw Error('Preserve artifacts')
const env={...process.env,PATH:proof+'/bin:'+path.join(work,'bodyguard/frontend/node_modules/.bin')+':'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db,
 BODYGUARD_TEST_NATIVE_HEAD_PROBE:proof+'/probe'}
delete env.BODYGUARD_TEST_COACHING_AUTH_PROBE
delete env.BODYGUARD_TEST_NATIVE_AUTH_PROBE
delete env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE
const sourceNames=['bodyguard/frontend/src/coaching/nativePlaybackResources.ts','bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts','bodyguard/frontend/e2e/nativehead.spec.ts','bodyguard/frontend/e2e/fixtures/nativeHead.vite.ts','bodyguard/frontend/playwright.account.config.ts','bodyguard/backend/tests/run_browser.py']
const hashes=()=>Object.fromEntries(sourceNames.map(n=>[n,createHash('sha256').update(fs.readFileSync(path.join(work,n))).digest('hex')]))
const before=hashes()
const r=spawnSync(python,['-m','tests.run_browser','nativehead'],{cwd:path.join(work,'bodyguard/backend'),env,maxBuffer:40*1024*1024})
fs.writeFileSync(proof+'/browser-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
const receipt={command:[python,'-m','tests.run_browser','nativehead'],exit:r.status,signal:r.signal,
 head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),sourceBefore:before,sourceAfter:hashes(),
 launcherSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
 actualApiDbAuthProvider:true,productionNativeAdapter:true,nativeBodyFaceSdk:true,nativeBlankInput:true,
 cameraAndMail:'synthetic',heldFaceResult:'test-only-async-wrapper-after-native-result',actualHuman:false,actualPhysicalCamera:false,actualNativePositive:false,productSdkPolicyApproved:false}
fs.writeFileSync(proof+'/browser-'+label+'-receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(receipt));process.exit(r.status??1)
