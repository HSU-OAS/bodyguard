import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const [work,proof,db,python,suite,label,probe]=process.argv.slice(2)
if(fs.existsSync(proof+'/browser-'+label+'.log')||fs.existsSync(proof+'/browser-'+label+'-receipt.json'))
 throw Error('Preserve prior browser artifacts: unique label required')
const env={...process.env,PATH:proof+'/bin:'+path.join(work,'bodyguard/frontend/node_modules/.bin')+':'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db}
delete env.BODYGUARD_TEST_COACHING_AUTH_PROBE
delete env.BODYGUARD_TEST_NATIVE_AUTH_PROBE
if(suite==='nativeauth')env.BODYGUARD_TEST_NATIVE_AUTH_PROBE=proof+'/probe'
else if(suite==='authcoaching')env.BODYGUARD_TEST_COACHING_AUTH_PROBE=probe+'/browser-probe'
else throw Error('Unexpected suite')
const r=spawnSync(python,['-m','tests.run_browser',suite],{cwd:path.join(work,'bodyguard/backend'),env,maxBuffer:40*1024*1024})
fs.writeFileSync(proof+'/browser-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
const receipt={command:[python,'-m','tests.run_browser',suite],exit:r.status,signal:r.signal,
 actualApiDbAuthProvider:true,nativeSdkOrGlb:suite==='nativeauth',cameraAndMail:'synthetic',actualHuman:false}
fs.writeFileSync(proof+'/browser-'+label+'-receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(receipt))
process.exit(r.status??1)
