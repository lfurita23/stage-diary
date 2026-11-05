const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/supabase.js', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load(fetch, configured = true) {
  const result = { exports: {} };
  vm.runInNewContext(source, { exports: result.exports, require: () => ({ createClient: () => ({}) }), process: { env: configured ? { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' } : {} }, fetch });
  return result.exports.getKakaoLoginEnabled;
}
test('provider button requires live Kakao activation; unavailable or invalid settings hide it', async () => {
  assert.equal(await load(async () => ({ ok: true, json: async () => ({ external: { kakao: true } }) }))(), true);
  for (const settings of [{}, { external: { kakao: false } }, { external: { kakao: 'true' } }]) {
    assert.equal(await load(async () => ({ ok: true, json: async () => settings }))(), false);
  }
  assert.equal(await load(async () => ({ ok: false }))(), false);
  assert.equal(await load(async () => { throw new Error('offline'); })(), false);
  assert.equal(await load(async () => { throw new Error('must not fetch'); }, false)(), false);
});
