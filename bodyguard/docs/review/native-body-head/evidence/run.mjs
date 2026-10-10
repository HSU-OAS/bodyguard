import {spawn,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const [label,cwd,command,...args]=process.argv.slice(2)
if(!/^[a-z][a-z0-9-]*$/.test(label??'')||!cwd||!command)throw new Error('Invalid run')
const receipt=join(new URL('.',import.meta.url).pathname,label+'.json')
if(existsSync(receipt))throw new Error('Evidence exists')
const names=['src/coaching/nativePlaybackResources.ts','src/coaching/nativePlaybackResources.test.ts','src/avatar/headOrientationRig.ts','src/avatar/observedPoseRig.ts','src/avatar/ownedAvatarPair.ts','src/pose/bodyFaceVideoSource.ts','e2e/fixtures/nativeHeadAuthProbe.ts','e2e/nativehead.spec.ts','playwright.account.config.ts','scripts/check-selection-production.mjs']
const hashes=()=>Object.fromEntries(names.map(n=>[n,existsSync(join(cwd,n))?createHash('sha256').update(readFileSync(join(cwd,n))).digest('hex'):null]))
const before=hashes(),head=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),start=Date.now()
const child=spawn(command,args,{cwd,env:process.env,stdio:['ignore','pipe','pipe']})
let stdout='',stderr=''
child.stdout.on('data',b=>{stdout+=b;process.stdout.write(b)})
child.stderr.on('data',b=>{stderr+=b;process.stderr.write(b)})
child.on('error',e=>{stderr+=e.name})
child.on('close',exit=>{writeFileSync(receipt,JSON.stringify({label,cwd,head,command,args,exit,elapsedMs:Date.now()-start,sourceBefore:before,sourceAfter:hashes(),stdout,stderr},null,2),{flag:'wx'});process.exitCode=exit??1})
