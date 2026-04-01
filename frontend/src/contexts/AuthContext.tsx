'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, LoginCredentials, RegisterData } from '@/types/auth';
import { authService } from '@/lib/authService';
import { AxiosError } from 'axios';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load user from token on mount
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authService.getUser();
      setUser(userData);
    } catch (err: any) {
      console.error('Failed to load user:', err);
      // Only remove token on 401 (unauthorized) responses
      // Network errors or other failures should not wipe the token
      if (err?.response?.status === 401) {
        localStorage.removeItem('auth_token');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (credentials: LoginCredentials) => {
    setError(null);
    setLoading(true);
    try {
      const response = await authService.login(credentials);
      localStorage.setItem('auth_token', response.token);
      setUser(response.user);
      router.push('/dashboard');
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string; errors?: Record<string, string[]> }>;
      setError(axiosError.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setError(null);
    setLoading(true);
    try {
      const response = await authService.register(data);
      localStorage.setItem('auth_token', response.token);
      setUser(response.user);
      router.push('/dashboard');
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string; errors?: Record<string, string[]> }>;
      setError(axiosError.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('auth_token');
      setLoading(false);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.refreshUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const can = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const canAny = (permissions: string[]): boolean => {
    return permissions.some(permission => can(permission));
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.some(r => r.name === role) || false;
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser,
    can,
    canAny,
    hasRole,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
