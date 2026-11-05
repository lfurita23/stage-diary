import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Build can prerender the client entry without a live connection; requests fail clearly if configuration is absent.
export const supabase = createClient(url || 'https://missing-config.supabase.co', key || 'missing-public-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Expose the button only when the live Auth service enables this provider.
export async function getKakaoLoginEnabled(signal) {
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key }, signal, cache: 'no-store',
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.kakao === true;
  } catch { return false; }
}
