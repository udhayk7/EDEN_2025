"use client";

import { useState, useEffect } from 'react';
import { Pill, Phone, Mic, MicOff, Heart, Clock } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MedicationReminder from '@/components/MedicationReminder';
import VoiceAssistant from '@/components/VoiceAssistant';
import EmergencyAlert from '@/components/EmergencyAlert';

export default function SeniorApp() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // Set initial time after mount to prevent hydration mismatch
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-sans">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Heart className="w-12 h-12 text-red-500" />
          <h1 className="text-4xl font-bold text-gray-800">CareLoop</h1>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-center gap-2 text-2xl font-semibold text-gray-700">
            <Clock className="w-6 h-6" />
            {currentTime ? currentTime.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }) : '--:--'}
          </div>
          <p className="text-lg text-gray-600 mt-1">
            {currentTime ? currentTime.toLocaleDateString([], { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'Loading...'}
          </p>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        
        {/* Medication Reminder Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Pill className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Medication Reminders</h2>
          </div>
          <MedicationReminder />
        </div>

        {/* Voice Assistant Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Mic className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-800">Voice Assistant</h2>
          </div>
          <VoiceAssistant 
            isListening={isListening} 
            setIsListening={setIsListening} 
          />
        </div>

        {/* Emergency Alert Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <Phone className="w-8 h-8 text-red-600" />
              <h2 className="text-2xl font-bold text-gray-800">Emergency Support</h2>
            </div>
            <EmergencyAlert />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setIsListening(!isListening)}
          className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>
      </div>
    </div>
  );
}
