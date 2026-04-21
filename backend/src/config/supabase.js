import { createClient } from '@supabase/supabase-js';

// These should be set in your .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // throw new Error('Missing Supabase environment variables');
  console.warn('⚠️ Missing SUPABASE_SERVICE_ROLE_KEY environment variable in backend/.env');
}

// Service role client bypasses RLS and should be used cautiously on the backend.
// It is required for updating global channels and managing queues where the
// authenticated user context might not be present (e.g. background workers).
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const createAuthClient = (token) => {
  // Use the anon key to create a client that acts on behalf of the user
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2c3J1dXRrcG5pZWdxd3p4Znh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjkwODQsImV4cCI6MjA5MjM0NTA4NH0.wJE3_8CwsMb9BimFQypsnif4BMgW8l-qcZYxRFyc6i0';
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
};
