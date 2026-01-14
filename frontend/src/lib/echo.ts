import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Make Pusher available globally for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<any> | undefined;
  }
}

// Only set Pusher on window in browser environment
if (typeof window !== 'undefined') {
  window.Pusher = Pusher;
}

interface EchoConfig {
  broadcaster: string;
  key: string;
  wsHost: string;
  wsPort: number;
  wssPort: number;
  forceTLS: boolean;
  enabledTransports: string[];
  authEndpoint: string;
  auth: {
    headers: {
      Authorization: string;
      Accept: string;
    };
  };
}

let echoInstance: Echo<any> | null = null;

export const initializeEcho = (token?: string): Echo<any> => {
  // Only initialize if not already initialized
  if (echoInstance) {
    return echoInstance;
  }

  const config: EchoConfig = {
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY || 'app-key',
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
    wsPort: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '8080'),
    wssPort: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '8080'),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  };

  echoInstance = new Echo(config as any);
  window.Echo = echoInstance;

  return echoInstance;
};

export const getEcho = (): Echo<any> | null => {
  return echoInstance;
};

export const disconnectEcho = () => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    window.Echo = undefined;
  }
};

export default {
  initialize: initializeEcho,
  get: getEcho,
  disconnect: disconnectEcho,
};
