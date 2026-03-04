import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = `https://dkdehxcrpdfshtqmpiaq.supabase.co`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZGVoeGNycGRmc2h0cW1waWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ1NzgsImV4cCI6MjA4Njg0MDU3OH0.D-wUiK_gBKHRqJXZN0KoGIz39LadvXQsd1ZBniSRrF8";
//const SUPABASE_ANON_KEY = "sb_publishable_zDSMAg-F6f51qWWYWbE93g_TtSI5olA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 5000, //30
    timeout: 20000, 
  },
});

export const isSupabaseConfigured = true;
