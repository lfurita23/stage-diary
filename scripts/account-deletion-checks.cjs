const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/delete-account.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, Request, Response });
const { createDeleteAccountHandler } = exportsObject;
const now = Date.now();
function setup(patch = {}) {
  const calls = [];
  const handler = createDeleteAccountHandler({ enabled: true, projectMatches: true, allowedOrigins: ['https://stage-diary-pi.vercel.app'], now: () => now,
    getUser: async () => ({ id: 'verified-user', last_sign_in_at: new Date(now).toISOString() }),
    revokeSessions: async () => { calls.push('revoke'); }, deleteUser: async id => { calls.push(`delete:${id}`); }, ...patch });
  const request = (body = { confirmation: 'DELETE_MY_ACCOUNT' }, headers = {}, method = 'POST') => new Request('https://example.invalid/account', { method, headers: { authorization: 'Bearer test-token', origin: 'https://stage-diary-pi.vercel.app', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
  return { handler, calls, request };
}
test('self-deletion authenticates ownership and revokes sessions before removing only verified user', async () => {
  const h = setup(); const result = await h.handler(h.request());
  assert.equal(result.status, 200); assert.deepEqual(h.calls, ['revoke', 'delete:verified-user']);
});
test('shared-project gate, forged identities, bad tokens, stale login and missing confirmation cannot delete', async () => {
  for (const patch of [{ enabled: false }, { projectMatches: false }, { getUser: async () => null }, { getUser: async () => ({ id: 'user', last_sign_in_at: new Date(now - 16 * 60000).toISOString() }) }]) {
    const h = setup(patch); assert.ok((await h.handler(h.request())).status >= 400); assert.deepEqual(h.calls, []);
  }
  for (const body of [{}, { confirmation: 'DELETE_MY_ACCOUNT', user_id: 'victim' }]) {
    const h = setup(); assert.equal((await h.handler(h.request(body))).status, 400); assert.deepEqual(h.calls, []);
  }
  const h = setup(); assert.equal((await h.handler(h.request(undefined, { authorization: '' }))).status, 401);
  assert.equal((await h.handler(h.request(undefined, { origin: 'https://other.invalid' }))).status, 403); assert.deepEqual(h.calls, []);
});
test('availability checks do not delete and failed session revocation aborts deletion', async () => {
  const h = setup(); assert.equal((await h.handler(h.request(undefined, {}, 'GET'))).status, 200); assert.deepEqual(h.calls, []);
  const failed = setup({ revokeSessions: async () => { throw new Error('unavailable'); } });
  assert.equal((await failed.handler(failed.request())).status, 500); assert.deepEqual(failed.calls, []);
});
