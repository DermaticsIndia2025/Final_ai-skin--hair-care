import React, { useRef, useState, useEffect } from 'react';
import { CameraIcon } from './icons';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Camera access is not available. This usually happens if you are not using HTTPS or if your device doesn't have a camera.");
            return;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: false 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please ensure you have granted permission and are using a secure connection (HTTPS).");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCapture = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Flip if using front camera (optional, but mirrors usually expected)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    onClose();
                }
            }, 'image/jpeg', 0.9);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="relative w-full h-full flex flex-col">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="text-white p-2 bg-gray-800 rounded-full opacity-70 hover:opacity-100">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error ? (
                    <div className="flex-1 flex items-center justify-center text-white px-4 text-center">
                        <p>{error}</p>
                    </div>
                ) : (
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className="absolute w-full h-full object-cover transform -scale-x-100" 
                        />
                    </div>
                )}

                <div className="h-24 bg-black flex items-center justify-center">
                    <button 
                        onClick={handleCapture}
                        className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-full bg-white border-2 border-black"></div>
                    </button>
                </div>
            </div>
        </div>
    );
};
