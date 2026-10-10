import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const [db,proof]=process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(db))
assert.equal(fs.realpathSync(db),db)
assert.equal(fs.statSync(db).uid,process.getuid())
assert(!fs.existsSync(db+'/data'))
const bin='/opt/homebrew/opt/postgresql@18/bin/'
const steps=[
 ['init',bin+'initdb',['-D',db+'/data','--auth=trust','--no-locale','--encoding=UTF8','--username=bodyguard_test']],
 ['start',bin+'pg_ctl',['-D',db+'/data','-l',db+'/postgres.log','-o',"-k "+db+" -c listen_addresses='' -p 5432",'-w','start']],
 ['create',bin+'createdb',['-h',db,'-U','bodyguard_test','bodyguard_test']],
 ['identity',bin+'psql',['-h',db,'-U','bodyguard_test','-d','bodyguard_test','-At','-c',"SELECT current_database(),current_user,current_setting('server_version'),current_setting('listen_addresses');"]],
]
for(const [label,command,args]of steps){
 const r=spawnSync(command,args,{maxBuffer:5*1024*1024})
 fs.writeFileSync(proof+'/db-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
 console.log(JSON.stringify({label,exit:r.status}))
 if(r.status!==0)process.exit(r.status??1)
}
