import { useState, useEffect } from 'react';
import { supabase, DatabaseMedication } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Medication {
  id: string;
  name: string;
  time: string;
  taken: boolean;
  reminderCount: number;
  specialInstructions?: string;
  dosage?: string;
  frequency?: number;
}

export function useMedications(userId: string | null) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert database medication to app medication using actual schema
  const convertMedication = (dbMed: any): Medication => ({
    id: dbMed.id,
    name: dbMed.name,
    // Since the actual DB doesn't have time/taken fields, we'll create default ones
    time: '08:00', // Default time
    taken: false, // Default not taken
    reminderCount: 0, // Default reminder count
    specialInstructions: dbMed.instructions || undefined,
    dosage: dbMed.dosage || undefined,
    frequency: dbMed.frequency || undefined
  });

  // Fetch medications from database
  const fetchMedications = async () => {
    if (!userId) {
      setMedications([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Fetching medications for senior ID:', userId);
      
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('senior_id', userId)
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ Error fetching medications:', error);
        toast.error('Failed to load medications');
        return;
      }

      console.log('✅ Fetched medications:', data);
      const convertedMeds = data?.map(convertMedication) || [];
      setMedications(convertedMeds);
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  // Add new medication - adapted to actual schema
  const addMedication = async (medication: Omit<Medication, 'id' | 'taken' | 'reminderCount'>) => {
    if (!userId) {
      toast.error('No user selected');
      return;
    }

    try {
      console.log('➕ Adding medication:', medication);
      
      const { data, error } = await supabase
        .from('medications')
        .insert([{
          senior_id: userId,
          name: medication.name,
          dosage: medication.dosage || '1',
          frequency: medication.frequency || 1,
          instructions: medication.specialInstructions
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error adding medication:', error);
        toast.error('Failed to add medication');
        return;
      }

      console.log('✅ Added medication:', data);
      toast.success(`Added ${medication.name} to schedule`);
      
      // Refresh medications
      fetchMedications();
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to add medication');
    }
  };

  // Mark medication as taken - this will be app-only since DB doesn't have taken field
  const markMedicationTaken = async (medicationId: string) => {
    try {
      console.log('✅ Marking medication as taken (app-only):', medicationId);
      
      // Update local state immediately since DB doesn't have taken field
      setMedications(prev => 
        prev.map(med => 
          med.id === medicationId 
            ? { ...med, taken: true, reminderCount: 0 }
            : med
        )
      );

      const medication = medications.find(med => med.id === medicationId);
      if (medication) {
        toast.success(`✅ ${medication.name} marked as taken!`);
      }
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to update medication');
    }
  };

  // Update reminder count - app-only since DB doesn't have this field
  const updateReminderCount = async (medicationId: string, count: number) => {
    try {
      // Update local state
      setMedications(prev => 
        prev.map(med => 
          med.id === medicationId 
            ? { ...med, reminderCount: count }
            : med
        )
      );
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
    }
  };

  // Reset daily medications (mark all as not taken) - app-only
  const resetDailyMedications = async () => {
    if (!userId) return;

    try {
      console.log('🔄 Resetting daily medications (app-only) for senior ID:', userId);
      
      setMedications(prev => prev.map(med => ({ ...med, taken: false, reminderCount: 0 })));
      toast.success('✅ Daily medications reset');
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to reset medications');
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    fetchMedications();

    // Subscribe to real-time changes
    console.log('🔔 Setting up real-time subscription for senior ID:', userId);
    
    const subscription = supabase
      .channel('medications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `senior_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Real-time medication change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMed = convertMedication(payload.new as any);
            setMedications(prev => [...prev, newMed].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success(`New medication added: ${newMed.name}`);
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedMed = convertMedication(payload.new as any);
            setMedications(prev => prev.map(med => med.id === updatedMed.id ? updatedMed : med));
          }
          else if (payload.eventType === 'DELETE') {
            setMedications(prev => prev.filter(med => med.id !== payload.old.id));
            toast.success('Medication removed');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up medication subscription');
      subscription.unsubscribe();
    };
  }, [userId]);

  return {
    medications,
    loading,
    addMedication,
    markMedicationTaken,
    updateReminderCount,
    resetDailyMedications,
    refetch: fetchMedications
  };
} 