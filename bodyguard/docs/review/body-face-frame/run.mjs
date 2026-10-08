import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const [label,cwd,command,...args]=process.argv.slice(2)
if(!/^[a-z][a-z0-9-]*$/.test(label)||!cwd||!command)throw new Error('Invalid run')
const path=join(new URL('.',import.meta.url).pathname,label+'.json')
if(existsSync(path))throw new Error('Evidence exists')
const names=['src/pose/bodyFaceVideoSource.ts','src/pose/bodyFaceVideoSource.test.ts','src/pose/ownedPoseFrame.ts','src/pose/videoPoseSource.ts','src/avatar/observedPoseRig.ts','e2e/fixtures/bodyFaceFrameProbe.ts','scripts/test-body-face-browser.mjs']
const hashes=()=>Object.fromEntries(names.map(n=>[n,existsSync(join(cwd,n))?createHash('sha256').update(readFileSync(join(cwd,n))).digest('hex'):null]))
const before=hashes(),start=Date.now(),child=spawn(command,args,{cwd,env:process.env,stdio:['ignore','pipe','pipe']})
let stdout='',stderr=''
child.stdout.on('data',b=>{stdout+=b;process.stdout.write(b)})
child.stderr.on('data',b=>{stderr+=b;process.stderr.write(b)})
child.on('error',e=>{stderr+=e.name})
child.on('close',exit=>{writeFileSync(path,JSON.stringify({label,cwd,command,args,exit,elapsedMs:Date.now()-start,sourceBefore:before,sourceAfter:hashes(),stdout,stderr},null,2),{flag:'wx'});process.exitCode=exit??1})
