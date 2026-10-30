import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Build can prerender the client entry without a live connection; requests fail clearly if configuration is absent.
export const supabase = createClient(url || 'https://missing-config.supabase.co', key || 'missing-public-key');
