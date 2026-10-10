import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const [work,proof,source,base,number]=process.argv.slice(2),run=(cmd,args)=>execFileSync(cmd,args,{cwd:work,maxBuffer:30*1024*1024}),git=(...args)=>run('git',args).toString().trim(),sha=b=>createHash('sha256').update(b).digest('hex')
run('git',['fetch','origin','main'])
const pr=JSON.parse(run('gh',['pr','view',number,'--repo','HSU-OAS/bodyguard','--json','number,state,headRefOid,mergeCommit,mergedAt,statusCheckRollup']))
assert.equal(pr.state,'MERGED');assert.equal(pr.headRefOid,source);assert.deepEqual(pr.statusCheckRollup,[])
const merge=pr.mergeCommit.oid;assert.equal(git('rev-parse','origin/main'),merge);assert.deepEqual(git('rev-list','--parents','-n','1',merge).split(' '),[merge,base,source]);assert.equal(git('rev-parse',merge+'^{tree}'),git('rev-parse',source+'^{tree}'));assert.equal(git('status','--porcelain'),'')
assert.equal(JSON.parse(run('gh',['api','repos/HSU-OAS/bodyguard/git/ref/heads/codex/body-face-frame'])).object.sha,source)
const root='bodyguard/docs/review/body-face-frame/',r=JSON.parse(run('git',['show',merge+':'+root+'summary.json']))
for(const[f,h]of Object.entries(r.source))assert.equal(sha(run('git',['show',merge+':bodyguard/frontend/'+f])),h)
for(const e of r.evidence)assert.equal(sha(run('git',['show',merge+':'+root+e.name])),e.storedSha256)
const receipt={pr:Number(number),merge,source,base,runtime:r.runtime,mergedAt:pr.mergedAt,parentsVerified:true,mainExact:true,sameTree:true,sourceHashes:Object.keys(r.source).length,evidenceHashes:r.evidence.length,branchRetained:true,checks:[],localClean:true,allStagesPassed:false}
fs.writeFileSync(proof+'/postmerge.json',JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt))
