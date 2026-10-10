import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-adaptive-reference",proof="/private/tmp/bodyguard-adaptive-reference-proof.UYNLTU",browser="/private/tmp/bodyguard-native-feedback-proof.rA4Lb7",db="/private/tmp/bodyguard-auth-test.hpGuWj",cache="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-owned-alert-lifecycle"
const hash=b=>createHash('sha256').update(b).digest('hex'),assets=[]
fs.mkdirSync(work+'/bodyguard/frontend/public/models',{recursive:true})
for(const n of fs.readdirSync(cache+'/bodyguard/frontend/public/models').filter(n=>n.endsWith('.task'))){const b=fs.readFileSync(cache+'/bodyguard/frontend/public/models/'+n),dst=work+'/bodyguard/frontend/public/models/'+n;assert(!fs.existsSync(dst));fs.copyFileSync(cache+'/bodyguard/frontend/public/models/'+n,dst,fs.constants.COPYFILE_EXCL);assets.push({name:n,bytes:b.length,sha256:hash(b)})}
for(const gender of ['male','female']){const path='bodyguard/frontend/src/avatar/models/bodyguard-'+gender+'-candidate-a37.glb',b=execFileSync('git',['show','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:'+path],{cwd:work,maxBuffer:35*1024*1024});assert(b.equals(fs.readFileSync('/private/tmp/bodyguard-native-feedback-proof.QfzMIt/'+gender+'.glb')));fs.writeFileSync(browser+'/'+gender+'.glb',b,{flag:'wx'});assets.push({path,bytes:b.length,sha256:hash(b),unchanged:true})}
const authored=fs.readFileSync('/private/tmp/bodyguard-native-feedback-proof.QfzMIt/authored-fixture.json');assert(JSON.parse(authored).fixture_not_release);fs.writeFileSync(browser+'/authored-fixture.json',authored,{flag:'wx'});assets.push({name:'preserved PR81 Blender-memory fixture',bytes:authored.length,sha256:hash(authored),reusedNotReauthored:true})
fs.writeFileSync(proof+'/assets.json',JSON.stringify(assets,null,2),{flag:'wx'})
assert.equal(fs.realpathSync(db),db);assert.equal(fs.statSync(db).uid,process.getuid());assert(!fs.existsSync(db+'/data'))
const bin='/opt/homebrew/opt/postgresql@18/bin/'
for(const[label,command,args]of[
 ['init',bin+'initdb',['-D',db+'/data','--auth=trust','--no-locale','--encoding=UTF8','--username=bodyguard_test']],
 ['start',bin+'pg_ctl',['-D',db+'/data','-l',db+'/postgres.log','-o','-k '+db+" -c listen_addresses='' -p 5432",'-w','start']],
 ['create',bin+'createdb',['-h',db,'-U','bodyguard_test','bodyguard_test']],
 ['identity',bin+'psql',['-h',db,'-U','bodyguard_test','-d','bodyguard_test','-At','-c',"SELECT current_database(),current_user,current_setting('server_version'),current_setting('listen_addresses');"]],
]){const r=spawnSync(command,args,{maxBuffer:5*1024*1024});fs.writeFileSync(proof+'/db-'+label+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'});console.log(JSON.stringify({label,exit:r.status}));if(r.status!==0)process.exit(r.status??1)}
