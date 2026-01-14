import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  name: string;
  email: string;
  company: string | null;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: string[];
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      permissions: [],

      setUser: (user) => set({
        user,
        permissions: user?.permissions || []
      }),

      setToken: (token) => {
        set({ token });
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
      },

      logout: () => {
        set({ user: null, token: null, permissions: [] });
        localStorage.removeItem('auth_token');
      },

      can: (permission) => {
        const { permissions } = get();
        return permissions.includes(permission);
      },

      canAny: (permissions) => {
        const userPermissions = get().permissions;
        return permissions.some(p => userPermissions.includes(p));
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.roles?.includes(role) || false;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
