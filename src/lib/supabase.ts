import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey || supabaseAnonKey === 'REPLACE_WITH_YOUR_ACTUAL_ANON_KEY_FROM_DASHBOARD') {
  console.error('❌ Missing or invalid NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  console.warn('Please set your actual anon key from the Supabase dashboard in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types - will be updated based on actual schema
export interface DatabaseMedication {
  id: string;
  senior_profile_id?: string;
  user_id?: string; // Fallback column name
  name: string;
  time: string;
  taken: boolean;
  reminder_count: number;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUser {
  id: string;
  name?: string;
  full_name?: string;
  display_name?: string;
  email?: string;
  age?: number;
  medical_conditions?: string[];
  created_at: string;
  updated_at: string;
}

export interface DatabaseContact {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAlert {
  id: string;
  user_id: string;
  message: string;
  type: 'emergency' | 'medication' | 'check_in' | 'custom';
  sent_at: string;
  contacts_notified: string[];
} 