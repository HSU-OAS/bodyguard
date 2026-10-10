import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const [work,proof,number,source,base]=process.argv.slice(2)
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:work,maxBuffer:30*1024*1024})
const git=(...args)=>run('git',args).toString().trim()
const api=url=>JSON.parse(run('gh',['api',url]))
run('git',['fetch','origin','main'])
const pr=api('repos/HSU-OAS/bodyguard/pulls/'+number)
assert.equal(pr.state,'closed');assert.equal(pr.merged,true);assert.equal(pr.head.sha,source)
const merge=pr.merge_commit_sha
assert.equal(git('rev-parse','origin/main'),merge)
assert.deepEqual(git('show','-s','--format=%P',merge).split(' '),[base,source])
assert.equal(git('rev-parse',merge+'^{tree}'),git('rev-parse',source+'^{tree}'))
assert.equal(api('repos/HSU-OAS/bodyguard/git/ref/heads/codex/native-camera-recovery').object.sha,source)
assert.equal(git('branch','--show-current'),'codex/native-camera-recovery')
assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('status','--porcelain'),'')
const r=JSON.parse(fs.readFileSync(work+'/bodyguard/docs/review/native-camera-recovery/summary.json'))
for(const s of r.sources)assert.equal(createHash('sha256').update(run('git',['show',merge+':'+s.name])).digest('hex'),s.sha256)
const checks=JSON.parse(run('gh',['pr','view',number,'--repo','HSU-OAS/bodyguard','--json','statusCheckRollup'])).statusCheckRollup
assert.deepEqual(checks,[])
const result={number:Number(number),state:'MERGED',source,base,merge,mergedAt:pr.merged_at,
 mergeCommit:true,parents:[base,source],sameTree:true,sourceShaMatches:r.sources.length,
 branchRetained:true,localClean:true,checks,allStagesPassed:false,qualifiedReleaseMotions:0,
 publicDesignChanged:false,actualNativeRecovery:true,actualHuman:false,productionOperations:false}
fs.writeFileSync(proof+'/postmerge.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
