import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Toast, { ToastType } from '../components/Toast';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('error', 'Please fill in all required fields.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('error', 'Please enter a valid email address.');
      return;
    }

    // Basic password validation
    if (password.length < 3) {
      showToast('error', 'Password must be at least 3 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name);
        showToast('success', 'Account created successfully!');
      } else {
        await login(email, password);
        showToast('success', 'Welcome back!');
      }
      navigate('/');
    } catch (error: any) {
      let errorMessage = 'Authentication failed. Please try again.';

      // Handle specific error cases
      if (error.message?.includes('Invalid credentials')) {
        if (isSignup) {
          errorMessage = 'Email already exists. Try logging in instead.';
        } else {
          errorMessage = 'Invalid email or password. Please check your credentials or sign up if you don\'t have an account.';
        }
      } else if (error.message?.includes('Email already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.';
        // Auto-switch to login mode
        setIsSignup(false);
      } else if (error.message?.includes('email and password required')) {
        errorMessage = 'Please fill in all required fields.';
      } else if (error.message?.includes('Failed to read response: 401')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message?.includes('Failed to read response')) {
        errorMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Fashion Search
            </h1>
            <p className="text-gray-600">
              {isSignup ? 'Create your account to get started' : 'Welcome back! Sign in to continue'}
            </p>
            {!isSignup && (
              <p className="text-sm text-gray-500 mt-2">
                Don't have an account? Click "Sign up" below
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignup && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name (optional)
                </label>
                <div className="relative">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field pl-10"
                    placeholder="Enter your name"
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Enter your email"
                  required
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-10"
                  placeholder="Enter your password"
                  required
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : (isSignup ? 'Create Account' : 'Sign In')}
            </button>
          </form>



          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Login;
