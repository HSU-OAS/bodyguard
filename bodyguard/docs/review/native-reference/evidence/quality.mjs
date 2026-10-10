import {spawnSync} from 'node:child_process'
const proof="/private/tmp/bodyguard-native-reference-proof.nK3C3o",python="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-account-web/bodyguard/backend/.venv/bin/python"
const label=process.argv[2]
if(!/^[a-z][a-z0-9-]*$/.test(label??''))throw Error('Owned label required')
for(const[tag,command,args]of[
 ['unit','./node_modules/.bin/vitest',['run','--reporter=json','--outputFile='+proof+'/frontend-'+label+'.json']],
 ['types','./node_modules/.bin/tsc',['--noEmit']],
 ['biome','./node_modules/.bin/biome',['check','.']],
 ['assets','node',['scripts/prepare-assets.mjs']],
 ['build','./node_modules/.bin/vite',['build']],
 ['guard','node',['scripts/check-selection-production.mjs']],
 ['ruff',python,['-m','ruff','check','../backend/tests/run_browser.py']],
 ['diff','git',['diff','--check']],
]){const r=spawnSync('node',[proof+'/run.mjs',tag+'-'+label,command,...args],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)}
console.log(JSON.stringify({complete:true,label}))
