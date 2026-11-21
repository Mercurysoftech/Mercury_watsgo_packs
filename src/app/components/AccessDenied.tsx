import { ShieldAlert } from 'lucide-react';

interface AccessDeniedProps {
  onNavigateBack: () => void;
}

export function AccessDenied({ onNavigateBack }: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. This feature is only available to administrators.
        </p>
        <button
          onClick={onNavigateBack}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
