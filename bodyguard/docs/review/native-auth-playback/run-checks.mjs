import fs from 'node:fs'
import path from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'
const [work,proof,phase,python]=process.argv.slice(2)
const frontend=path.join(work,'bodyguard/frontend')
const specs=[
 ['frontend','node_modules/.bin/vitest',['run','--reporter=json','--outputFile='+proof+'/frontend-'+phase+'.json'],frontend],
 ['types','node_modules/.bin/tsc',['--noEmit'],frontend],
 ['biome','node_modules/.bin/biome',['check','.'],frontend],
 ['ruff',path.join(path.dirname(python),'ruff'),['check','tests/run_browser.py'],path.join(work,'bodyguard/backend')],
 ['ruff-format',path.join(path.dirname(python),'ruff'),['format','--check','tests/run_browser.py'],path.join(work,'bodyguard/backend')],
 ['assets','node',['scripts/prepare-assets.mjs'],frontend],
 ['build','node_modules/.bin/vite',['build'],frontend],
 ['guard','node',['scripts/check-selection-production.mjs'],frontend],
 ['diff','git',['diff','--check'],work],
]
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:work,encoding:'utf8'}).trim(),phase,results:[]}
for(const[name,cmd,args,cwd]of specs){
 const r=spawnSync(cmd,args,{cwd,maxBuffer:25*1024*1024})
 fs.writeFileSync(proof+'/'+name+'-'+phase+'.log',Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]),{flag:'wx'})
 receipt.results.push({name,command:[cmd,...args],exit:r.status,signal:r.signal})
 fs.writeFileSync(proof+'/checks-'+phase+'.json',JSON.stringify(receipt,null,2)+'\n')
 console.log(JSON.stringify(receipt.results.at(-1)))
 if(r.status!==0){process.exitCode=r.status??1;break}
}
