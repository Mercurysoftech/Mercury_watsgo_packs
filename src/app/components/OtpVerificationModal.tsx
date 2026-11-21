import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, X, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';

interface OtpVerificationModalProps {
  isOpen: boolean;
  email: string;
  onVerify: (otp: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function OtpVerificationModal({ isOpen, email, onVerify, onCancel, isLoading = false }: OtpVerificationModalProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [isInitialSendDone, setIsInitialSendDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError('');
      setCountdown(60);
      
      // Auto-send OTP when modal opens the first time
      if (!isInitialSendDone && email) {
        handleSendOtp();
        setIsInitialSendDone(true);
      }
    } else {
      setIsInitialSendDone(false);
    }
  }, [isOpen, email]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  const handleSendOtp = async () => {
    try {
      setIsSending(true);
      setError('');
      await authAPI.sendOtp({ email });
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    onVerify(otp);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="relative p-6">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Verify Your Email</h2>
            <p className="text-gray-500 mt-2 text-sm">
              We've sent a 6-digit verification code to
              <br />
              <span className="font-semibold text-gray-800">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Enter Verification Code
              </label>
              <input
                id="otp"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className={`w-full text-center tracking-[0.5em] text-3xl font-bold px-4 py-4 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`}
                placeholder="000000"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={otp.length !== 6 || isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Verify & Continue
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={countdown > 0 || isSending}
                className="w-full py-3 text-sm font-medium text-gray-600 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? 'Sending...' : countdown > 0 ? `Resend Code in ${countdown}s` : 'Resend Verification Code'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
