import { useState, FormEvent } from 'react';
import { Shield, User as UserIcon, Mail, Building2, Save, X } from 'lucide-react';
import { User, UserRole } from '../types';
import { OtpVerificationModal } from './OtpVerificationModal';

interface AddEditUserProps {
  user: User | null;
  onSave: (userData: Omit<User, 'id'> | User) => void;
  onCancel: () => void;
  isSubscriptionActive?: boolean;
}

export function AddEditUser({ user, onSave, onCancel, isSubscriptionActive = true }: AddEditUserProps) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'staff');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [password, setPassword] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!user && !password) {
      alert('Please set a password for the new user');
      return;
    }

    const userData = {
      ...(user && { id: user.id }),
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      businessName: businessName.trim() || undefined,
      password: password || undefined
    };

    // Require OTP if adding a new user
    if (!user) {
      setShowOtpModal(true);
    } else {
      onSave(userData);
    }
  };

  const handleOtpVerify = (otp: string) => {
    const userData = {
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      businessName: businessName.trim() || undefined,
      password: password || undefined,
      otp
    };
    onSave(userData as any);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">
          {user ? 'Edit User' : 'Add New User'}
        </h1>
        <p className="text-gray-600">
          {user ? 'Update user information' : 'Create a new user account'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
        <div className="space-y-6">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Password (only for new users) */}
          {!user && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                minLength={6}
              />
              <p className="mt-2 text-xs text-gray-500">Password must be at least 6 characters</p>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              User Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Admin Role */}
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${role === 'admin'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role === 'admin' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                    <Shield className={`w-5 h-5 ${role === 'admin' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-1 ${role === 'admin' ? 'text-green-700' : 'text-gray-800'
                      }`}>
                      Admin
                    </h4>
                    <p className="text-xs text-gray-600">
                      Full access to all features including user management
                    </p>
                  </div>
                </div>
              </button>

              {/* Staff Role */}
              <button
                type="button"
                onClick={() => setRole('staff')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${role === 'staff'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role === 'staff' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                    <UserIcon className={`w-5 h-5 ${role === 'staff' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-1 ${role === 'staff' ? 'text-green-700' : 'text-gray-800'
                      }`}>
                      Staff
                    </h4>
                    <p className="text-xs text-gray-600">
                      View-only access to dashboard and customer data
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Business Name (Optional) */}
          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
              Business Name (Optional)
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter business name"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            type="submit"
            disabled={!isSubscriptionActive}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save className="w-5 h-5" />
            <span>{user ? 'Update User' : 'Create User'}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
          >
            <X className="w-5 h-5" />
            <span>Cancel</span>
          </button>
        </div>
      </form>

      {/* Info Card */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Permission Levels:</p>
            <ul className="space-y-1 text-green-700">
              <li>• <strong>Admin:</strong> Can manage customers, settings, and users</li>
              <li>• <strong>Staff:</strong> Can view dashboard and customer list only</li>
            </ul>
          </div>
        </div>
      </div>

      <OtpVerificationModal
        isOpen={showOtpModal}
        email={email}
        onVerify={handleOtpVerify}
        onCancel={() => setShowOtpModal(false)}
      />
    </div>
  );
}
