import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lloxbvxkqsfgxncgtupw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vslddHvGmZ3MJYxYV7xIxQ_ldlTaPHa';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);