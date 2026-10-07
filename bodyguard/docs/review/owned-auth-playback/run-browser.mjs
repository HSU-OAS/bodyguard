import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const [work,proof,db,probe,python,label]=process.argv.slice(2)
const env={...process.env,
 PATH:proof+'/bin:'+path.join(work,'bodyguard/frontend/node_modules/.bin')+':'+process.env.PATH,
 BODYGUARD_TEST_DATABASE_URL:'postgresql+psycopg://bodyguard_test@/bodyguard_test?host='+db,
 BODYGUARD_TEST_COACHING_AUTH_PROBE:probe+'/browser-probe',
}
const r=spawnSync(python,['-m','tests.run_browser','authcoaching'],{cwd:path.join(work,'bodyguard/backend'),env,maxBuffer:20*1024*1024})
fs.writeFileSync(proof+'/browser-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]))
const receipt={command:[python,'-m','tests.run_browser','authcoaching'],exit:r.status,signal:r.signal,
 portsAndClocks:'synthetic', actualApiDbAuthProvider:true, nativeSdkOrGlb:false}
fs.writeFileSync(proof+'/browser-'+label+'-receipt.json',JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt))
process.exit(r.status??1)
