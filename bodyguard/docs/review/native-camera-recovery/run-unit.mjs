import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const[work,proof,label]=process.argv.slice(2)
const r=spawnSync('node_modules/.bin/vitest',['run','src/coaching/nativePlaybackResources.test.ts','--reporter=json','--outputFile='+proof+'/unit-'+label+'.json'],{cwd:work+'/bodyguard/frontend',maxBuffer:20*1024*1024})
fs.writeFileSync(proof+'/unit-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
console.log(JSON.stringify({exit:r.status,signal:r.signal}));process.exit(r.status??1)
