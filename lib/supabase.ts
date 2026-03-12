import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = `https://qrbakqngrkecuvrcjmxx.supabase.co`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYmFrcW5ncmtlY3V2cmNqbXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTYyMzEsImV4cCI6MjA4ODg5MjIzMX0.sNNqTi6iG4Jjr9TpHBemNeMfFzKNU2c1xm9evPow_yU"
//const SUPABASE_ANON_KEY = "sb_publishable_yw0o1sIDR-O-Y1cQN6wDTA_kNG01gCz";

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
