import {spawnSync} from 'node:child_process'
const proof="/private/tmp/bodyguard-surface-feedback-proof.ozUgBj",work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-avatar-surface-feedback"
const prefix=process.argv[2]??''
if(prefix && !/^[a-z][a-z0-9-]*$/.test(prefix))throw new Error('Invalid verification label')
const steps=[['all-tests','node','node_modules/vitest/vitest.mjs','run'],['types-final','node','node_modules/typescript/bin/tsc','--noEmit'],['biome-final','node','node_modules/@biomejs/biome/bin/biome','check','.'],['prepare-final','node','scripts/prepare-assets.mjs'],['public-build-final','node','node_modules/vite/bin/vite.js','build'],['guard-final','node','scripts/check-selection-production.mjs'],['diff-final','git','-C',work,'diff','--check']]
for(const[label,...command]of steps){const r=spawnSync('node',[proof+'/run.mjs',prefix?prefix+'-'+label:label,...command],{encoding:'utf8',maxBuffer:16*1024*1024});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0){process.exitCode=r.status??1;break}}
