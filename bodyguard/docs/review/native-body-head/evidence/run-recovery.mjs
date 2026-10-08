import fs from 'node:fs'
import path from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const [work,proof,db,python,probe,label]=process.argv.slice(2)
if (!work.endsWith('/BODYGUARD-native-body-head') || !/^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+$/.test(probe)) throw Error('Owned recovery probe required')
const file=proof+'/browser-recovery-'+label
if(fs.existsSync(file+'.log')||fs.existsSync(file+'-receipt.json'))throw Error('Preserve artifacts')
const env={...process.env,PATH:proof+'/bin:'+path.join(work,'bodyguard/frontend/node_modules/.bin')+':'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db,
 BODYGUARD_TEST_NATIVE_RECOVERY_PROBE:probe+'/probe'}
delete env.BODYGUARD_TEST_NATIVE_AUTH_PROBE
delete env.BODYGUARD_TEST_NATIVE_HEAD_PROBE
delete env.BODYGUARD_TEST_COACHING_AUTH_PROBE
const filename=path.join(work,'bodyguard/frontend/src/coaching/nativePlaybackResources.ts'), hash=()=>createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), before=hash()
const r=spawnSync(python,['-m','tests.run_browser','nativerecovery'],{cwd:path.join(work,'bodyguard/backend'),env,maxBuffer:40*1024*1024})
fs.writeFileSync(file+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
const receipt={command:[python,'-m','tests.run_browser','nativerecovery'],exit:r.status,signal:r.signal,
 head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),nativeAdapterBefore:before,nativeAdapterAfter:hash(),
 actualApiDbAuthProvider:true,productionNativeAdapter:true,headEnabled:false,
 cameraPermissionEventsAndMail:'synthetic',actualHuman:false,actualPhysicalCamera:false,actualUnplug:false,productSdkPolicyApproved:false}
fs.writeFileSync(file+'-receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));process.exit(r.status??1)
