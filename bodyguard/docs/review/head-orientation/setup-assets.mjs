import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const [work,cache,proof]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-head-orientation'))
assert(/^\/private\/tmp\/bodyguard-head-proof\.[A-Za-z0-9]+$/.test(proof))
const src=path.join(cache,'bodyguard/frontend/public/models'),dst=path.join(work,'bodyguard/frontend/public/models')
fs.mkdirSync(dst,{recursive:true})
const sha=b=>createHash('sha256').update(b).digest('hex')
const items=[]
for(const name of fs.readdirSync(src).filter(x=>x.endsWith('.task'))){
  const target=path.join(dst,name),bytes=fs.readFileSync(path.join(src,name))
  if(!fs.existsSync(target))fs.copyFileSync(path.join(src,name),target,fs.constants.COPYFILE_EXCL)
  assert.equal(sha(fs.readFileSync(target)),sha(bytes));items.push({name,sha256:sha(bytes)})
}
assert.equal(items.length,5)
fs.writeFileSync(proof+'/cached-assets.json',JSON.stringify(items,null,2),{flag:'wx'})
