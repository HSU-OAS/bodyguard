import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
const [work, cache, proof] = process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-native-body-head'))
assert(/^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+$/.test(proof))
const src=path.join(cache,'bodyguard/frontend/public/models'), dst=path.join(work,'bodyguard/frontend/public/models')
fs.mkdirSync(dst,{recursive:true})
const receipts=[]
for(const name of fs.readdirSync(src).filter(x=>x.endsWith('.task'))){
  const target=path.join(dst,name)
  if(!fs.existsSync(target))fs.copyFileSync(path.join(src,name),target,fs.constants.COPYFILE_EXCL)
  const hash=createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  assert.equal(hash,createHash('sha256').update(fs.readFileSync(path.join(src,name))).digest('hex'))
  receipts.push({kind:'cached-sdk-task',name,sha256:hash})
}
assert.equal(receipts.length,5)
const expected={male:'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927',female:'27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a'}
for(const gender of ['male','female']){
  const files=spawnSync('git',['ls-tree','-r','--name-only','25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad'],{cwd:work,encoding:'utf8'})
  assert.equal(files.status,0)
  const matches=files.stdout.split('\n').filter(x=>x.endsWith('.glb')&&x.includes(gender)&&(!x.includes('female')||gender==='female'))
  let found=false
  for(const file of matches){
    const r=spawnSync('git',['show',`25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:${file}`],{cwd:work,maxBuffer:100*1024*1024})
    assert.equal(r.status,0)
    const hash=createHash('sha256').update(r.stdout).digest('hex')
    if(hash!==expected[gender])continue
    fs.writeFileSync(proof+'/'+gender+'.glb',r.stdout,{flag:'wx'})
    receipts.push({kind:'unfinished-A37-git-object',gender,file,sha256:hash})
    found=true;break
  }
  assert(found,gender)
}
fs.writeFileSync(proof+'/asset-receipt.json',JSON.stringify(receipts,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(receipts))
