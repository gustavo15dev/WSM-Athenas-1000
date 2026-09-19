import { createClient } from '@supabase/supabase-js';

// Supabase credentials directly integrated into code as requested
const SUPABASE_URL = 'https://jotwprwbqabeqswiiztq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wbYsbMiUOvUYtuxSnuA0Jg_nY_egU1L';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
