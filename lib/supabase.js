import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qtrzbmmxjkgdbsxqsywr.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_lwPah7MEmCjLwWzhh9terQ_0uYjQvMHD6K2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);