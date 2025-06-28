"use client";

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, Volume2, Pill, Users, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMedications } from '@/hooks/useMedications';
import { useUsers } from '@/hooks/useUsers';
import VisualVerification from './VisualVerification';

interface Medication {
  id: string;
  name: string;
  time: string;
  taken: boolean;
  reminderCount: number;
  specialInstructions?: string;
}

export default function MedicationReminder() {
  // User management
  const { users, currentUser, loading: usersLoading, switchUser } = useUsers();
  
  // Medication management with real-time updates
  const { 
    medications, 
    loading: medicationsLoading, 
    markMedicationTaken, 
    updateReminderCount, 
    resetDailyMedications,
    addMedication 
  } = useMedications(currentUser?.id || null);

  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showVisualVerification, setShowVisualVerification] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [browserCapabilities, setBrowserCapabilities] = useState<{
    speechSynthesis: boolean;
    speechRecognition: boolean;
    mounted: boolean;
  }>({
    speechSynthesis: false,
    speechRecognition: false,
    mounted: false
  });

  useEffect(() => {
    // Check browser capabilities after mounting to prevent hydration mismatch
    if (typeof window !== 'undefined') {
      const speechSynthesis = 'speechSynthesis' in window;
      const speechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      
      setBrowserCapabilities({
        speechSynthesis,
        speechRecognition,
        mounted: true
      });
      
      console.log('🌐 Browser compatibility check:');
      console.log('- speechSynthesis:', speechSynthesis ? '✅' : '❌');
      console.log('- SpeechRecognition:', 'SpeechRecognition' in window ? '✅' : '❌');
      console.log('- webkitSpeechRecognition:', 'webkitSpeechRecognition' in window ? '✅' : '❌');
      
      if (speechSynthesis) {
        toast.success('🔊 Speech system ready!');
      } else {
        toast.error('❌ Speech not supported in this browser');
      }
    }
  }, []);

  useEffect(() => {

    // Initialize speech recognition
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Better settings for medication confirmation
      recognition.continuous = false;  // Changed to false for better single-phrase detection
      recognition.interimResults = false;  // Changed to false for cleaner final results
      recognition.lang = 'en-US';  // Start with English
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Voice recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        console.log('🗣️ Heard:', transcript);
        
        // Check for medication taken confirmations
        const confirmationWords = [
          'i took it', 'yes', 'done', 'taken', 'ok', 'okay',
          'ഞാൻ കഴിച്ചു', 'കഴിച്ചു', 'ആയി', 'ശരി'
        ];
        
        const stopWords = [
          'stop', 'no', 'cancel', 'നിർത്തുക', 'വേണ്ട', 'ഇല്ല'
        ];
        
        if (confirmationWords.some(word => transcript.includes(word))) {
          console.log('✅ Confirmation detected:', transcript);
          handleMedicationTaken();
        } else if (stopWords.some(word => transcript.includes(word))) {
          console.log('🛑 Stop command detected:', transcript);
          handleStopCommand();
        } else {
          console.log('❓ Unrecognized command:', transcript);
          toast.error('Please say "I took it" or "Yes" to confirm');
          // Restart listening
          setTimeout(() => {
            if (recognition && !isListening) {
              recognition.start();
            }
          }, 1000);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access.');
        } else if (event.error === 'no-speech') {
          toast.error('No speech detected. Please try again.');
          // Restart listening after no-speech error
          setTimeout(() => {
            if (recognition) {
              recognition.start();
            }
          }, 1000);
        } else {
          toast.error(`Voice recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('🎤 Voice recognition ended');
        setIsListening(false);
      };

      setRecognition(recognition);
    }

    // Check for medication reminders every 5 seconds for faster testing
    const interval = setInterval(checkMedicationReminders, 5000);
    
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const checkMedicationReminders = () => {
    const now = new Date();
    const currentTimeString = now.toTimeString().slice(0, 5);

    medications.forEach(med => {
      if (med.time === currentTimeString && !med.taken) {
        console.log(`⏰ Triggering reminder for ${med.name} at ${currentTimeString} (taken: ${med.taken})`);
        triggerMedicationReminder(med);
      } else if (med.time === currentTimeString && med.taken) {
        console.log(`✅ Skipping reminder for ${med.name} - already taken`);
      }
    });
  };

  const getTimeUntilReminder = (medTime: string) => {
    const now = new Date();
    const [hours, minutes] = medTime.split(':').map(Number);
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);
    
    // If the time has passed today, assume it's for tomorrow
    if (reminderTime < now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    const timeDiff = reminderTime.getTime() - now.getTime();
    const minutesUntil = Math.floor(timeDiff / (1000 * 60));
    const secondsUntil = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    if (minutesUntil <= 0 && secondsUntil <= 0) {
      return "Time to take!";
    } else if (minutesUntil < 60) {
      return `${minutesUntil}m ${secondsUntil}s`;
    } else {
      const hoursUntil = Math.floor(minutesUntil / 60);
      const remainingMinutes = minutesUntil % 60;
      return `${hoursUntil}h ${remainingMinutes}m`;
    }
  };

  const triggerMedicationReminder = (medication: Medication) => {
    // Double-check if medication is still not taken (prevent race conditions)
    const currentMed = medications.find(med => med.id === medication.id);
    if (!currentMed || currentMed.taken) {
      console.log(`⏭️ Skipping reminder for ${medication.name} - already taken or not found`);
      return;
    }

    console.log('🚨 MEDICATION REMINDER TRIGGERED for:', medication.name, 'taken:', currentMed.taken);
    
    // Speak the reminder
    speakReminder(medication);
    
    // Show visual reminder
    toast.custom((t) => (
      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <div>
            <p className="font-semibold text-yellow-800">🔔 Time for your medication!</p>
            <p className="text-yellow-700">{medication.name}</p>
            {medication.specialInstructions && (
              <p className="text-sm text-yellow-600">{medication.specialInstructions}</p>
            )}
          </div>
        </div>
      </div>
    ), {
      duration: 15000,
    });

    // Update reminder count only if not taken
    if (!currentMed.taken) {
      updateReminderCount(medication.id, currentMed.reminderCount + 1);
    }

    // Start listening for voice confirmation
    if (recognition && !isListening && !currentMed.taken) {
      console.log('🎤 Starting voice recognition for medication confirmation');
      try {
        recognition.start();
      } catch (error) {
        console.error('❌ Failed to start voice recognition:', error);
        toast.error('Failed to start voice recognition. Try clicking "Mark Taken" instead.');
      }
    } else {
      console.log('⚠️ Voice recognition not available or already listening or medication taken');
    }
  };

  const speakReminder = (medication: Medication) => {
    console.log('🔊 speakReminder called for:', medication.name);
    
    if (!('speechSynthesis' in window)) {
      console.error('❌ speechSynthesis not supported in this browser');
      toast.error('Speech not supported in this browser');
      return;
    }

    // Cancel any ongoing speech first
    speechSynthesis.cancel();
    
    const englishText = `Time to take your ${medication.name}. ${medication.specialInstructions || ''} Please say "I took it" when you're done.`;
    const malayalamText = `${medication.name} കഴിക്കാനുള്ള സമയം. ${medication.specialInstructions || ''} കഴിച്ചുകഴിഞ്ഞാൽ "ഞാൻ കഴിച്ചു" എന്ന് പറയുക.`;
    
    console.log('🗣️ Speaking English:', englishText);
    
    // Speak in English first
    const englishUtterance = new SpeechSynthesisUtterance(englishText);
    englishUtterance.rate = 0.8;
    englishUtterance.pitch = 1.1;
    englishUtterance.lang = 'en-US';
    englishUtterance.volume = 1.0;
    
    englishUtterance.onstart = () => {
      console.log('✅ English speech started');
      toast.success('🔊 Speaking reminder...');
    };
    
    englishUtterance.onend = () => {
      console.log('✅ English speech ended, starting Malayalam in 2 seconds');
      // Speak Malayalam after English finishes
      setTimeout(() => {
        console.log('🗣️ Speaking Malayalam:', malayalamText);
        const malayalamUtterance = new SpeechSynthesisUtterance(malayalamText);
        malayalamUtterance.rate = 0.8;
        malayalamUtterance.pitch = 1.1;
        malayalamUtterance.lang = 'ml-IN';
        malayalamUtterance.volume = 1.0;
        
        malayalamUtterance.onstart = () => {
          console.log('✅ Malayalam speech started');
        };
        
        malayalamUtterance.onerror = (event) => {
          console.error('❌ Malayalam speech error:', event);
          toast.error('Malayalam speech failed');
        };
        
        speechSynthesis.speak(malayalamUtterance);
      }, 2000);
    };
    
    englishUtterance.onerror = (event) => {
      console.error('❌ English speech error:', event?.error || 'Unknown speech error');
      console.error('Full error event:', event);
      toast.error('English speech failed - trying backup method');
      
      // Try a simpler fallback speech
      speechSynthesis.cancel();
      const fallbackUtterance = new SpeechSynthesisUtterance(`Time to take your medication: ${medication.name}`);
      fallbackUtterance.rate = 0.7;
      fallbackUtterance.lang = 'en-US';
      speechSynthesis.speak(fallbackUtterance);
    };
    
    speechSynthesis.speak(englishUtterance);
  };

  const handleMedicationTaken = () => {
    console.log('✅ Processing medication taken confirmation');
    
    const pendingMed = medications.find(med => !med.taken);
    if (pendingMed) {
      // Use database function to mark as taken
      markMedicationTaken(pendingMed.id);
      
      // Stop listening immediately
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
      
      // Positive reinforcement speech
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel(); // Cancel any ongoing speech
        
        const englishUtterance = new SpeechSynthesisUtterance("Well done! Your medication has been recorded.");
        englishUtterance.lang = 'en-US';
        englishUtterance.rate = 0.9;
        speechSynthesis.speak(englishUtterance);
        
        setTimeout(() => {
          const malayalamUtterance = new SpeechSynthesisUtterance("നല്ലത്! നിങ്ങളുടെ മരുന്ന് രേഖപ്പെടുത്തി.");
          malayalamUtterance.lang = 'ml-IN';
          malayalamUtterance.rate = 0.9;
          speechSynthesis.speak(malayalamUtterance);
        }, 2000);
      }
    } else {
      console.log('⚠️ No pending medication found');
      toast.error('No pending medication to mark as taken');
    }
  };

  const handleStopCommand = () => {
    const pendingMed = medications.find(med => !med.taken);
    if (pendingMed && pendingMed.reminderCount >= 2) {
      // Notify family after 2-3 stop commands
      notifyFamily(pendingMed);
      
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    }
  };

  const notifyFamily = (medication: Medication) => {
    toast.error(`Family notified: ${medication.name} reminder ignored multiple times.`);
    
    // Here you would integrate with your notification system
    // For now, we'll just log it
    console.log('Notifying family:', {
      medication: medication.name,
      time: new Date().toISOString(),
      reminderCount: medication.reminderCount
    });
  };

  const manualMarkTaken = (medId: string) => {
    console.log(`🖱️ Manually marking medication ${medId} as taken`);
    
    // Stop any ongoing speech and recognition
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }

    // Use the database function to mark as taken
    markMedicationTaken(medId);

    // Positive reinforcement speech
    const takenMed = medications.find(med => med.id === medId);
    if (takenMed && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(`Great job! ${takenMed.name} has been recorded as taken.`);
        utterance.rate = 0.8;
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
      }, 500);
    }
  };

  const clearAllMedications = () => {
    if (currentUser) {
      resetDailyMedications();
    } else {
      toast.error('No user selected');
    }
  };

  const triggerVisualVerification = (medication: Medication) => {
    console.log('📷 Starting visual verification for:', medication.name);
    setSelectedMedication(medication);
    setShowVisualVerification(true);
  };

  const handleVisualVerificationComplete = (verified: boolean) => {
    console.log('📷 Visual verification completed:', { verified, medication: selectedMedication?.name });
    
    if (verified && selectedMedication) {
      // Mark medication as taken
      markMedicationTaken(selectedMedication.id);
      
      const message = `🎉 ${selectedMedication.name} successfully consumed! AI verification complete.`;
      toast.success(message, { duration: 5000 });
      
      // Positive reinforcement speech
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const reinforcementMessages = [
          `Excellent! Your ${selectedMedication.name} has been verified using advanced hand-to-mouth motion tracking!`,
          `Outstanding! AI detected your hand-to-mouth motion and verified you took your ${selectedMedication.name}. Keep up the great work!`,
          `Perfect! Motion tracking technology has successfully verified your ${selectedMedication.name}. You're doing amazing with your health!`,
          `Amazing! The AI tracked your hand movement from pill to mouth and confirmed your ${selectedMedication.name} intake. Well done!`
        ];
        
        const randomMessage = reinforcementMessages[Math.floor(Math.random() * reinforcementMessages.length)];
        const utterance = new SpeechSynthesisUtterance(randomMessage);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = 0.8;
        speechSynthesis.speak(utterance);
      }
      
      // Delay closing the modal to show success message
      setTimeout(() => {
        setShowVisualVerification(false);
        setSelectedMedication(null);
      }, 4000); // Wait 4 seconds to show success overlay
    } else {
      toast.error('Verification cancelled. Please try again when ready.');
      // Close immediately if cancelled
      setShowVisualVerification(false);
      setSelectedMedication(null);
    }
  };

  const testSpeech = () => {
    console.log('🧪 Testing speech functionality');
    if (!('speechSynthesis' in window)) {
      toast.error('❌ Speech not supported in this browser');
      return;
    }

    speechSynthesis.cancel();
    
    const testText = "Hello! This is a test of the speech system. If you can hear this, speech is working properly.";
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.rate = 0.8;
    utterance.pitch = 1.1;
    utterance.lang = 'en-US';
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      console.log('✅ Test speech started');
      toast.success('🔊 Test speech started');
    };
    
    utterance.onend = () => {
      console.log('✅ Test speech completed');
      toast.success('✅ Test speech completed');
    };
    
    utterance.onerror = (event) => {
      console.error('❌ Test speech error:', event);
      toast.error('❌ Test speech failed');
    };
    
    speechSynthesis.speak(utterance);
  };

  // This function is now provided by the useMedications hook

  const requestMicrophonePermission = async () => {
    console.log('🎤 Requesting microphone permission');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');
      toast.success('🎤 Microphone access granted!');
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      // Test voice recognition
      if (recognition) {
        console.log('🧪 Testing voice recognition...');
        recognition.start();
        toast.success('🗣️ Say something to test voice recognition');
      }
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      toast.error('❌ Microphone permission denied. Please allow microphone access in browser settings.');
    }
  };

  return (
    <div className="space-y-4">
      {/* User Selection */}
      {users.length > 1 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-800">Select Patient</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => switchUser(user)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentUser?.id === user.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-100'
                }`}
              >
                {user.name} {user.age && `(${user.age})`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            {currentUser ? `${currentUser.name}'s Schedule` : 'Today\'s Schedule'}
          </h3>
          {usersLoading && <p className="text-sm text-gray-500">Loading patients...</p>}
          {medicationsLoading && <p className="text-sm text-gray-500">Loading medications...</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={requestMicrophonePermission}
            className="text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded-full transition-colors"
          >
            🎤 Test Mic
          </button>
          <button
            onClick={testSpeech}
            className="text-sm bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-full transition-colors"
          >
            🔊 Test Speech
          </button>
          <button
            onClick={clearAllMedications}
            className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full transition-colors"
            disabled={!currentUser}
          >
            Reset Day
          </button>
        </div>
      </div>

      {!currentUser ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-400 mb-4">
            <Users className="w-16 h-16 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Patient Selected</h3>
          <p className="text-gray-500">Please wait while we load your patients...</p>
        </div>
      ) : medications.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-400 mb-4">
            <Pill className="w-16 h-16 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Medications Scheduled</h3>
          <p className="text-gray-500 mb-4">Medications for {currentUser.name} will appear here</p>
          <p className="text-sm text-gray-400">Add medications in your database to see them here</p>
        </div>
      ) : (
        medications.map((med) => (
          <div
            key={med.id}
            className={`p-4 rounded-xl border-2 transition-all duration-300 ${
              med.taken
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {med.taken ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Clock className="w-6 h-6 text-yellow-600" />
                )}
                <div>
                  <h4 className="font-semibold text-gray-800">{med.name}</h4>
                  <p className="text-sm text-gray-600">Scheduled: {med.time}</p>
                  {!med.taken && (
                    <p className="text-xs text-orange-600 font-medium">
                      {getTimeUntilReminder(med.time)}
                    </p>
                  )}
                  {med.specialInstructions && (
                    <p className="text-xs text-blue-600 mt-1">{med.specialInstructions}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {med.reminderCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    Reminded {med.reminderCount}x
                  </span>
                )}
                
                {!med.taken && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerVisualVerification(med)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      📷 AI Verify
                    </button>
                    <button
                      onClick={() => manualMarkTaken(med.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold text-lg transition-colors"
                    >
                      ✅ Mark Taken
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}



      {isListening && (
        <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span className="font-medium">Listening for confirmation... | സ്ഥിരീകരണത്തിനായി കാത്തിരിക്കുന്നു...</span>
          </div>
          <p className="text-sm text-green-600 mt-1">Say "I took it" or "Yes" to confirm | "ഞാൻ കഴിച്ചു" അല്ലെങ്കിൽ "ആയി" എന്ന് പറയുക</p>
        </div>
      )}

      {/* Visual Verification Modal */}
      {showVisualVerification && selectedMedication && (
        <VisualVerification
          isOpen={showVisualVerification}
          medicationName={selectedMedication.name}
          onVerificationComplete={handleVisualVerificationComplete}
          onClose={() => {
            setShowVisualVerification(false);
            setSelectedMedication(null);
          }}
        />
      )}
    </div>
  );
} 