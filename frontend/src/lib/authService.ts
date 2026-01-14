import api from './api';
import { AuthResponse, LoginCredentials, RegisterData, User } from '@/types/auth';

export const authService = {
  /**
   * Login user
   * Note: CSRF token is automatically fetched by API interceptor
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/login', credentials);
    return response.data;
  },

  /**
   * Register new user
   * Note: CSRF token is automatically fetched by API interceptor
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/register', data);
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await api.post('/logout');
    localStorage.removeItem('auth_token');
  },

  /**
   * Get current authenticated user
   */
  async getUser(): Promise<User> {
    const response = await api.get<{ user: User }>('/me');
    return response.data.user;
  },

  /**
   * Refresh user data
   */
  async refreshUser(): Promise<User> {
    const response = await api.get<{ user: User }>('/me');
    return response.data.user;
  },

  /**
   * Accept invitation
   * Note: CSRF token is automatically fetched by API interceptor
   */
  async acceptInvitation(token: string, password: string, password_confirmation: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`/invitations/accept/${token}`, {
      password,
      password_confirmation,
    });
    return response.data;
  },
};
