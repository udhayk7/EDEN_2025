"use client";

import { useState, useEffect } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isEmergency?: boolean;
}

interface VoiceAssistantProps {
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
}

export default function VoiceAssistant({ isListening, setIsListening }: VoiceAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [genAI, setGenAI] = useState<GoogleGenerativeAI | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ml'>('en');

  useEffect(() => {
    // Initialize Gemini AI
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      setGenAI(new GoogleGenerativeAI(apiKey));
    }

    // Initialize speech recognition
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;  // Changed to true for "hey google" trigger
      recognition.interimResults = true;
      recognition.lang = currentLanguage === 'en' ? 'en-US' : 'ml-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setCurrentTranscript('');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Update interim transcript for display
        setCurrentTranscript(interimTranscript);
        
        // Check for "hey google" trigger in both final and interim results
        const fullTranscript = (transcript + ' ' + interimTranscript).toLowerCase();
        console.log('🎤 Voice input:', fullTranscript);
        
        if (fullTranscript.includes('hey google') || fullTranscript.includes('google') || 
            fullTranscript.includes('ഗൂഗിൾ') || fullTranscript.includes('ഹേ ഗൂഗിൾ')) {
          
          console.log('🔥 "Hey Google" detected!');
          toast.success('Hey Google detected! Listening...');
          
          // Stop current recognition and start a new one for the actual query
          recognition.stop();
          
          setTimeout(() => {
            if (recognition) {
              recognition.start();
              toast.success('🎤 Ask me anything about your health or medications!');
            }
          }, 1000);
          
          return;
        }
        
        // Handle normal voice input if final transcript exists
        if (transcript.trim()) {
          handleVoiceInput(transcript);
          setCurrentTranscript('');
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          toast.error('🎤 Microphone permission denied. Please allow microphone access.');
        } else if (event.error === 'no-speech') {
          console.log('🔄 No speech detected, will restart later...');
          // Don't show error for no-speech, and don't auto-restart immediately
        } else if (event.error === 'aborted') {
          console.log('🛑 Speech recognition aborted (likely due to restart)');
          // Don't show error for aborted, this is normal when restarting
        } else {
          toast.error(`Voice recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
        setCurrentTranscript('');
        
        // Only auto-restart if not manually stopped and component is still mounted
        setTimeout(() => {
          if (recognition && !isListening) {
            try {
              console.log('🔄 Auto-restarting voice recognition for "Hey Google"');
              recognition.start();
            } catch (error) {
              console.log('⚠️ Could not restart recognition:', error);
            }
          }
        }, 3000); // Increased delay to prevent conflicts
      };

      setRecognition(recognition);
      
      // Auto-start listening for "Hey Google" when component loads
      setTimeout(() => {
        try {
          console.log('🚀 Auto-starting voice recognition for "Hey Google"');
          recognition.start();
          toast.success('🎤 Voice Assistant ready! Say "Hey Google" to start.');
        } catch (error) {
          console.log('⚠️ Could not auto-start recognition:', error);
          toast.error('Voice recognition unavailable. Click "Start Talking" button instead.');
        }
      }, 3000); // Increased delay
    }
  }, [currentLanguage]);

  const startListening = () => {
    if (recognition && !isListening) {
      try {
        console.log('🎤 Manually starting voice recognition');
        recognition.start();
      } catch (error) {
        console.error('❌ Failed to start recognition:', error);
        toast.error('Failed to start voice recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      try {
        console.log('🛑 Manually stopping voice recognition');
        recognition.stop();
        setIsListening(false);
      } catch (error) {
        console.error('❌ Failed to stop recognition:', error);
      }
    }
  };

  const detectLanguage = (text: string): 'en' | 'ml' => {
    // Simple Malayalam detection - contains Malayalam characters
    const malayalamRegex = /[\u0D00-\u0D7F]/;
    if (malayalamRegex.test(text)) {
      return 'ml';
    }
    return 'en';
  };

  const handleVoiceInput = async (transcript: string) => {
    // Auto-detect language and update current language
    const detectedLang = detectLanguage(transcript);
    setCurrentLanguage(detectedLang);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: transcript,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Check for emergency keywords in both languages
    const emergencyKeywordsEn = [
      'not feeling well', 'feel sick', 'chest pain', 'head pain', 'headache',
      'dizzy', 'nauseous', 'help', 'emergency', 'hurt', 'pain', 'sick'
    ];
    
    const emergencyKeywordsMl = [
      'അസുഖം', 'വേദന', 'നെഞ്ചുവേദന', 'തലവേദന', 'ചക്കരം വരുന്നു', 
      'സഹായം', 'അപകടം', 'വേദനിക്കുന്നു', 'സുഖമില്ല', 'ബുദ്ധിമുട്ട്'
    ];

    const allEmergencyKeywords = [...emergencyKeywordsEn, ...emergencyKeywordsMl];
    const isEmergency = allEmergencyKeywords.some(keyword => 
      transcript.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isEmergency) {
      handleEmergencyQuery(transcript, detectedLang);
    } else {
      await handleNormalQuery(transcript, detectedLang);
    }
  };

  const handleEmergencyQuery = (transcript: string, language: 'en' | 'ml') => {
    const emergencyResponseEn = "I understand you're not feeling well. Please sit down where you are and try to stay calm. I'm notifying your family right away for assistance.";
    const emergencyResponseMl = "നിങ്ങൾക്ക് അസുഖം തോന്നുന്നു എന്ന് മനസ്സിലായി. ദയവായി അവിടെ ഇരുന്ന് ശാന്തമായിരിക്കുക. ഞാൻ ഉടനെ നിങ്ങളുടെ കുടുംബത്തെ അറിയിക്കുന്നു.";
    
    const emergencyResponse = language === 'ml' ? emergencyResponseMl : emergencyResponseEn;
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: emergencyResponse,
      isUser: false,
      timestamp: new Date(),
      isEmergency: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    // Speak the response
    speakResponse(emergencyResponse, language);

    // Trigger emergency notification
    triggerEmergencyAlert(transcript);

    const toastMessage = language === 'ml' ? 'അപകടാവസ്ഥ കണ്ടെത്തി! കുടുംബത്തെ അറിയിച്ചു.' : 'Emergency detected! Family has been notified.';
    toast.error(toastMessage);
  };

  const handleNormalQuery = async (transcript: string, language: 'en' | 'ml') => {
    if (!genAI) {
      const errorMsg = language === 'ml' ? 'AI സഹായി ലഭ്യമല്ല. ദയവായി കോൺഫിഗറേഷൻ പരിശോധിക്കുക.' : 'AI assistant not available. Please check configuration.';
      toast.error(errorMsg);
      return;
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const prompt = language === 'ml' ? 
        `
        നിങ്ങൾ പ്രായമായവർക്കുള്ള ഒരു സഹായകരമായ ആരോഗ്യ സഹായിയാണ്. ഉപയോക്താവ് പറഞ്ഞത്: "${transcript}"
        
        സന്ദർഭം: ഇത് പ്രായമായവർക്കുള്ള മരുന്ന് ഓർമ്മപ്പെടുത്തലും ആരോഗ്യ നിരീക്ഷണ ആപ്പുമാണ്.
        
        ദയവായി കരുണയുള്ളതും വ്യക്തവും സംക്ഷിപ്തവുമായ രീതിയിൽ മറുപടി നൽകുക. അവർ മരുന്നുകളെക്കുറിച്ച് ചോദിക്കുകയാണെങ്കിൽ:
        - സാധാരണ മരുന്ന് സമയക്രമങ്ങൾ പരാമർശിക്കുക (രാവിലെ, ഉച്ച, വൈകുന്നേരം)
        - അവരുടെ മരുന്ന് ട്രാക്കർ പരിശോധിക്കാൻ പ്രോത്സാഹിപ്പിക്കുക
        - പിന്തുണയും പോസിറ്റീവുമായിരിക്കുക
        
        ആരോഗ്യ ആശങ്കകളെക്കുറിച്ച് ചോദിക്കുകയാണെങ്കിൽ:
        - സൗമ്യമായ, വൈദ്യേതര ഉപദേശം നൽകുക
        - ആവശ്യമെങ്കിൽ ഡോക്ടറെ ബന്ധപ്പെടാൻ പ്രോത്സാഹിപ്പിക്കുക
        - ആശ്വാസപ്രദമായിരിക്കുക പക്ഷേ അവഗണിക്കരുത്
        
        പ്രതികരണങ്ങൾ ചെറുതാക്കുക (പരമാവധി 2-3 വാക്യങ്ങൾ) കൂടാതെ പ്രിയപ്പെട്ട മുത്തശ്ശിയോടോ മുത്തച്ഛനോടോ സംസാരിക്കുന്നതുപോലെ സംസാരിക്കുക.
        
        മലയാളത്തിൽ മാത്രം ഉത്തരം നൽകുക.
        ` :
        `
        You are a helpful health assistant for seniors. The user said: "${transcript}"
        
        Context: This is a medication reminder and health monitoring app for seniors.
        
        Please respond in a caring, clear, and concise way. If they're asking about medications:
        - Reference common medication schedules (morning, noon, evening)
        - Encourage them to check their medication tracker
        - Be supportive and positive
        
        If they're asking about health concerns:
        - Provide gentle, non-medical advice
        - Encourage them to contact their doctor if needed
        - Be reassuring but not dismissive
        
        Keep responses short (2-3 sentences max) and speak as if talking to a beloved grandparent.
        
        Respond only in English.
        `;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      speakResponse(response, language);

    } catch (error) {
      console.error('Error generating AI response:', error);
      const fallbackResponse = language === 'ml' ? 
        "ഞാൻ നിങ്ങളെ സഹായിക്കാൻ ഇവിടെയുണ്ട്. ദയവായി നിങ്ങളുടെ ചോദ്യം വീണ്ടും പറയാമോ?" :
        "I'm here to help you. Could you please repeat your question?";
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: fallbackResponse,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      speakResponse(fallbackResponse, language);
    }
  };

  const speakResponse = (text: string, language: 'en' | 'ml' = currentLanguage) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      // Set language for text-to-speech
      utterance.lang = language === 'ml' ? 'ml-IN' : 'en-US';
      
      speechSynthesis.speak(utterance);
    }
  };

  const triggerEmergencyAlert = (originalMessage: string) => {
    // This would integrate with your notification system
    console.log('Emergency Alert Triggered:', {
      message: originalMessage,
      timestamp: new Date().toISOString(),
      action: 'notify_family'
    });

    // For demo purposes, show a toast
    toast.custom((t) => (
      <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Emergency Alert Sent</p>
            <p className="text-red-700 text-sm">Family members have been notified</p>
          </div>
        </div>
      </div>
    ), {
      duration: 8000,
    });
  };

  return (
    <div className="h-96 flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-2 bg-gray-50 rounded-lg">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <Mic className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Voice Assistant Ready</h3>
            <p className="text-gray-500 mb-2">Say "Hey Google" or click "Start Talking"</p>
            <p className="text-sm text-gray-400">Ask about medications, health concerns, or request help</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.isUser
                    ? 'bg-blue-500 text-white'
                    : message.isEmergency
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.isUser ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-200 text-blue-800">
              <p className="text-sm italic">{currentTranscript}</p>
            </div>
          </div>
        )}
      </div>

             {/* Language Toggle */}
       <div className="flex justify-center mb-4">
         <div className="bg-gray-100 rounded-lg p-1 flex">
           <button
             onClick={() => setCurrentLanguage('en')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
               currentLanguage === 'en'
                 ? 'bg-white text-blue-600 shadow-sm'
                 : 'text-gray-600 hover:text-gray-800'
             }`}
           >
             English
           </button>
           <button
             onClick={() => setCurrentLanguage('ml')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
               currentLanguage === 'ml'
                 ? 'bg-white text-blue-600 shadow-sm'
                 : 'text-gray-600 hover:text-gray-800'
             }`}
           >
             മലയാളം
           </button>
         </div>
       </div>

       {/* Voice Controls */}
       <div className="flex items-center justify-center gap-4">
         <button
           onClick={isListening ? stopListening : startListening}
           className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
             isListening
               ? 'bg-red-500 hover:bg-red-600 text-white'
               : 'bg-green-500 hover:bg-green-600 text-white'
           }`}
         >
           {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           {isListening ? 
             (currentLanguage === 'ml' ? 'കേൾക്കുന്നത് നിർത്തുക' : 'Stop Listening') : 
             (currentLanguage === 'ml' ? 'സംസാരിക്കാൻ തുടങ്ങുക' : 'Start Talking')
           }
         </button>
         
         <div className="text-sm text-gray-600 text-center">
           <p>{currentLanguage === 'ml' ? 'ബട്ടൺ അമർത്തുക അല്ലെങ്കിൽ "ഹേയ് ഗൂഗിൾ" എന്ന് പറയുക' : 'Say "Hey Google" or click the button'}</p>
           <p className="text-xs">{currentLanguage === 'ml' ? 'മരുന്നുകളെക്കുറിച്ചോ ആരോഗ്യത്തെക്കുറിച്ചോ ചോദിക്കുക' : 'Ask about medications or health'}</p>
         </div>
       </div>

      {isListening && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Listening...</span>
          </div>
        </div>
      )}
    </div>
  );
} 