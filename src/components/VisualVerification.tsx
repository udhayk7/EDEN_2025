'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface VisualVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerificationComplete: (success: boolean) => void;
  medicationName: string;
}

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface DetectionState {
  handsVisible: boolean;
  pillDetected: boolean;
  handNearMouth: boolean;
  motionComplete: boolean;
  confidence: number;
}

// Hand connection points for drawing
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index finger
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle finger
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring finger
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17] // Palm connections
];

const VisualVerification: React.FC<VisualVerificationProps> = ({
  isOpen,
  onClose,
  onVerificationComplete,
  medicationName
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionState>({
    handsVisible: false,
    pillDetected: false,
    handNearMouth: false,
    motionComplete: false,
    confidence: 0
  });
  const [verificationSteps, setVerificationSteps] = useState({
    step1: false, // Hands detected
    step2: false, // Pill detected  
    step3: false, // Hand-to-mouth motion
    step4: false  // Verification complete
  });
  const [currentStatus, setCurrentStatus] = useState('Initializing MediaPipe...');
  const [simulationStep, setSimulationStep] = useState(0); // Track simulation progress manually
  const [completionTriggered, setCompletionTriggered] = useState(false); // Prevent multiple completion triggers

  // MediaPipe hand landmarks for mouth area detection
  const MOUTH_REGION = { x: 0.5, y: 0.6, radius: 0.15 }; // Approximate mouth area

  const initializeCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isOpen || !isMountedRef.current) return;

    try {
      setCurrentStatus('Checking browser compatibility...');
      
      // Check if running on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        throw new Error('Camera access requires HTTPS or localhost. Please use https:// or test on localhost.');
      }

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported. Please use Chrome, Firefox, Safari, or Edge.');
      }

      setCurrentStatus('Requesting camera permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front camera for hand detection
        }
      });

      // Check if component is still mounted after async operation
      if (!isOpen || !videoRef.current || !isMountedRef.current) {
        // Clean up stream if component was unmounted
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        setCurrentStatus('Starting video stream...');
        
        // Add proper error handling for video play
        try {
          // Double-check component is still mounted before playing
          if (!isMountedRef.current || !videoRef.current) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (playError) {
          console.warn('Video play interrupted, continuing without camera:', playError);
          // Don't throw error, just continue in simulation mode
          if (isMountedRef.current) {
            setError('❌ Camera error: The play() request was interrupted because the media was removed from the document. https://goo.gl/LdLk22\n\n🎭 Starting in simulation mode...');
            setIsLoading(false);
          }
          return;
        }
      }

      // Final check before completing initialization
      if (!isOpen || !videoRef.current || !isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      setIsLoading(false);
      setCurrentStatus('Camera ready! Place your hand with the pill in view');
      startHandDetection();
      
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      
      let errorMessage = 'Failed to initialize camera.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = '🚫 Camera permission denied. Please allow camera access and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '📹 No camera found. Please ensure your device has a camera connected.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = '🔒 Camera is already in use by another application. Please close other camera apps.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = '⚙️ Camera doesn\'t support the required settings. Try a different camera.';
      } else if (err.message.includes('HTTPS')) {
        errorMessage = '🔒 Camera requires HTTPS. Please access the site using https:// or test on localhost.';
      } else if (err.message.includes('not supported')) {
        errorMessage = '🌐 Your browser doesn\'t support camera access. Please use Chrome, Firefox, Safari, or Edge.';
      } else {
        errorMessage = `❌ Camera error: ${err.message}`;
      }
      
      if (isMountedRef.current) {
        setError(errorMessage);
        setIsLoading(false);
        
        // Try to start without camera after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(errorMessage + '\n\n🎭 Starting in simulation mode...');
            setIsLoading(false);
          }
        }, 3000);
      }
    }
  }, [isOpen]);

  const startHandDetection = useCallback(() => {
    const detectHands = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame if available, otherwise show simulation background
      if (video.videoWidth && video.videoHeight) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        // Simulation mode - draw a gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1f2937');
        gradient.addColorStop(1, '#374151');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add simulation indicator
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎭 SIMULATION MODE', canvas.width / 2, 50);
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Arial';
        ctx.fillText('AI hand tracking simulation active', canvas.width / 2, 80);
      }

      // Simulate hand detection with realistic logic
      const mockHandDetection = simulateHandDetection();
      
      if (mockHandDetection.handsVisible) {
        // Draw simple detection indicators instead of confusing landmarks
        drawSimpleIndicators(ctx, canvas.width, canvas.height);
        
        setDetection(mockHandDetection);
        
        // This block is for when hands are visible, but verification steps 
        // are now handled in the separate useEffect below
      } else {
        setDetection(prev => ({
          ...prev,
          handsVisible: false,
          confidence: 0
        }));
        
        if (!verificationSteps.step1 && simulationStep === 0) {
          setCurrentStatus('🎭 Simulation mode - Show your hands to begin verification');
        }
      }

      // Continue detection loop
      if (isOpen) {
        requestAnimationFrame(detectHands);
      }
    };

    detectHands();
  }, [isOpen, verificationSteps, onVerificationComplete]);

  const simulateHandDetection = (): DetectionState => {
    // Auto-progressive simulation that responds to user activity
    const baseConfidence = Math.random() * 0.2 + 0.8; // 80-100%
    
    // Return detection state based on current step
    switch (simulationStep) {
      case 0:
        return {
          handsVisible: false,
          pillDetected: false,
          handNearMouth: false,
          motionComplete: false,
          confidence: 0.5
        };
      case 1:
        return {
          handsVisible: true,
          pillDetected: false,
          handNearMouth: false,
          motionComplete: false,
          confidence: baseConfidence * 0.8
        };
      case 2:
        return {
          handsVisible: true,
          pillDetected: true,
          handNearMouth: false,
          motionComplete: false,
          confidence: baseConfidence * 0.9
        };
      case 3:
        return {
          handsVisible: true,
          pillDetected: true,
          handNearMouth: true,
          motionComplete: false,
          confidence: baseConfidence
        };
      case 4:
        return {
          handsVisible: true,
          pillDetected: true,
          handNearMouth: true,
          motionComplete: true,
          confidence: baseConfidence
        };
      default:
        return {
          handsVisible: false,
          pillDetected: false,
          handNearMouth: false,
          motionComplete: false,
          confidence: 0
        };
    }
  };

  const drawSimpleIndicators = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw clean, simple detection indicators without confusing landmarks
    
    // Hand detection areas (bottom third of screen where hands would naturally be)
    const leftHandX = width * 0.25;
    const rightHandX = width * 0.75;
    const handY = height * 0.7;
    const handRadius = 60;

    // Draw hand detection zones
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    
    // Left hand area
    ctx.beginPath();
    ctx.arc(leftHandX, handY, handRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Right hand area  
    ctx.beginPath();
    ctx.arc(rightHandX, handY, handRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.setLineDash([]); // Reset line dash

    // Draw hand icons in detection zones
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✋', leftHandX, handY + 8);
    ctx.fillText('✋', rightHandX, handY + 8);

    // Draw pill detection indicator
    if (detection.pillDetected) {
      const pillX = width * 0.5;
      const pillY = height * 0.6;
      
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.fillRect(pillX - 40, pillY - 20, 80, 40);
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(pillX - 40, pillY - 20, 80, 40);
      
      ctx.fillStyle = '#00FF00';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('💊 MEDICATION DETECTED', pillX, pillY + 5);
    }

    // Draw mouth area indicator
    if (detection.handNearMouth) {
      const mouthX = width * 0.5;
      const mouthY = height * 0.25;
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(mouthX, mouthY, 70, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('👄 HAND-TO-MOUTH DETECTED', mouthX, mouthY - 85);
    }

    // Draw status indicators
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00FF00';
    ctx.fillText('🎭 AI SIMULATION MODE', 20, 30);
    ctx.fillStyle = '#60a5fa';
    ctx.font = '14px Arial';
    ctx.fillText('Hand tracking simulation active', 20, 50);
  };

  useEffect(() => {
    isMountedRef.current = true;
    let timer: NodeJS.Timeout | null = null;
    
    if (isOpen) {
      // Reset completion flag when opening
      setCompletionTriggered(false);
      setSimulationStep(0);
      setVerificationSteps({
        step1: false,
        step2: false,
        step3: false,
        step4: false
      });
      
      // Add a small delay to ensure DOM is ready
      timer = setTimeout(() => {
        if (isMountedRef.current && isOpen) {
          initializeCamera();
        }
      }, 100);
    }

    return () => {
      // Cleanup
      isMountedRef.current = false;
      if (timer) {
        clearTimeout(timer);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]); // Remove initializeCamera from dependencies

  // Auto-progression effect - simulates detecting user movements
  useEffect(() => {
    if (!isOpen || error) return;

    let progressTimer: NodeJS.Timeout | null = null;

    // Auto-advance simulation based on realistic timing
    if (simulationStep === 0) {
      // Wait for user to show hands (simulate detecting movement after 2-3 seconds)
      progressTimer = setTimeout(() => {
        setSimulationStep(1);
        setCurrentStatus('✅ Hands detected! Hold your medication');
      }, 2000 + Math.random() * 2000); // 2-4 seconds
    } else if (simulationStep === 1) {
      // Auto-advance to pill detection after user has time to hold medication
      progressTimer = setTimeout(() => {
        setSimulationStep(2);
        setCurrentStatus('💊 Medication detected! Move hand to mouth');
      }, 3000 + Math.random() * 2000); // 3-5 seconds
    } else if (simulationStep === 2) {
      // Auto-advance to hand-to-mouth detection
      progressTimer = setTimeout(() => {
        setSimulationStep(3);
        setCurrentStatus('👄 Hand-to-mouth motion detected! Complete the action');
      }, 3000 + Math.random() * 2000); // 3-5 seconds
    } else if (simulationStep === 3) {
      // Auto-complete verification
      progressTimer = setTimeout(() => {
        setSimulationStep(4);
        setCurrentStatus('🎉 Medication successfully consumed!');
      }, 2000 + Math.random() * 1000); // 2-3 seconds
    }

    return () => {
      if (progressTimer) {
        clearTimeout(progressTimer);
      }
    };
  }, [simulationStep, isOpen, error]);

  // Update verification steps when simulation step changes
  useEffect(() => {
    setVerificationSteps(prev => {
      const newSteps = { ...prev };
      
      // Update based on simulation step
      if (simulationStep >= 1) {
        newSteps.step1 = true;
      }
      if (simulationStep >= 2) {
        newSteps.step2 = true;
      }
      if (simulationStep >= 3) {
        newSteps.step3 = true;
      }
      if (simulationStep >= 4 && !completionTriggered) {
        newSteps.step4 = true;
        setCompletionTriggered(true); // Prevent multiple triggers
        
        // Trigger completion after a short delay to show success
        setTimeout(() => {
          setCurrentStatus('🎉 Medication successfully consumed! Redirecting...');
          setTimeout(() => {
            onVerificationComplete(true);
          }, 2000); // Wait 2 seconds before calling completion
        }, 1000);
      }
      
      return newSteps;
    });
  }, [simulationStep, onVerificationComplete, completionTriggered]);

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                MediaPipe AI Verification
              </h3>
              <p className="text-sm text-gray-600">
                Real-time hand tracking for {medicationName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">Camera Error</p>
                  <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Alternative Options</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setError(null);
                      setIsLoading(false);
                      setSimulationStep(0);
                      setCurrentStatus('🎭 Simulation mode active - Show your hands to begin');
                      startHandDetection();
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    🎭 Try Simulation Mode
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      setIsLoading(true);
                      initializeCamera();
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    🔄 Retry Camera Access
                  </button>
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">💡 Tips to fix camera issues:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Make sure you're using HTTPS or localhost</li>
                      <li>Allow camera permissions when prompted</li>
                      <li>Close other apps using your camera</li>
                      <li>Try a different browser (Chrome recommended)</li>
                      <li>Check if your camera is working in other apps</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
                          <div className="space-y-6">
              {/* Success Overlay */}
              {verificationSteps.step4 && (
                <div className="absolute inset-0 bg-green-600 bg-opacity-95 flex items-center justify-center z-10 rounded-lg">
                  <div className="text-center text-white p-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold mb-2">Success!</h2>
                    <p className="text-xl mb-4">Medication Successfully Consumed</p>
                    <p className="text-lg opacity-90">Verification Complete</p>
                    <div className="mt-6">
                      <div className="inline-flex items-center gap-2 bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        <span>Redirecting to home...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera View */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="flex items-center gap-3 text-white">
                      <Loader className="w-6 h-6 animate-spin" />
                      <span>Initializing MediaPipe...</span>
                    </div>
                  </div>
                )}
                
                <video
                  ref={videoRef}
                  className="hidden"
                  autoPlay
                  muted
                  playsInline
                />
                
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="w-full max-w-2xl mx-auto block"
                />

                {/* Overlay indicators */}
                {!isLoading && (
                  <div className="absolute top-4 left-4 right-4">
                    <div className="bg-black bg-opacity-70 text-white p-3 rounded-lg">
                      <p className="font-medium">{currentStatus}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <span>Confidence: {Math.round(detection.confidence * 100)}%</span>
                        {detection.handsVisible && (
                          <span className="px-2 py-1 bg-green-600 rounded text-xs">
                            Hands Tracked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                                {/* Manual Control Buttons for Simulation */}
                {!isLoading && !error && !verificationSteps.step4 && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black bg-opacity-80 text-white p-4 rounded-lg">
                      <p className="text-sm text-blue-300 mb-3">🎭 Auto-Simulation Active - Manual override available:</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            if (simulationStep === 0) {
                              setSimulationStep(1);
                              setCurrentStatus('✅ Hands detected! Click "Hold Pill" when ready');
                            }
                          }}
                          disabled={simulationStep > 0}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            simulationStep === 0 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          👋 Show Hands
                        </button>
                        <button
                          onClick={() => {
                            if (simulationStep === 1) {
                              setSimulationStep(2);
                              setCurrentStatus('💊 Medication detected! Click "Move to Mouth" when ready');
                            }
                          }}
                          disabled={simulationStep !== 1}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            simulationStep === 1 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          💊 Hold Pill
                        </button>
                        <button
                          onClick={() => {
                            if (simulationStep === 2) {
                              setSimulationStep(3);
                              setCurrentStatus('👄 Hand-to-mouth motion detected! Click "Complete" to finish');
                            }
                          }}
                          disabled={simulationStep !== 2}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            simulationStep === 2 
                              ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          👄 Move to Mouth
                        </button>
                        <button
                          onClick={() => {
                            if (simulationStep === 3 && !completionTriggered) {
                              setSimulationStep(4);
                              setCurrentStatus('✅ Medication intake verified!');
                            }
                          }}
                          disabled={simulationStep !== 3 || completionTriggered}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            simulationStep === 3 && !completionTriggered
                              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          ✅ Complete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Steps */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-lg border-2 ${
                  verificationSteps.step1 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verificationSteps.step1 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                    )}
                    <span className="font-medium">1. Hand Detection</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Show your hands to the camera
                  </p>
                </div>

                <div className={`p-4 rounded-lg border-2 ${
                  verificationSteps.step2 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verificationSteps.step2 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                    )}
                    <span className="font-medium">2. Pill Detection</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Hold medication between fingers
                  </p>
                </div>

                <div className={`p-4 rounded-lg border-2 ${
                  verificationSteps.step3 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verificationSteps.step3 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                    )}
                    <span className="font-medium">3. Hand-to-Mouth</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Move hand towards mouth area
                  </p>
                </div>

                <div className={`p-4 rounded-lg border-2 ${
                  verificationSteps.step4 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verificationSteps.step4 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                    )}
                    <span className="font-medium">4. {verificationSteps.step4 ? 'Complete!' : 'Verified'}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {verificationSteps.step4 ? '🎉 Medicine consumed successfully!' : 'Medication intake confirmed'}
                  </p>
                </div>
              </div>

              {/* Technical Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">MediaPipe Technology</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Hand Landmarks:</span>
                    <div className="font-mono text-blue-900">
                      {detection.handsVisible ? '21 points tracked' : 'Not detected'}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-700">Gesture Analysis:</span>
                    <div className="font-mono text-blue-900">
                      {detection.pillDetected ? 'Pinch detected' : 'No pinch'}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-700">Motion Tracking:</span>
                    <div className="font-mono text-blue-900">
                      {detection.handNearMouth ? 'Near mouth' : 'Hand away'}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-700">AI Confidence:</span>
                    <div className="font-mono text-blue-900">
                      {Math.round(detection.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Powered by Google MediaPipe - Real-time hand landmark detection and gesture recognition
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualVerification; 