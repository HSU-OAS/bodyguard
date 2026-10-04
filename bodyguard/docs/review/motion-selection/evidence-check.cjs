// S2.5a: archive integrity and recorded synthetic UI observations, not clinical/auth approval.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let copies = 0, png = 0, gzip = 0, results = 0;
for (const folder of [__dirname, join(__dirname, 'post-review')]) {
  const manifest = JSON.parse(readFileSync(join(folder, 'copy-manifest.json')));
  assert.equal(manifest.exact_copies, true);
  assert.equal(manifest.copies.length, folder === __dirname ? 8 : 7);
  for (const entry of manifest.copies) {
    assert(!entry.file.includes('/') && !entry.file.includes('..'));
    const bytes = readFileSync(join(folder, entry.file));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(sha(bytes), entry.sha256);
    const decoded = entry.file.endsWith('.gz') ? gunzipSync(bytes) : bytes;
    assert.equal(sha(decoded), entry.decoded_sha256);
    copies++;
    if (entry.file.endsWith('.png')) {
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), entry.file === 'detail-narrow.png' ? 700 : 1440);
      png++;
    } else {
      gzip++;
      const text = decoded.toString('utf8');
      assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text));
      if (entry.file === 'browser-report.json.txt.gz') {
        const report = JSON.parse(text);
        assert(!Object.hasOwn(report.config, 'env'));
        assert.deepEqual([report.stats.expected, report.stats.skipped, report.stats.unexpected, report.stats.flaky], [5, 0, 0, 0]);
        let count = 0;
        for (const suite of report.suites) for (const spec of suite.specs) for (const test of spec.tests) {
          assert.equal(test.results.length, 1);
          const result = test.results[0];
          assert.equal(result.status, 'passed');
          const attachment = result.attachments.find((item) => item.name === 'observations.json');
          assert(attachment?.body);
          const observed = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
          assert.equal(observed.cameraCalls, 0);
          assert.deepEqual(observed.pageErrors, []);
          assert.deepEqual(observed.storageLengths, [0, 0]);
          assert.equal(observed.actualAuthServer, false);
          assert.equal(observed.actualHumanCamera, false);
          assert.equal(observed.browserVersion, '154.0.8037.93');
          assert(observed.apiPaths.every((value) => value === '/api/v1/me' || (spec.title.startsWith('C-01') && value === '/api/v1/auth/google/status')));
          count++;
        }
        assert.equal(count, 5);
        results += count;
      }
    }
  }
}
assert.deepEqual([copies, png, gzip, results], [15, 12, 3, 10]);
console.log(JSON.stringify({ copies, PNG: png, gzip, recorded_browser_results: results, clinical_or_actual_auth_approval: false }));
