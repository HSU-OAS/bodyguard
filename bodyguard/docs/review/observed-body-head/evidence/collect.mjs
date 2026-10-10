import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {constants,copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync,gunzipSync} from 'node:zlib'
const [work,proof,regression]=process.argv.slice(2)
assert(work.endsWith('/BODYGUARD-observed-body-head'))
assert(/^\/private\/tmp\/bodyguard-body-head-proof\.[A-Za-z0-9]+$/.test(proof))
const sha=b=>createHash('sha256').update(b).digest('hex')
const json=p=>JSON.parse(readFileSync(p,'utf8'))
const git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:30*1024*1024})
const runtime=git('rev-parse','HEAD').toString().trim(), frontend=join(work,'bodyguard/frontend')
const native=json(join(proof,'browser-final.json')), checks=json(join(proof,'final-checks-final.json')),
  units=json(join(proof,'frontend-final.json')), legacy=json(join(regression,'browser-combined-regression.json'))
assert.equal(runtime,'e29342b547f4f9a383e11e447fc09bc883bef545')
assert.equal(native.head,runtime)
assert(native.passed && native.stages.length===2 && native.stages.every(g=>g.passed && g.states.length===10))
assert.deepEqual(native.sourceBefore,native.sourceAfter)
assert.equal(native.externalRoutes,0)
assert.equal(native.cameraScreenshots,0)
assert(!native.actualHuman && !native.identityVerified && !native.positiveHeadVerified && !native.productSDKPolicy)
assert.equal(checks.head,runtime)
assert.equal(checks.results.length,7)
assert(checks.results.every(r=>r.exit===0))
assert(units.success && units.numPassedTests===1001 && units.numFailedTests===0 && units.numPendingTests===0)
const build=json(join(proof,'probe-build-final.json'))
assert.equal(build.exit,0)
assert.equal(build.head,runtime)
assert.equal(sha(readFileSync(join(proof,'probe-final/probe.js'))),native.resources['/probe.js'].sha256)
assert.equal(json(join(proof,'guard-leak-red.json')).exit,1)
assert.equal(json(join(proof,'guard-restored-green.json')).exit,0)
assert(legacy.samples.length===2 && legacy.samples.every(s=>s.passed))
assert.deepEqual(legacy.sourceBefore,legacy.sourceAfter)
assert.equal(legacy.boundary.camera,0)
assert.equal(legacy.boundary.external,0)
const source={}
for(const [name,expected] of Object.entries({...native.sourceBefore,...legacy.sourceBefore})){
  const bytes=readFileSync(join(frontend,name))
  assert.equal(sha(bytes),expected)
  assert(bytes.equals(git('show',runtime+':bodyguard/frontend/'+name)))
  source[name]=expected
}
for(const r of checks.results) {
  const receipt=json(join(proof,r.label+'.json'))
  assert.deepEqual(receipt.sourceBefore,receipt.sourceAfter)
  for(const [name,hash] of Object.entries(receipt.sourceBefore)) assert.equal(hash,source[name])
}
const publicBytes=[
 ['assets/index-x57--wa1.js','b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0'],
 ['assets/index-dNUNBpCv.css','043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'],
].map(([name,expected])=>{const bytes=readFileSync(join(frontend,'dist',name));assert.equal(sha(bytes),expected);return {name,bytes:bytes.length,sha256:expected}})
const distFiles=readdirSync(join(frontend,'dist'),{recursive:true}).filter(n=>typeof n==='string')
assert(!distFiles.some(n=>n.endsWith('.glb')))
assert.deepEqual(distFiles.filter(n=>/assets\/.*\.(js|css)$/.test(n)).sort(),publicBytes.map(b=>b.name).sort())
const models=json(join(proof,'asset-copy.json')).resources
for(const model of models) assert.equal(sha(readFileSync(join(frontend,'dist/models',model.name))),model.sha256)
writeFileSync(join(proof,'public-byte-proof.json'),JSON.stringify({runtime,publicBytes,models,candidateGLBs:0,publicUIChanges:0,unchangedFromPR75:true},null,2),{flag:'wx'})
copyFileSync(join(regression,'browser-combined-regression.json'),join(proof,'raw-head-regression-browser.json'),constants.COPYFILE_EXCL)
for(const gender of ['male','female']) for(const phase of ['before','after'])
  copyFileSync(join(regression,'combined-regression-'+gender+'-'+phase+'.png'),join(proof,'raw-head-regression-'+gender+'-'+phase+'.png'),constants.COPYFILE_EXCL)
const output=join(work,'bodyguard/docs/review/observed-body-head')
assert(!existsSync(output))
mkdirSync(join(output,'evidence'),{recursive:true})
const evidence=[]
function retain(file,bytes,originalHash=null){
  const target=join(output,'evidence',file)
  writeFileSync(target,bytes,{flag:'wx'})
  assert(readFileSync(target).equals(bytes))
  evidence.push({file,bytes:bytes.length,sha256:sha(bytes),...(originalHash?{originalSha256:originalHash}:{})})
}
for(const file of readdirSync(proof).sort()){
  if(!/\.(json|mjs|ts|png)$/.test(file))continue
  const bytes=readFileSync(join(proof,file))
  if(/^(frontend-|unit-.*-report\.json)/.test(file)){
    const packed=gzipSync(bytes);assert(gunzipSync(packed).equals(bytes));retain(file+'.gz',packed,sha(bytes))
  }else retain(file,bytes)
}
for(const label of ['first','second','delivery','final']){
  const bytes=readFileSync(join(proof,'probe-'+label+'/probe.js')),packed=gzipSync(bytes)
  assert(gunzipSync(packed).equals(bytes));retain('probe-'+label+'.js.gz',packed,sha(bytes))
}
const legacyBytes=readFileSync(join(regression,'probe-combined-regression/probe.js')),packed=gzipSync(legacyBytes)
assert(gunzipSync(packed).equals(legacyBytes));retain('raw-head-regression-probe.js.gz',packed,sha(legacyBytes))
mkdirSync(join(output,'notices'))
for(const name of ['three-MIT.txt','Apache-2.0.txt']) {
  const original=join(work,'bodyguard/docs/review/body-face-frame/notices',name),target=join(output,'notices',name)
  copyFileSync(original,target,constants.COPYFILE_EXCL);assert(readFileSync(original).equals(readFileSync(target)))
}
const summary={runtime,baseline:'2bc3cd96670108f9db923ab81a7ca1282aec32f6',source,evidence,
  unit:{passed:1001,failed:0,pending:0},native:{browser:native.browser,fakeCamera:true,actualSDK:true,actualHuman:false,identityVerified:false,nativePositiveHead:false,syntheticPositive:true,flows:2,states:20,cspBlockedAttempts:native.cspBlockedAttempts,proxyDenied:native.proxyDenied},
  publicBytes,models,physicalCamera:false,releaseReady:false}
writeFileSync(join(output,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx'})
console.log(JSON.stringify({runtime,sources:Object.keys(source).length,evidence:evidence.length,unit:summary.unit,flows:2,states:20,publicByteIdentical:true}))
