#!/opt/homebrew/bin/node
// Test-only launcher: exact installed dependencies; never install or contact a registry.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const cwd=process.cwd()
if (!cwd.endsWith('/BODYGUARD-owned-auth-playback/bodyguard/frontend')) throw Error('Unexpected test workspace')
const [command,...args]=process.argv.slice(2)
const steps=command==='build'&&args.length===0
 ? [['node',['scripts/prepare-assets.mjs']],['node_modules/.bin/tsc',['--noEmit']],['node_modules/.bin/vite',['build']]]
 : command==='exec'&&args[0]==='playwright'
 ? [['node_modules/.bin/playwright',args.slice(1)]]
 : null
if(!steps) throw Error('Unsupported test command')
for(const [binary,options] of steps){
 const result=spawnSync(binary,options,{cwd,env:process.env,stdio:'inherit'})
 if(result.status!==0)process.exit(result.status??1)
}
