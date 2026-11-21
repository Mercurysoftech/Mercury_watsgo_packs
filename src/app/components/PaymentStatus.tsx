import { CheckCircle2, XCircle, ArrowRight, Home, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PaymentStatusProps {
    status: 'success' | 'failure';
    message?: string;
    onNavigateHome: () => void;
    isSubscriptionActive?: boolean;
    onRefreshStatus?: () => void;
}

export function PaymentStatus({ status, message, onNavigateHome, isSubscriptionActive, onRefreshStatus }: PaymentStatusProps) {
    const isSuccess = status === 'success';
    const [verificationTime, setVerificationTime] = useState(0);

    useEffect(() => {
        if (isSuccess && !isSubscriptionActive) {
            const timer = setInterval(() => {
                setVerificationTime(t => t + 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isSuccess, isSubscriptionActive]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
            <div className={`mb-6 p-4 rounded-full ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                {isSuccess ? (
                    <CheckCircle2 className="w-16 h-16 text-green-600" />
                ) : (
                    <XCircle className="w-16 h-16 text-red-600" />
                )}
            </div>

            <h1 className={`text-3xl font-bold mb-2 ${isSuccess ? 'text-gray-800' : 'text-gray-800'}`}>
                {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
            </h1>

            <p className="text-gray-600 text-lg max-w-md mb-4">
                {message || (isSuccess
                    ? 'Your premium subscription has been activated. You can now access all features.'
                    : 'We could not process your payment. Please try again or contact support if the issue persists.')}
            </p>

            {isSuccess && !isSubscriptionActive && (
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Verifying account status... ({verificationTime}s)</span>
                    </div>
                    <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
                        <p className="text-sm text-blue-800 leading-relaxed">
                            This usually takes 10-15 seconds. Please wait while we confirm your subscription activation. Do NOT close this page or navigate away.
                        </p>
                    </div>
                    <button
                        onClick={onRefreshStatus}
                        className="text-sm text-blue-600 hover:text-blue-700 font-semibold underline mt-2"
                    >
                        Manual Refresh
                    </button>
                </div>
            )}

            {isSuccess && isSubscriptionActive && (
                <div className="mb-8 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 font-medium animate-bounce flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>✨ Account Activated Successfully! ✨</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={onNavigateHome}
                    disabled={isSuccess && !isSubscriptionActive}
                    className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg ${isSuccess && isSubscriptionActive
                            ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                            : isSuccess && !isSubscriptionActive
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-800 text-white hover:bg-gray-900'
                        }`}
                >
                    <Home className="w-5 h-5" />
                    <span>
                        {isSuccess && !isSubscriptionActive ? 'Waiting for verification...' : 'Go to Dashboard'}
                    </span>
                </button>

                {!isSuccess && (
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                    >
                        <span>Try Again</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                )}
            </div>

            {isSuccess && (
                <p className="mt-8 text-sm text-gray-500">
                    A confirmation message has been sent to your registered mobile number.
                </p>
            )}
        </div>
    );
}
