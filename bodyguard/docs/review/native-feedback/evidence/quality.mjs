import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const proof="/private/tmp/bodyguard-native-feedback-proof.QfzMIt",work="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-native-feedback"
const pythonBins="/Applications/학교 내부/2026-2학기/오픈소스 AI SW 융합 프로젝트/BODYGUARD-account-web/bodyguard/backend/.venv/bin"
const commands=[
 ['unit','node','node_modules/vitest/vitest.mjs','run','--reporter=default','--reporter=json','--outputFile='+proof+'/frontend-committed.json'],
 ['types','node','node_modules/typescript/bin/tsc','--noEmit'],
 ['biome','node','node_modules/@biomejs/biome/bin/biome','check','.'],
 ['assets','node','scripts/prepare-assets.mjs'],
 ['build','node','node_modules/vite/bin/vite.js','build'],
 ['guard','node','scripts/check-selection-production.mjs'],
 ['ruff',pythonBins+'/ruff','check','../backend/tests/run_browser.py'],
 ['diff','git','-C',work,'diff','--check'],
]
for(const[label,...args]of commands){
 const r=spawnSync('node',[proof+'/run.mjs',label+'-committed',...args],{cwd:work+'/bodyguard/frontend',env:process.env,stdio:'inherit'})
 assert.equal(r.status,0,'Quality gate failed: '+label)
}
