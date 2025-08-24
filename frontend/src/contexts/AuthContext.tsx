import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getToken, setToken, removeToken, api } from '../utils/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = getToken();
      if (token) {
        try {
          // Try to get user info to validate token
          const response = await api('/auth/me', { method: 'GET' });
          setUser(response.user);
        } catch (error) {
          // Token is invalid, remove it
          removeToken();
          setUser(null);
        }
      }
      setLoading(false);
    };
    
    validateToken();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(response.token);
      setUser(response.user);
    } catch (error: any) {
      // Enhanced error handling
      let errorMessage = error.message || 'Login failed';

      if (error.message?.includes('Invalid credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials or create an account if you don\'t have one.';
      } else if (error.message?.includes('Failed to read response: 401')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message?.includes('Failed to read response: 400')) {
        errorMessage = 'Please provide both email and password.';
      } else if (error.message?.includes('Failed to read response: 500')) {
        errorMessage = 'Server error. Please try again later.';
      }

      const enhancedError = new Error(errorMessage);
      throw enhancedError;
    }
  };

  const signup = async (email: string, password: string, name?: string) => {
    try {
      const response = await api('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });

      setToken(response.token);
      setUser(response.user);
    } catch (error: any) {
      // Enhanced error handling
      let errorMessage = error.message || 'Signup failed';

      if (error.message?.includes('Email already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.';
      } else if (error.message?.includes('email and password required')) {
        errorMessage = 'Please provide both email and password.';
      } else if (error.message?.includes('Failed to read response: 409')) {
        errorMessage = 'Email already exists. Please try logging in instead.';
      } else if (error.message?.includes('Failed to read response: 400')) {
        errorMessage = 'Please provide both email and password.';
      } else if (error.message?.includes('Failed to read response: 500')) {
        errorMessage = 'Server error. Please try again later.';
      }

      const enhancedError = new Error(errorMessage);
      throw enhancedError;
    }
  };



  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      removeToken();
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
