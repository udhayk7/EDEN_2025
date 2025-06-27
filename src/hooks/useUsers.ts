import { useState, useEffect } from 'react';
import { supabase, DatabaseUser } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email?: string;
  age?: number;
  medicalConditions?: string[];
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Convert database user to app user using actual schema
  const convertUser = (dbUser: any): User => ({
    id: dbUser.id,
    name: dbUser.full_name || 'Unknown',
    email: dbUser.email || undefined,
    age: dbUser.age || undefined,
    medicalConditions: dbUser.health_conditions || undefined
  });

  // Fetch all senior patients
  const fetchUsers = async () => {
    try {
      console.log('🔄 Fetching senior patients...');
      
      const { data, error } = await supabase
        .from('senior_profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('❌ Error fetching senior profiles:', error);
        toast.error('Failed to load senior patients');
        return;
      }

      console.log('✅ Fetched senior profiles:', data);
      const convertedUsers = data?.map(convertUser) || [];
      setUsers(convertedUsers);

      // Auto-select first user if none selected and we have users
      if (!currentUser && convertedUsers.length > 0) {
        setCurrentUser(convertedUsers[0]);
        console.log('👤 Auto-selected first user:', convertedUsers[0].name);
        toast.success(`Selected patient: ${convertedUsers[0].name}`);
      }
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to load senior patients');
    } finally {
      setLoading(false);
    }
  };

  // Switch current user
  const switchUser = (user: User) => {
    setCurrentUser(user);
    console.log('👤 Switched to user:', user.name);
    toast.success(`Switched to: ${user.name}`);
  };

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    currentUser,
    loading,
    switchUser,
    refetch: fetchUsers
  };
} 