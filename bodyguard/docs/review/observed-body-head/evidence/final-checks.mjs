import {spawnSync,execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const [work,proof,prefix='final']=process.argv.slice(2),frontend=path.join(work,'bodyguard/frontend')
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),results:[]}
const specs=[
 ['unit-final','./node_modules/.bin/vitest',['run','--reporter=json','--outputFile='+proof+'/frontend-'+prefix+'.json']],
 ['assets-final','node',['scripts/prepare-assets.mjs']],
 ['types-final','./node_modules/.bin/tsc',['--noEmit']],
 ['biome-final','./node_modules/.bin/biome',['check','.']],
 ['build-final','./node_modules/.bin/vite',['build']],
 ['guard-final','node',['scripts/check-selection-production.mjs']],
 ['diff-final','git',['diff','--check']],
]
for(const[originalLabel,cmd,args]of specs){const label=originalLabel.replace(/final$/,prefix);const r=spawnSync('node',[proof+'/run.mjs',label,frontend,cmd,...args],{maxBuffer:20*1024*1024});receipt.results.push({label,exit:r.status});fs.writeFileSync(proof+'/final-checks-'+prefix+'.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt.results.at(-1)));if(r.status!==0){process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');process.exitCode=1;break}}

