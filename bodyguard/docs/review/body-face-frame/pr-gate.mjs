import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
const [work,proof,label,source,base,runtime,number,comment]=process.argv.slice(2)
assert(/^\d+$/.test(number));assert(['initial','premerge'].includes(label))
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:work,maxBuffer:40*1024*1024}),git=(...args)=>run('git',args).toString().trim(),gh=(...args)=>run('gh',args),api=(url,...args)=>JSON.parse(gh('api',url,...args)),sha=b=>createHash('sha256').update(b).digest('hex')
run('git',['fetch','origin','main'])
assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('rev-parse','origin/main'),base);assert.equal(git('status','--porcelain'),'');run('git',['diff',base+'..'+source,'--check'])
const pr=api('repos/HSU-OAS/bodyguard/pulls/'+number)
assert.equal(pr.state,'open');assert.equal(pr.draft,false);assert.equal(pr.head.sha,source);assert.equal(pr.base.sha,base);assert.equal(pr.head.ref,'codex/body-face-frame');assert.equal(pr.base.ref,'main')
const view=JSON.parse(gh('pr','view',number,'--repo','HSU-OAS/bodyguard','--json','state,isDraft,headRefOid,mergeable,mergeStateStatus,statusCheckRollup,reviews'))
assert.equal(view.state,'OPEN');assert.equal(view.headRefOid,source);assert.equal(view.mergeable,'MERGEABLE');assert.equal(view.mergeStateStatus,'CLEAN');assert.deepEqual(view.statusCheckRollup,[],'Inspect any new checks; none is not CI passed');assert.deepEqual(view.reviews,[],'Inspect any new review')
const inline=api('repos/HSU-OAS/bodyguard/pulls/'+number+'/comments','--paginate','--slurp').flat();assert.equal(inline.length,0)
const issue=api('repos/HSU-OAS/bodyguard/issues/'+number+'/comments','--paginate','--slurp').flat()
if(label==='initial')assert.equal(issue.length,0)
else{assert.equal(issue.length,1);assert.equal(String(issue[0].id),comment);assert.equal(issue[0].user.login,'leegongman');assert.equal(issue[0].body.trimEnd(),fs.readFileSync(proof+'/review.md','utf8').trimEnd())}
const files=api('repos/HSU-OAS/bodyguard/pulls/'+number+'/files','--paginate','--slurp').flat(),expected=run('git',['diff','--name-only','-z',base+'..'+source]).toString().split('\0').filter(Boolean).sort()
assert.equal(pr.changed_files,files.length);assert.deepEqual(files.map(f=>f.filename).sort(),expected)
for(const f of files)assert.equal(f.sha,git('rev-parse',source+':'+f.filename),f.filename)
const repo=api('repos/HSU-OAS/bodyguard');assert.equal(repo.allow_merge_commit,true);assert.equal(repo.delete_branch_on_merge,false);assert.equal(api('repos/HSU-OAS/bodyguard/git/ref/heads/codex/body-face-frame').object.sha,source)
const diff=gh('pr','diff',number,'--repo','HSU-OAS/bodyguard','--color','never'),diffSha=sha(diff)
if(label==='premerge')assert.equal(diffSha,JSON.parse(fs.readFileSync(proof+'/initial-gate.json')).diffSha)
const root='bodyguard/docs/review/body-face-frame/',r=JSON.parse(run('git',['show',source+':'+root+'summary.json']))
assert.equal(r.runtime,runtime);assert.deepEqual(r.unit,{passed:976,failed:0,pending:0});assert(r.browser.passed&&r.browser.actualSDK&&r.browser.fakeCamera);assert.equal(r.browser.stages,9);assert.equal(r.browser.actualHuman,false);assert.equal(r.browser.identityVerified,false);assert.equal(r.browser.positiveHeadVerified,false);assert.equal(r.publicGlb,0);assert.equal(r.cameraScreenshots,0);assert.equal(r.checks.head,runtime);assert.equal(r.checks.results.length,7);assert(r.checks.results.every(c=>c.exit===0))
for(const[f,h]of Object.entries(r.source)){const final=run('git',['show',source+':bodyguard/frontend/'+f]),tested=run('git',['show',runtime+':bodyguard/frontend/'+f]);assert(final.equals(tested));assert.equal(sha(final),h)}
for(const e of r.evidence){const stored=run('git',['show',source+':'+root+e.name]);assert.equal(sha(stored),e.storedSha256);const raw=e.name.endsWith('.gz')?gunzipSync(stored):stored;assert.equal(raw.length,e.bytes);assert.equal(sha(raw),e.sha256)}
const receipt={source,base,runtime,number,state:view.state,mergeable:view.mergeable,mergeStateStatus:view.mergeStateStatus,files:files.length,remoteBlobsMatch:true,sources:Object.keys(r.source).length,evidence:r.evidence.length,rawExact:true,localClean:true,diffBytes:diff.length,diffSha,checks:[],reviews:[],inlineComments:0,issueCommentIds:issue.map(c=>c.id),allowMergeCommit:true,deleteBranchOnMerge:false,scopedUnresolvedP1P2:0,independentReview:false,allStagesPassed:false}
fs.writeFileSync(proof+'/'+label+'-diff.patch',diff,{flag:'wx'});fs.writeFileSync(proof+'/'+label+'-gate.json',JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt))
