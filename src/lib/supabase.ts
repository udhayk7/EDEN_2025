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

// Test database connectivity
export const testDatabaseConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test 1: Basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('senior_profiles')
      .select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('❌ Database connection error:', connectionError);
      if (connectionError.code === 'PGRST116') {
        console.warn('🔒 RLS Error: Row Level Security is blocking access. Please either:');
        console.warn('1. Disable RLS on senior_profiles table temporarily');
        console.warn('2. Add a policy: CREATE POLICY "Enable read access for all users" ON senior_profiles FOR SELECT USING (true);');
      }
      return false;
    }
    
    console.log('✅ Database connection successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected database error:', error);
    return false;
  }
};

// Database types - will be updated based on actual schema
export interface DatabaseMedication {
  id: string;
  senior_id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUser {
  id: string;
  family_id: string;
  full_name: string;
  age: number;
  health_conditions: string[];
  other_health_condition?: string;
  emergency_contact: string;
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

// New database interfaces for voice assistant
export interface IssueReport {
  id?: string;
  senior_id: string;
  issue_type: 'health_concern' | 'medication_issue' | 'emergency' | 'general';
  description: string;
  voice_transcript: string;
  ai_response: string;
  confidence_level: number;
  language: 'en' | 'ml';
  created_at?: string;
  updated_at?: string;
}

export interface EmergencyContact {
  id: string;
  senior_id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyNotification {
  id?: string;
  contact_id: string;
  senior_id: string;
  notification_type: 'emergency' | 'health_concern' | 'medication_missed' | 'general';
  message: string;
  is_emergency: boolean;
  is_read: boolean;
  sent_at: string;
  read_at?: string;
}

// Database table creation SQL (for reference)
/*
-- Issue Reports Table
CREATE TABLE issue_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    senior_id TEXT NOT NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('health_concern', 'medication_issue', 'emergency', 'general')),
    description TEXT NOT NULL,
    voice_transcript TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    confidence_level DECIMAL(3,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 1),
    language TEXT NOT NULL CHECK (language IN ('en', 'ml')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency Contacts Table
CREATE TABLE emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    senior_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family Notifications Table
CREATE TABLE family_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES emergency_contacts(id) ON DELETE CASCADE,
    senior_id TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('emergency', 'health_concern', 'medication_missed', 'general')),
    message TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX idx_issue_reports_senior_id ON issue_reports(senior_id);
CREATE INDEX idx_issue_reports_type ON issue_reports(issue_type);
CREATE INDEX idx_emergency_contacts_senior_id ON emergency_contacts(senior_id);
CREATE INDEX idx_family_notifications_contact_id ON family_notifications(contact_id);
CREATE INDEX idx_family_notifications_senior_id ON family_notifications(senior_id);
CREATE INDEX idx_family_notifications_unread ON family_notifications(is_read) WHERE is_read = FALSE;

-- Insert some sample emergency contacts
INSERT INTO emergency_contacts (senior_id, name, relationship, phone, email, is_primary) VALUES
('current_user', 'Sarah Johnson', 'Daughter', '+1-555-0123', 'sarah@example.com', true),
('current_user', 'Mike Johnson', 'Son', '+1-555-0124', 'mike@example.com', false),
('current_user', 'Dr. Smith', 'Doctor', '+1-555-0125', 'drsmith@clinic.com', false);
*/ 