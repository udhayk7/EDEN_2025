"use client";

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertTriangle, MessageSquare, Phone, Heart } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isEmergency?: boolean;
  confidence?: number;
}

interface VoiceAssistantProps {
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
}

interface IssueReport {
  id?: string;
  senior_id: string;
  issue_type: 'health_concern' | 'medication_issue' | 'emergency' | 'general';
  description: string;
  voice_transcript: string;
  ai_response: string;
  confidence_level: number;
  language: 'en' | 'ml';
  created_at?: string;
}

export default function VoiceAssistant({ isListening, setIsListening }: VoiceAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [genAI, setGenAI] = useState<GoogleGenerativeAI | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ml'>('en');
  const [conversationActive, setConversationActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manuallyControlled, setManuallyControlled] = useState(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLanguage === 'en' ? 'en-US' : 'ml-IN';

      recognition.onstart = () => {
        console.log('🎤 Recognition started');
        setIsListening(true);
        setCurrentTranscript('');
        lastActivityRef.current = new Date();
      };

      recognition.onresult = (event: any) => {
        const interimTranscript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        const finalTranscript = Array.from(event.results)
          .filter((result: any) => result.isFinal)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        setCurrentTranscript(interimTranscript);
        console.log('🎤 Heard (interim):', interimTranscript);

        if (finalTranscript) {
          console.log('🗣️ Final transcript:', finalTranscript);

          // Clear silence timer since we got input
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }

        // Check for activation phrases when not in conversation
        if (!conversationActive && finalTranscript.trim()) {
          const activationPhrases = ['hey google', 'hello', 'hi there', 'നമസ്ക്കാരം', 'ഹലോ'];
          const lowerTranscript = finalTranscript.toLowerCase().trim();
          
          // Prevent activation on very short phrases that might be echoes
          if (lowerTranscript.length < 3) return;
          
          if (activationPhrases.some(phrase => lowerTranscript.includes(phrase))) {
            console.log('🔥 Conversation activated by:', finalTranscript);
            
            // IMMEDIATELY stop recognition to prevent hearing our own voice
            try {
              recognition.stop();
            } catch (error) {
              console.log('⚠️ Could not stop recognition before response:', error);
            }
            
            setConversationActive(true);
            setIsListening(false);
            
            const greetingMessage = currentLanguage === 'ml' ? 
              'ഹലോ! ഞാൻ കേൾക്കുന്നു. എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?' : 
              'Hi! I\'m listening. How can I help you today?';
            
            // Add greeting to conversation
            const assistantMessage: Message = {
              id: Date.now().toString(),
              text: greetingMessage,
              isUser: false,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
            
            // Speak the greeting and restart recognition when done
            speakResponse(greetingMessage, currentLanguage, () => {
              // Wait a short moment after speech ends before restarting recognition
              setTimeout(() => {
                if (conversationActive && recognition) {
                  try {
                    console.log('🔄 Restarting recognition for conversation...');
                    recognition.start();
                  } catch (error) {
                    console.log('⚠️ Could not restart after greeting:', error);
                  }
                }
              }, 1000); // Wait 1 second after speech ends
            });
            
            return;
          }
        } else if (conversationActive) {
          // In active conversation - process final transcript
          if (finalTranscript.trim()) {
            console.log('💬 Processing conversation input:', finalTranscript.trim());
            
            // IMMEDIATELY stop recognition to process the input
            try {
              recognition.stop();
            } catch (error) {
              console.log('⚠️ Could not stop recognition for processing:', error);
            }
            
            setIsListening(false);
            handleConversationInput(finalTranscript.trim());
            setCurrentTranscript('');
            
            // Set silence timer to end conversation after inactivity
            silenceTimerRef.current = setTimeout(() => {
              console.log('⏰ Silence timer triggered - ending conversation');
              endConversation();
            }, 8000); // 8 seconds of silence ends conversation
          }
        }
      };

      recognition.onerror = (event: any) => {
        // Handle speech recognition errors gracefully
        if (event.error === 'not-allowed') {
          console.error('❌ Speech recognition error:', event.error);
          toast.error('🎤 Please allow microphone access for voice features.');
          setIsListening(false);
          setManuallyControlled(true);
        } else if (event.error === 'network') {
          console.error('❌ Speech recognition error:', event.error);
          toast.error('🌐 Network error. Please check your connection.');
        } else if (event.error === 'no-speech') {
          // This is normal - no speech detected, don't show as error
          console.log('🔇 No speech detected (normal behavior)');
        } else if (event.error === 'aborted') {
          // Recognition was intentionally stopped, don't show as error
          console.log('⏹️ Speech recognition stopped (normal behavior)');
        } else {
          // Log other errors but don't show them to user unless serious
          console.log(`Voice warning: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('🛑 Recognition ended, manuallyControlled:', manuallyControlled, 'conversationActive:', conversationActive);
        setIsListening(false);
        setCurrentTranscript('');
        
        // Clear any existing timeout first
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
        
        // During active conversation, let handleConversationInput manage restarts
        if (conversationActive) {
          console.log('🗣️ In conversation - manual restart will handle this');
          return;
        }
        
        // Only auto-restart if not manually controlled and not processing
        if (!manuallyControlled && !isProcessing) {
          console.log('⏰ Setting auto-restart timer for passive listening');
          restartTimeoutRef.current = setTimeout(() => {
            try {
              if (recognition && !isListening && !manuallyControlled && !isProcessing && !conversationActive) {
                console.log('🔄 Auto-restarting recognition for passive listening');
                recognition.start();
              } else {
                console.log('🚫 Auto-restart cancelled - conditions changed');
              }
            } catch (error) {
              console.log('⚠️ Could not restart recognition:', error);
            }
          }, 2000);
        } else {
          console.log('🚫 No auto-restart - manually controlled or processing');
        }
      };

      setRecognition(recognition);
      
      // Start listening automatically after a delay (only on initial load)
      setTimeout(() => {
        if (!manuallyControlled && !isListening) {
          try {
            console.log('🚀 Initial auto-start');
            recognition.start();
            toast.success('🎤 Voice Assistant ready! Say "Hey Google" or "Hello" to start talking.');
          } catch (error) {
            console.log('⚠️ Could not auto-start recognition:', error);
          }
        }
      }, 2000);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [currentLanguage, conversationActive, isProcessing, manuallyControlled]);

  const endConversation = () => {
    setConversationActive(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    const farewell = currentLanguage === 'ml' ? 
      'ശരി, ഞാൻ ഇവിടെയുണ്ട് നിങ്ങൾക്ക് എന്തെങ്കിലും വേണമെങ്കിൽ വിളിക്കുക.' : 
      'Okay, I\'m here if you need anything else. Just say "Hey Google" to talk again.';
    
    speakResponse(farewell, currentLanguage);
    toast.success('Conversation ended. Say "Hey Google" to start again.');
  };

  const detectLanguage = (text: string): 'en' | 'ml' => {
    const malayalamRegex = /[\u0D00-\u0D7F]/;
    return malayalamRegex.test(text) ? 'ml' : 'en';
  };

  const handleConversationInput = async (transcript: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const detectedLang = detectLanguage(transcript);
    setCurrentLanguage(detectedLang);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: transcript,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Analyze for emergency or health concerns
    const analysis = await analyzeUserInput(transcript, detectedLang);
    
    if (analysis.isEmergency) {
      await handleEmergencyResponse(transcript, detectedLang, analysis);
    } else if (analysis.isHealthConcern) {
      await handleHealthConcernResponse(transcript, detectedLang, analysis);
    } else {
      await handleNormalConversation(transcript, detectedLang, analysis);
    }
    
    setIsProcessing(false);
    
    // Note: Speech restart is now handled by individual response functions with proper timing
  };

  const analyzeUserInput = async (text: string, language: 'en' | 'ml') => {
    const emergencyKeywords = language === 'ml' ? 
      ['അസുഖം', 'വേദന', 'നെഞ്ചുവേദന', 'തലവേദന', 'ചക്കരം', 'സഹായം', 'അപകടം'] :
      ['emergency', 'help', 'chest pain', 'heart attack', 'stroke', 'fall', 'cant breathe', 'severe pain'];
    
    const healthKeywords = language === 'ml' ? 
      ['മരുന്ന്', 'ആരോഗ്യം', 'ബുദ്ധിമുട്ട്', 'സുഖമില്ല', 'ക്ഷീണം'] :
      ['medication', 'medicine', 'not feeling well', 'sick', 'tired', 'dizzy', 'nauseous'];

    const isEmergency = emergencyKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase()));
    
    const isHealthConcern = healthKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase()));

    return {
      isEmergency,
      isHealthConcern,
      confidence: 0.8,
      keywords: isEmergency ? emergencyKeywords : (isHealthConcern ? healthKeywords : [])
    };
  };

  const handleEmergencyResponse = async (transcript: string, language: 'en' | 'ml', analysis: any) => {
    const emergencyResponse = language === 'ml' ? 
      "ഞാൻ മനസ്സിലാക്കി, ഇത് ഗുരുതരമായ കാര്യമാണ്. ദയവായി ശാന്തമായിരിക്കുക. ഞാൻ ഉടനെ നിങ്ങളുടെ കുടുംബത്തെയും ഡോക്ടറെയും വിളിക്കുന്നു. നിങ്ങൾ സുരക്ഷിതമായ സ്ഥലത്ത് ഇരിക്കുക." :
      "I understand this is serious. Please try to stay calm. I'm immediately notifying your family and doctor. Please sit in a safe place and breathe slowly.";

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: emergencyResponse,
      isUser: false,
      timestamp: new Date(),
      isEmergency: true,
      confidence: analysis.confidence
    };

    setMessages(prev => [...prev, assistantMessage]);
    
    // Save to database and notify family first
    await saveIssueReport({
      senior_id: 'current_user', // Replace with actual user ID
      issue_type: 'emergency',
      description: `Emergency detected: ${transcript}`,
      voice_transcript: transcript,
      ai_response: emergencyResponse,
      confidence_level: analysis.confidence,
      language: language
    });

    await notifyFamily('emergency', transcript, emergencyResponse);
    
    toast.error(language === 'ml' ? '🚨 അപകടാവസ്ഥ! കുടുംബത്തെ അറിയിച്ചു.' : '🚨 Emergency! Family notified.');

    // Speak response and restart recognition when done
    speakResponse(emergencyResponse, language, () => {
      setTimeout(() => {
        if (conversationActive && recognition) {
          try {
            console.log('🔄 Restarting recognition after emergency response...');
            recognition.start();
          } catch (error) {
            console.log('⚠️ Could not restart after emergency response:', error);
          }
        }
      }, 1000);
    });
  };

  const handleHealthConcernResponse = async (transcript: string, language: 'en' | 'ml', analysis: any) => {
    if (!genAI) {
      const errorMsg = language === 'ml' ? 'AI സഹായി ലഭ്യമല്ല.' : 'AI assistant unavailable.';
      toast.error(errorMsg);
      return;
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const prompt = language === 'ml' ? 
        `നിങ്ങൾ ഒരു കരുണയുള്ള ആരോഗ്യ സഹായിയാണ്. ഉപയോക്താവ് പറഞ്ഞത്: "${transcript}"

        ഇത് ഒരു ആരോഗ്യ ആശങ്കയാണ്. ദയവായി:
        1. കരുണയോടെ പ്രതികരിക്കുക
        2. അവരുടെ ഭാവനകളെ ശാന്തപ്പെടുത്തുക
        3. ലളിതമായ ഉപദേശം നൽകുക
        4. ആവശ്യമെങ്കിൽ ഡോക്ടറെ ബന്ധപ്പെടാൻ പറയുക
        5. അവരോട് കൂടുതൽ വിശദാംശങ്ങൾ ചോദിക്കുക
        
        സംഭാഷണാത്മകമായി മറുപടി നൽകുക, കൂടുതൽ ചോദ്യങ്ങൾ ചോദിക്കുക.` :
        `You are a caring health assistant. The user said: "${transcript}"

        This is a health concern. Please:
        1. Respond with empathy
        2. Reassure their worries
        3. Provide gentle advice
        4. Suggest contacting a doctor if needed
        5. Ask follow-up questions to understand more
        
        Respond conversationally and ask more questions to help them.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
        confidence: analysis.confidence
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save health concern to database
      await saveIssueReport({
        senior_id: 'current_user',
        issue_type: 'health_concern',
        description: `Health concern: ${transcript}`,
        voice_transcript: transcript,
        ai_response: response,
        confidence_level: analysis.confidence,
        language: language
      });

      // Speak response and restart recognition when done
      speakResponse(response, language, () => {
        setTimeout(() => {
          if (conversationActive && recognition) {
            try {
              console.log('🔄 Restarting recognition after health response...');
              recognition.start();
            } catch (error) {
              console.log('⚠️ Could not restart after health response:', error);
            }
          }
        }, 1000);
      });

    } catch (error) {
      console.error('Error with health concern response:', error);
      const fallback = language === 'ml' ? 
        "ക്ഷമിക്കണം, എനിക്ക് പ്രശ്നമുണ്ട്. നിങ്ങളുടെ ആരോഗ്യത്തെക്കുറിച്ച് വിഷമിക്കുന്നു. ദയവായി ഡോക്ടറെ വിളിക്കുക." :
        "Sorry, I'm having trouble. I'm concerned about your health. Please call your doctor.";
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: fallback,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak fallback response and restart recognition when done
      speakResponse(fallback, language, () => {
        setTimeout(() => {
          if (conversationActive && recognition) {
            try {
              console.log('🔄 Restarting recognition after health fallback...');
              recognition.start();
            } catch (error) {
              console.log('⚠️ Could not restart after health fallback:', error);
            }
          }
        }, 1000);
      });
    }
  };

  const handleNormalConversation = async (transcript: string, language: 'en' | 'ml', analysis: any) => {
    if (!genAI) {
      const errorMsg = language === 'ml' ? 'AI സഹായി ലഭ്യമല്ല.' : 'AI assistant unavailable.';
      toast.error(errorMsg);
      return;
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // Get conversation history for context
      const recentMessages = messages.slice(-4).map(m => 
        `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`
      ).join('\n');
      
      const prompt = language === 'ml' ? 
        `നിങ്ങൾ ഒരു സൗഹൃദപരമായ വീട്ടിലെ സഹായിയാണ്. നിങ്ങൾ പ്രായമായവരോട് കരുണയോടെ സംസാരിക്കുന്നു.

        സമീപകാല സംഭാഷണം:
        ${recentMessages}
        
        ഉപയോക്താവ് ഇപ്പോൾ പറഞ്ഞത്: "${transcript}"

        ദയവായി:
        - സംഭാഷണാത്മകമായി മറുപടി നൽകുക
        - കൂടുതൽ ചോദ്യങ്ങൾ ചോദിക്കുക
        - അവരുടെ താൽപ്പര്യങ്ങളെക്കുറിച്ച് അറിയുക
        - സഹായകരമായ നിർദ്ദേശങ്ങൾ നൽകുക
        - കുടുംബത്തിലെ അംഗത്തെപ്പോലെ സംസാരിക്കുക
        
        ചെറുതും സൗഹാർദ്ദപരവുമായ മറുപടി നൽകുക.` :
        `You are a friendly home assistant. You speak warmly with seniors like a caring family member.

        Recent conversation:
        ${recentMessages}
        
        User just said: "${transcript}"

        Please:
        - Respond conversationally
        - Ask follow-up questions
        - Show interest in their life
        - Offer helpful suggestions
        - Talk like a caring family member
        
        Keep response short and friendly.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
        confidence: analysis.confidence
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save general conversation
      await saveIssueReport({
        senior_id: 'current_user',
        issue_type: 'general',
        description: `Conversation: ${transcript}`,
        voice_transcript: transcript,
        ai_response: response,
        confidence_level: analysis.confidence,
        language: language
      });

      // Speak response and restart recognition when done
      speakResponse(response, language, () => {
        setTimeout(() => {
          if (conversationActive && recognition) {
            try {
              console.log('🔄 Restarting recognition after normal conversation...');
              recognition.start();
            } catch (error) {
              console.log('⚠️ Could not restart after normal conversation:', error);
            }
          }
        }, 1000);
      });

    } catch (error) {
      console.error('Error with conversation:', error);
      const fallback = language === 'ml' ? 
        "ക്ഷമിക്കണം, എനിക്ക് കേൾക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും പറയാമോ?" :
        "Sorry, I didn't catch that. Could you say that again?";
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: fallback,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak fallback response and restart recognition when done
      speakResponse(fallback, language, () => {
        setTimeout(() => {
          if (conversationActive && recognition) {
            try {
              console.log('🔄 Restarting recognition after conversation fallback...');
              recognition.start();
            } catch (error) {
              console.log('⚠️ Could not restart after conversation fallback:', error);
            }
          }
        }, 1000);
      });
    }
  };

  const saveIssueReport = async (report: IssueReport) => {
    try {
      const { data, error } = await supabase
        .from('issue_reports')
        .insert([report]);

      if (error) {
        console.error('Error saving issue report:', error);
        return null;
      }

      console.log('Issue report saved:', data);
      return data;
    } catch (error) {
      console.error('Failed to save issue report:', error);
      return null;
    }
  };

  const notifyFamily = async (type: string, transcript: string, response: string) => {
    try {
      // Get emergency contacts
      const { data: contacts, error: contactError } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('senior_id', 'current_user');

      if (contactError) {
        console.error('Error fetching contacts:', contactError);
        return;
      }

      // Create notification for each contact
      const notifications = contacts?.map(contact => ({
        contact_id: contact.id,
        senior_id: 'current_user',
        notification_type: type,
        message: `${contact.name}, urgent alert from your senior: "${transcript}". AI response: "${response}"`,
        is_emergency: type === 'emergency',
        sent_at: new Date().toISOString()
      })) || [];

      if (notifications.length > 0) {
        const { error: notifyError } = await supabase
          .from('family_notifications')
          .insert(notifications);

        if (notifyError) {
          console.error('Error sending notifications:', notifyError);
        } else {
          console.log('Family notifications sent successfully');
        }
      }

    } catch (error) {
      console.error('Failed to notify family:', error);
    }
  };

  const speakResponse = (text: string, language: 'en' | 'ml' = currentLanguage, onFinished?: () => void) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.7; // Slower for seniors
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = language === 'ml' ? 'ml-IN' : 'en-US';
      
      // Add event listeners to track speech completion
      utterance.onend = () => {
        console.log('🗣️ Speech synthesis finished');
        if (onFinished) {
          onFinished();
        }
      };
      
      utterance.onerror = (event) => {
        console.error('🗣️ Speech synthesis error:', event.error);
        if (onFinished) {
          onFinished();
        }
      };
      
      console.log('🗣️ Starting speech synthesis:', text.substring(0, 50) + '...');
      speechSynthesis.speak(utterance);
    } else if (onFinished) {
      // If speech synthesis not available, call callback immediately
      onFinished();
    }
  };

  const startListening = () => {
    if (recognition && !isListening) {
      try {
        console.log('👤 Manual start listening');
        
        // Clear any pending restart timers
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
        
        setManuallyControlled(false); // Allow auto-restart after manual start
        recognition.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        toast.error('Failed to start voice recognition.');
      }
    }
  };

  const stopListening = () => {
    if (recognition) {
      try {
        console.log('👤 Manual stop listening');
        
        // Immediately set manual control to prevent auto-restart
        setManuallyControlled(true);
        setConversationActive(false);
        
        // Clear any pending restart timers
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = null;
        }
        
        // Stop recognition if it's running
        if (isListening) {
          recognition.stop();
        }
        
        // Force set listening to false
        setIsListening(false);
        setCurrentTranscript('');
        
        toast.success('🔇 Voice assistant stopped');
      } catch (error) {
        console.error('Failed to stop recognition:', error);
      }
    }
  };

  return (
    <div className="h-[500px] flex flex-col bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${conversationActive ? 'bg-green-100' : 'bg-gray-100'}`}>
              <MessageSquare className={`w-5 h-5 ${conversationActive ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Voice Assistant</h3>
              <p className="text-sm text-gray-600">
                {conversationActive ? 'Active conversation' : 'Say "Hey Google" to start'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isListening && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-red-600">Listening</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <Heart className="w-16 h-16 mx-auto mb-4 text-blue-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">I'm here to help!</h3>
            <p className="text-gray-500 mb-2">Just say "Hey Google" or "Hello" to start talking</p>
            <p className="text-sm text-gray-400">Ask about your health, medications, or just chat!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.isUser
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : message.isEmergency
                    ? 'bg-red-100 text-red-800 border border-red-300 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs ${
                    message.isUser ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                  {message.confidence && (
                    <span className="text-xs opacity-75">
                      {Math.round(message.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-blue-200 text-blue-800 rounded-br-sm">
              <p className="text-sm italic">{currentTranscript}</p>
              <p className="text-xs text-blue-600 mt-1">Speaking...</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-gray-100 rounded-bl-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {/* Language Toggle */}
        <div className="flex justify-center mb-3">
          <div className="bg-white rounded-lg p-1 flex shadow-sm">
            <button
              onClick={() => {
                console.log('🌐 Language changed to English');
                setCurrentLanguage('en');
              }}
              disabled={isProcessing}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                currentLanguage === 'en'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              English
            </button>
            <button
              onClick={() => {
                console.log('🌐 Language changed to Malayalam');
                setCurrentLanguage('ml');
              }}
              disabled={isProcessing}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                currentLanguage === 'ml'
                  ? 'bg-blue-500 text-white'
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
            disabled={isProcessing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Listening
              </>
            )}
          </button>

          {conversationActive && (
            <button
              onClick={endConversation}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-gray-500 hover:bg-gray-600 text-white transition-all duration-300"
            >
              <Phone className="w-4 h-4" />
              End Chat
            </button>
          )}
        </div>

        <div className="text-center mt-3">
          <p className="text-xs text-gray-500">
            {conversationActive ? (
              "🟢 In conversation - speak normally"
            ) : isListening ? (
              "🎤 Listening for \"Hey Google\" or \"Hello\""
            ) : (
              "⏸️ Voice assistant paused"
            )}
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-1">
          💡 Tip: Voice recognition works best in quiet environments
        </p>
      </div>
    </div>
  );
} 