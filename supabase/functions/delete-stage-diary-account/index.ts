import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createDeleteAccountHandler } from '../_shared/delete-account.ts';

const url = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const publicClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Story Seed production assets use utvoealamrtiuutdtvlb (verified 2026-11-05).
// This endpoint remains restricted to the dedicated Stage Diary project below.
const enabled = true;
Deno.serve(createDeleteAccountHandler({
  enabled,
  projectMatches: url === 'https://qtrzbmmxjkgdbsxqsywr.supabase.co',
  allowedOrigins: ['https://stage-diary-pi.vercel.app', 'http://localhost:3000', 'http://localhost:3001'],
  getUser: async token => { const { data, error } = await publicClient.auth.getUser(token); return error ? null : data.user; },
  revokeSessions: async token => { const { error } = await admin.auth.admin.signOut(token, 'global'); if (error) throw error; },
  deleteUser: async id => { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw error; },
}));
