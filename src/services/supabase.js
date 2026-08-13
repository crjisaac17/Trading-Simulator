/**
 * Supabase Client Initialization Service
 * Centralized initialization for client-side database connections.
 */
const SUPABASE_URL = 'https://qvihrjiwdjupkkccfvao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aWhyaml3ZGp1cGtrY2NmdmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODc4MTcsImV4cCI6MjEwMjE2MzgxN30.KO6DyRhi7-H1-4XS6wCTRWuGQ8vGMtC3RqXlULkhYpk';

let supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('Supabase SDK not loaded yet. Will initialize when script loads.');
}

window.getSupabase = function() {
  if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
};

window.supabaseClient = supabaseClient;
