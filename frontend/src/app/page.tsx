'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');

    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  // Loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Package className="h-11 w-11 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Garment Supply Chain Platform</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        <div className="mt-6 flex justify-center">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-[shimmer_1s_ease-in-out_infinite] bg-primary"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
