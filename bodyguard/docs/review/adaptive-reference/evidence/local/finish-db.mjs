import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const db="/private/tmp/bodyguard-auth-test.hpGuWj",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU"
assert.equal(fs.realpathSync(db),db);assert.equal(fs.statSync(db).uid,process.getuid())
const pid=fs.readFileSync(db+'/data/postmaster.pid','utf8').split('\n')
assert.equal(pid[1],db+'/data');assert.equal(pid[4],db)
const result=spawnSync('/opt/homebrew/opt/postgresql@18/bin/pg_ctl',['-D',db+'/data','-m','fast','-w','stop'],{maxBuffer:5*1024*1024})
fs.writeFileSync(proof+'/db-stop.stdout',result.stdout??Buffer.alloc(0),{flag:'wx'})
fs.writeFileSync(proof+'/db-stop.stderr',result.stderr??Buffer.alloc(0),{flag:'wx'})
fs.writeFileSync(proof+'/db-stop.json',JSON.stringify({ownedData:db+'/data',exit:result.status,signal:result.signal,dataPreserved:fs.existsSync(db+'/data/PG_VERSION'),pidFileRemaining:fs.existsSync(db+'/data/postmaster.pid')}),{flag:'wx'})
console.log(result.stdout?.toString());process.exitCode=result.status??1
