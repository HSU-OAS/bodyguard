import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
const [work, proof, phase] = process.argv.slice(2)
if (!/^\/private\/tmp\/bodyguard-auth-playback-proof\.[A-Za-z0-9]+$/.test(proof)) throw Error('Proof path rejected')
const frontend = path.join(work, 'bodyguard/frontend')
const specs = [
 ['unit', 'node_modules/.bin/vitest', ['run','src/coaching/useRecordedCoaching.test.tsx','--reporter=json','--outputFile='+proof+'/unit-'+phase+'.json']],
 ...(phase.startsWith('red') ? [] : [
 ['frontend','node_modules/.bin/vitest',['run','--reporter=json','--outputFile='+proof+'/frontend-'+phase+'.json']],
 ['types','node_modules/.bin/tsc',['--noEmit']],
 ['biome','node_modules/.bin/biome',['check','.']],
 ['assets','node',['scripts/prepare-assets.mjs']],
 ['build','node_modules/.bin/vite',['build']],
 ['guard','node',['scripts/check-selection-production.mjs']],
 ]),
]
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),phase,results:[]}
for(const [name,cmd,args] of specs){
 const r=spawnSync(cmd,args,{cwd:frontend,maxBuffer:20*1024*1024})
 fs.writeFileSync(proof+'/'+name+'-'+phase+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]))
 receipt.results.push({name,command:[cmd,...args],exit:r.status,signal:r.signal})
 fs.writeFileSync(proof+'/checks-'+phase+'.json',JSON.stringify(receipt,null,2)+'\n')
 console.log(JSON.stringify(receipt.results.at(-1)))
 if(r.status!==0){process.exitCode=r.status??1;break}
}
