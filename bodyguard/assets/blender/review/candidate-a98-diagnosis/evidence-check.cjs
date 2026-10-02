// A-02/A-08: read-only evidence; no appearance or clinical approval.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'contour-spacing.json')))
const root = path.resolve(__dirname, '../../../../..')
const bytes = fs.readFileSync(path.join(root, 'bodyguard/assets/blender/bodyguard_avatar_candidate_a97_unapproved.blend'))
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), data.source_sha256)
assert.equal(data.rows.length, 8)
assert.equal(new Set(data.rows.map(x => [x.body,x.side,x.offset_m].join('/'))).size, 8)
for (const row of data.rows) {
  assert.equal(row.ring_vertices, row.offset_m < 0 ? 42 : row.body === 'Male' ? 96 : 94)
  assert.equal(row.ring_components, 1)
  assert.equal(row.protected_hand_vertices, 0)
  assert.deepEqual(row.ring_degree_counts, {'2':row.ring_vertices})
  for (const distribution of [row.ring_edge_lengths, row.nearest_point_distances]) {
    assert.equal(distribution.count, row.ring_vertices)
    assert(Number.isFinite(distribution.min_m) && distribution.min_m > 0)
    assert(distribution.min_m <= distribution.median_m && distribution.median_m <= distribution.p95_m && distribution.p95_m <= distribution.max_m)
  }
}
for (const key of ['assets_changed','appearance_approved','causal_browser_comparison_run']) assert.equal(data[key], false)
console.log(JSON.stringify({integrity_passed:true,native_rows:8,new_assets:0,causal_comparison:false,appearance_passed:false}))
