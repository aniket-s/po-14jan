'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        {children}
        {/* Sonner portal - without this, every toast.*() call in the app is a no-op. */}
        <Toaster position="top-right" richColors closeButton />
      </NotificationsProvider>
    </AuthProvider>
  );
}
