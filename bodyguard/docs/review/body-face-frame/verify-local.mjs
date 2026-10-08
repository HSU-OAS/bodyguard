import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
const [work,cache,proof]=process.argv.slice(2)
const root=path.join(work,'bodyguard/docs/review/body-face-frame'),r=JSON.parse(fs.readFileSync(path.join(root,'summary.json')))
const sha=b=>createHash('sha256').update(b).digest('hex'),git=(...args)=>execFileSync('git',args,{cwd:work,maxBuffer:5*1024*1024})
for(const[f,h]of Object.entries(r.source)){const committed=git('show','HEAD:bodyguard/frontend/'+f),tested=git('show',r.runtime+':bodyguard/frontend/'+f);assert(committed.equals(tested));assert.equal(sha(committed),h)}
for(const e of r.evidence){const stored=fs.readFileSync(path.join(root,e.name));assert.equal(sha(stored),e.storedSha256);const raw=e.name.endsWith('.gz')?gunzipSync(stored):stored;assert.equal(raw.length,e.bytes);assert.equal(sha(raw),e.sha256)}
const link=path.join(work,'bodyguard/frontend/node_modules')
assert(fs.lstatSync(link).isSymbolicLink());assert.equal(fs.readlinkSync(link),path.join(cache,'bodyguard/frontend/node_modules'))
fs.unlinkSync(link) // Only this Story's dependency alias; the shared cache remains untouched.
assert.equal(git('status','--porcelain').toString().trim(),'')
fs.writeFileSync(proof+'/local-source-evidence.json',JSON.stringify({runtime:r.runtime,sources:Object.keys(r.source).length,evidence:r.evidence.length,clean:true,sharedDependenciesPreserved:true},null,2),{flag:'wx'})
console.log(JSON.stringify({clean:true,sources:Object.keys(r.source).length,evidence:r.evidence.length}))
