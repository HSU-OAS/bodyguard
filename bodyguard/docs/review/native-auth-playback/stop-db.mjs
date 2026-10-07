import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const [db,proof]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(db))
assert.equal(fs.realpathSync(db),db);assert.equal(fs.statSync(db).uid,process.getuid())
const r=spawnSync('/opt/homebrew/opt/postgresql@18/bin/pg_ctl',['-D',db+'/data','-m','fast','-w','stop'],{maxBuffer:2*1024*1024})
fs.writeFileSync(proof+'/db-stop.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
fs.writeFileSync(proof+'/db-stop-receipt.json',JSON.stringify({exit:r.status,signal:r.signal,testOnly:true,dataPreserved:true},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({exit:r.status,dataPreserved:true}));process.exit(r.status??1)
