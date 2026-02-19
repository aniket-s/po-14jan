import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface SystemSetting {
  key: string;
  value: string | boolean | number;
  type: 'string' | 'boolean' | 'number' | 'json' | 'text';
  group: string;
  description?: string;
}

type SettingValue = string | boolean | number | Record<string, unknown> | null;

export function useSystemSettings() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ settings: Record<string, SettingValue> }>('/settings/public');
      const settingsData = response.data.settings || {};

      // Public endpoint returns key-value map directly
      if (typeof settingsData === 'object' && !Array.isArray(settingsData)) {
        setSettings(settingsData);
      } else {
        console.warn('System settings data is not a valid object:', settingsData);
        setSettings({});
      }
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
      // Set empty settings on error to prevent further issues
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  const parseSettingValue = (value: string | boolean | number, type: string): SettingValue => {
    if (type === 'boolean') {
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1' || value === 1;
    }
    if (type === 'number') {
      return Number(value);
    }
    return value;
  };

  const getSetting = <T extends SettingValue = SettingValue>(key: string, defaultValue: T | null = null): T | null => {
    return (settings[key] as T) ?? defaultValue;
  };

  return {
    settings,
    loading,
    getSetting,
  };
}
