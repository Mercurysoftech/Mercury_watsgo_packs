import { useState } from 'react';
import { Apple } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (data: { email: string; password: any }) => void;
  onNavigateToRegister?: () => void;
}

export function LoginPage({ onLogin, onNavigateToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onLogin({ email: email.trim(), password });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-md border border-gray-100 p-2 overflow-hidden">
              <img src={logoImg} alt="Watsgo Reminders" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Watsgo Reminders</h1>
            <p className="text-gray-500 text-sm mt-1 font-medium tracking-wide">Subscription Manager</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                className={`w-full px-4 py-3 border ${errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`}
                placeholder="Enter your email"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">⚠ {errors.email}</p>}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                className={`w-full px-4 py-3 border ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`}
                placeholder="Enter your password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">⚠ {errors.password}</p>}
            </div>

            <div>
              <label htmlFor="login-role" className="block text-sm font-medium text-gray-700 mb-2">
                Login As
              </label>
              <select
                id="login-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="admin">Admin (Full Access)</option>
                <option value="staff">Staff (View Only)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          {onNavigateToRegister && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={onNavigateToRegister}
                  className="text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  Register here
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
