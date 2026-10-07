import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
const [work,proof,label,number,source,base,runtime,comment]=process.argv.slice(2)
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:work,maxBuffer:40*1024*1024})
const git=(...args)=>run('git',args).toString().trim()
const gh=(...args)=>run('gh',args)
const api=(url,...args)=>JSON.parse(gh('api',url,...args))
const sha=b=>createHash('sha256').update(b).digest('hex')
run('git',['fetch','origin','main'])
assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('rev-parse','origin/main'),base)
assert.equal(git('status','--porcelain'),'');run('git',['diff','--check','origin/main..HEAD'])
const pr=api('repos/HSU-OAS/bodyguard/pulls/'+number)
assert.equal(pr.state,'open');assert.equal(pr.draft,false);assert.equal(pr.head.sha,source);assert.equal(pr.base.sha,base)
assert.equal(pr.head.ref,'codex/native-camera-recovery');assert.equal(pr.base.ref,'main')
const view=JSON.parse(gh('pr','view',number,'--repo','HSU-OAS/bodyguard','--json','state,isDraft,headRefOid,mergeable,mergeStateStatus,statusCheckRollup,reviews'))
assert.equal(view.state,'OPEN');assert.equal(view.headRefOid,source);assert.equal(view.mergeable,'MERGEABLE');assert.equal(view.mergeStateStatus,'CLEAN')
assert.deepEqual(view.statusCheckRollup,[],'Inspect any new checks; none is not CI passed')
assert.deepEqual(view.reviews,[],'Inspect any new review')
const inline=api('repos/HSU-OAS/bodyguard/pulls/'+number+'/comments','--paginate','--slurp').flat()
assert.equal(inline.length,0,'Inspect new inline review')
const issue=api('repos/HSU-OAS/bodyguard/issues/'+number+'/comments','--paginate','--slurp').flat()
if(label==='initial')assert.equal(issue.length,0,'Inspect new issue comment')
else{
 assert.equal(issue.length,1);assert.equal(String(issue[0].id),comment);assert.equal(issue[0].user.login,'leegongman')
 assert.equal(issue[0].body.trimEnd(),fs.readFileSync(proof+'/review.md','utf8').trimEnd())
}
const files=api('repos/HSU-OAS/bodyguard/pulls/'+number+'/files','--paginate','--slurp').flat()
const expected=run('git',['diff','--name-only','-z','origin/main..HEAD']).toString().split('\0').filter(Boolean).sort()
assert.equal(pr.changed_files,files.length);assert.deepEqual(files.map(f=>f.filename).sort(),expected)
for(const f of files)assert.equal(f.sha,git('rev-parse',source+':'+f.filename),f.filename)
const repo=api('repos/HSU-OAS/bodyguard');assert.equal(repo.allow_merge_commit,true);assert.equal(repo.delete_branch_on_merge,false)
assert.equal(api('repos/HSU-OAS/bodyguard/git/ref/heads/codex/native-camera-recovery').object.sha,source)
const diff=gh('pr','diff',number,'--repo','HSU-OAS/bodyguard','--color','never'),diffSha=sha(diff)
if(label==='premerge')assert.equal(diffSha,JSON.parse(fs.readFileSync(proof+'/initial-gate.json')).diffSha)
const root='bodyguard/docs/review/native-camera-recovery/',r=JSON.parse(run('git',['show',source+':'+root+'summary.json']))
assert.equal(r.runtime,runtime);assert.equal(r.frontend,939);assert.equal(r.adapterUnit,13)
for(const [suite,total]of [['nativerecovery',8],['nativeauth',12]]){
 assert.equal(r.browsers[suite].expected,total)
 for(const key of ['unexpected','skipped','flaky'])assert.equal(r.browsers[suite][key],0)
}
assert.equal(r.scopedUnresolvedP1+r.scopedUnresolvedP2,0);assert.equal(r.allStagesPassed,false)
assert(r.checks.every(c=>c.exit===0&&c.signal===null))
for(const s of r.sources){
 const final=run('git',['show',source+':'+s.name]),tested=run('git',['show',runtime+':'+s.name])
 assert(final.equals(tested));assert.equal(sha(final),s.sha256,s.name)
}
for(const a of r.artifacts){
 assert.equal(sha(run('git',['show',source+':'+root+a.name])),a.sha256,a.name)
 const raw=run('git',['show',source+':'+root+a.raw]);assert.equal(sha(raw),a.compressedSha256,a.name)
 const bytes=gunzipSync(raw);assert.equal(bytes.length,a.rawBytes);assert.equal(sha(bytes),a.rawSha256,a.name)
}
const receipt={source,base,runtime,state:view.state,mergeable:view.mergeable,mergeStateStatus:view.mergeStateStatus,
 files:files.length,remoteBlobsMatch:true,sourceHashes:r.sources.length,artifacts:r.artifacts.length,rawExact:true,localClean:true,
 diffBytes:diff.length,diffSha,checks:view.statusCheckRollup,reviews:view.reviews,inlineComments:0,
 issueCommentIds:issue.map(c=>c.id),allowMergeCommit:true,deleteBranchOnMerge:false,
 scopedUnresolvedP1P2:0,independentReview:false,allStagesPassed:false}
fs.writeFileSync(proof+'/'+label+'-diff.patch',diff,{flag:'wx'})
fs.writeFileSync(proof+'/'+label+'-gate.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt))
