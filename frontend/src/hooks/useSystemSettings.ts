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
      const response = await api.get<{ data: SystemSetting[] }>('/admin/settings');
      const settingsData = response.data.data || response.data;

      // Ensure settingsData is an array before calling reduce
      if (!Array.isArray(settingsData)) {
        console.warn('System settings data is not an array:', settingsData);
        setSettings({});
        return;
      }

      // Convert array to key-value object
      const settingsMap = settingsData.reduce((acc: Record<string, SettingValue>, setting: SystemSetting) => {
        acc[setting.key] = parseSettingValue(setting.value, setting.type);
        return acc;
      }, {});

      setSettings(settingsMap);
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
