// Prints configuration status only; never prints credentials or user records.
const fs = require('node:fs');
const { parseEnv } = require('node:util');
async function main() {
  const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  let role = '';
  if (key.startsWith('eyJ')) {
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role || ''; } catch {}
  }
  const publicKey = key.startsWith('sb_publishable_') || role === 'anon';
  console.log(JSON.stringify({ projectMatches: url === 'https://qtrzbmmxjkgdbsxqsywr.supabase.co', publicKeyConfigured: publicKey }));
  if (!publicKey || url !== 'https://qtrzbmmxjkgdbsxqsywr.supabase.co') { process.exitCode = 1; return; }
  if (!process.argv.includes('--online')) return;
  const headers = { apikey: key };
  const auth = await fetch(`${url}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15000) });
  if (!auth.ok) { console.log(JSON.stringify({ authStatus: auth.status })); process.exitCode = 1; return; }
  const settings = await auth.json();
  console.log(JSON.stringify({ authStatus: auth.status, signupDisabled: settings.disable_signup, emailEnabled: settings.external?.email, emailAutoConfirm: settings.mailer_autoconfirm, googleEnabled: settings.external?.google, kakaoEnabled: settings.external?.kakao }));
  const columns = 'id,phone_suffix,transfer_image,casting_image';
  const db = await fetch(`${url}/rest/v1/tickets?select=${columns}&limit=0`, { headers, signal: AbortSignal.timeout(15000) });
  const result = await db.json().catch(() => ({}));
  console.log(JSON.stringify({ ticketSchemaStatus: db.status, ...(db.ok ? {} : { errorCode: result.code, schemaMessage: result.message }) }));
}
main().catch(error => { console.log(JSON.stringify({ connectionFailed: true, cause: error.cause?.code || error.name })); process.exitCode = 1; });
