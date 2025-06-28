'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Hand, CheckCircle, XCircle, RotateCcw, Zap, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

interface VisualVerificationProps {
  medicationName: string;
  expectedPillCount?: number;
  onVerificationComplete: (verified: boolean, method: string) => void;
  onClose: () => void;
}

interface DetectionResult {
  confidence: number;
  pillCount: number;
  pillShape: string;
  pillColor: string;
  timestamp: number;
}

export default function VisualVerification({
  medicationName,
  expectedPillCount = 1,
  onVerificationComplete,
  onClose
}: VisualVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'pill' | 'gesture'>('pill');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gestureDetected, setGestureDetected] = useState<string | null>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera stream
  const initializeCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'environment' // Back camera for better pill detection
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreamActive(true);
        toast.success('Camera activated for verification');
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Unable to access camera. Please check permissions.');
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsStreamActive(false);
    }
  }, []);

  // Simulate AI pill detection (in real implementation, this would use TensorFlow.js or similar)
  const analyzePillImage = useCallback(async (imageData: ImageData): Promise<DetectionResult> => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate AI analysis results
    const mockResults: DetectionResult = {
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      pillCount: Math.random() > 0.8 ? expectedPillCount + 1 : expectedPillCount,
      pillShape: ['round', 'oval', 'capsule'][Math.floor(Math.random() * 3)],
      pillColor: ['white', 'blue', 'pink', 'yellow'][Math.floor(Math.random() * 4)],
      timestamp: Date.now()
    };
    
    return mockResults;
  }, [expectedPillCount]);

  // Capture and analyze current frame
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setVerificationProgress(0);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Progress animation
    const progressInterval = setInterval(() => {
      setVerificationProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    
    try {
      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Analyze the image
      const result = await analyzePillImage(imageData);
      setDetectionResult(result);
      setVerificationProgress(100);
      
      // Auto-verify if confidence is high and pill count matches
      if (result.confidence > 0.85 && result.pillCount === expectedPillCount) {
        setTimeout(() => {
          toast.success(`✅ Pill verified! Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          onVerificationComplete(true, 'visual_ai');
        }, 1000);
      } else if (result.pillCount !== expectedPillCount) {
        toast.error(`⚠️ Expected ${expectedPillCount} pill(s), detected ${result.pillCount}`);
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
      clearInterval(progressInterval);
    }
  }, [isAnalyzing, expectedPillCount, analyzePillImage, onVerificationComplete]);

  // Simulate hand-to-mouth tracking for medication taking
  const detectHandToMouthMotion = useCallback(() => {
    const motionPatterns = [
      'hand_near_pill', 
      'hand_lifting', 
      'hand_to_mouth', 
      'medication_taken',
      'no_motion'
    ];
    
    const detected = motionPatterns[Math.floor(Math.random() * motionPatterns.length)];
    setGestureDetected(detected);
    
    // Only approve if the complete pill-to-mouth motion is detected
    if (detected === 'medication_taken') {
      setTimeout(() => {
        toast.success(`✅ Medication taking motion verified! Hand-to-mouth pattern detected.`);
        onVerificationComplete(true, 'hand_to_mouth_tracking');
      }, 1500);
    } else if (detected === 'hand_to_mouth') {
      toast.loading('Detecting medication taking motion... Keep hand near mouth.');
      // Continue tracking for complete motion
      setTimeout(() => {
        if (Math.random() > 0.3) { // 70% chance of completing the motion
          setGestureDetected('medication_taken');
        }
      }, 2000);
    } else if (detected === 'hand_lifting') {
      toast.loading('Hand lifting detected... Move toward mouth to complete verification.');
    } else if (detected === 'hand_near_pill') {
      toast.loading('Hand near medication detected... Lift to mouth to verify.');
    }
  }, [onVerificationComplete]);

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera();
    return () => stopCamera();
  }, [initializeCamera, stopCamera]);

  // Auto-detect hand-to-mouth motion when in gesture mode
  useEffect(() => {
    if (verificationMode === 'gesture' && isStreamActive) {
      const motionInterval = setInterval(() => {
        if (Math.random() > 0.6) { // 40% chance to detect motion every 2 seconds
          detectHandToMouthMotion();
        }
      }, 2000);
      
      return () => clearInterval(motionInterval);
    }
  }, [verificationMode, isStreamActive, detectHandToMouthMotion]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.9) return 'text-green-600';
    if (confidence > 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMotionEmoji = (motion: string) => {
    const motions: Record<string, string> = {
      hand_near_pill: '🤏',
      hand_lifting: '🤚',
      hand_to_mouth: '👄',
      medication_taken: '✅',
      no_motion: '⏸️'
    };
    return motions[motion] || '👋';
  };

  const getMotionDescription = (motion: string) => {
    const descriptions: Record<string, string> = {
      hand_near_pill: 'Hand positioned near medication',
      hand_lifting: 'Hand lifting movement detected',
      hand_to_mouth: 'Hand moving toward mouth',
      medication_taken: 'Medication taking motion completed',
      no_motion: 'No movement detected'
    };
    return descriptions[motion] || 'Unknown motion';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-600" />
                Visual Verification
              </h2>
              <p className="text-gray-600 mt-1">Verify your {medicationName} using AI</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          
          {/* Mode Selection */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setVerificationMode('pill')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center ${
                verificationMode === 'pill'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              Pill Detection
            </button>
            <button
              onClick={() => setVerificationMode('gesture')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center ${
                verificationMode === 'gesture'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Hand className="w-4 h-4" />
              Motion Tracking
            </button>
          </div>
        </div>

        {/* Camera Section */}
        <div className="p-6">
          {cameraError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <Camera className="w-12 h-12 text-red-400 mx-auto mb-2" />
              <p className="text-red-600 font-medium">{cameraError}</p>
              <button
                onClick={initializeCamera}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Camera Access
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Video Stream */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                
                {/* Overlay Instructions */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center text-white">
                    {verificationMode === 'pill' ? (
                      <div>
                        <Zap className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-lg font-medium">Position your pills in the frame</p>
                        <p className="text-sm opacity-80">Expected: {expectedPillCount} pill(s)</p>
                      </div>
                    ) : (
                      <div>
                        <Hand className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-lg font-medium">Take your medication normally</p>
                        <p className="text-sm opacity-80">🤏 Pick up pill → 🤚 Lift hand → 👄 Bring to mouth</p>
                        <p className="text-xs opacity-70 mt-1">AI will track hand-to-mouth motion</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Analysis Progress */}
                {isAnalyzing && (
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-600 h-1">
                    <div 
                      className="bg-blue-400 h-full transition-all duration-300"
                      style={{ width: `${verificationProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Hidden canvas for image processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {/* Results Section */}
        {(detectionResult || gestureDetected) && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Detection Results
              </h3>
              
              {detectionResult && verificationMode === 'pill' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Confidence:</span>
                    <span className={`ml-2 font-semibold ${getConfidenceColor(detectionResult.confidence)}`}>
                      {(detectionResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pills Detected:</span>
                    <span className="ml-2 font-semibold text-gray-800">
                      {detectionResult.pillCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Shape:</span>
                    <span className="ml-2 font-semibold text-gray-800 capitalize">
                      {detectionResult.pillShape}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Color:</span>
                    <span className="ml-2 font-semibold text-gray-800 capitalize">
                      {detectionResult.pillColor}
                    </span>
                  </div>
                </div>
              )}
              
              {gestureDetected && verificationMode === 'gesture' && (
                <div className="text-center">
                  <div className="text-4xl mb-2">{getMotionEmoji(gestureDetected)}</div>
                  <p className="text-lg font-semibold text-gray-800">
                    {getMotionDescription(gestureDetected)}
                  </p>
                  {gestureDetected === 'medication_taken' && (
                    <p className="text-sm text-green-600 mt-1">
                      ✅ Complete pill-to-mouth motion verified!
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex gap-3">
            {verificationMode === 'pill' && (
              <button
                onClick={captureAndAnalyze}
                disabled={!isStreamActive || isAnalyzing}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 justify-center"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Analyze Pills
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={() => onVerificationComplete(true, 'manual_override')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Manually
            </button>
            
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            AI analysis is simulated for demo purposes. In production, this would use real computer vision models.
          </p>
        </div>
      </div>
    </div>
  );
} 