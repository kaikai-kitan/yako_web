import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Supabase が未設定かどうか */
export const isSupabaseConfigured =
	supabaseUrl.startsWith('https://') &&
	!supabaseUrl.includes('your-project') &&
	supabaseAnonKey.length > 20;

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
