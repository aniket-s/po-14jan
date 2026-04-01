'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings, Save, RotateCcw, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { FormSkeleton } from '@/components/skeletons';

interface Setting {
  key: string;
  value: string | boolean | number;
  type: 'string' | 'boolean' | 'number' | 'json' | 'text';
  group: string;
  description?: string;
  default_value?: string;
}

interface SettingGroup {
  name: string;
  settings: Setting[];
}

export default function SystemSettingsPage() {
  const [settingGroups, setSettingGroups] = useState<SettingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetSettingKey, setResetSettingKey] = useState<string>('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get<any>('/admin/settings');

      // Backend returns {settings: [{group, label, settings: [...]}]}
      const settingsData = response.data.settings || [];

      // Check if it's already grouped
      if (Array.isArray(settingsData) && settingsData.length > 0 && settingsData[0].settings) {
        // Already grouped - just map to our format
        const groups: SettingGroup[] = settingsData.map((group: any) => ({
          name: group.group,
          settings: group.settings.map((setting: any) => ({
            key: setting.key,
            value: setting.value,
            type: setting.type,
            group: group.group,
            description: setting.description,
            default_value: setting.default_value,
          })),
        }));
        setSettingGroups(groups);
      } else {
        // Legacy format - flat array of settings
        const settings = response.data.data || response.data.settings || response.data || [];

        // Ensure settings is an array
        if (!Array.isArray(settings)) {
          console.error('Settings is not an array:', settings);
          setSettingGroups([]);
          return;
        }

        // Group settings by group
        const grouped = settings.reduce((acc: Record<string, Setting[]>, setting: Setting) => {
          if (!acc[setting.group]) {
            acc[setting.group] = [];
          }
          acc[setting.group].push(setting);
          return acc;
        }, {});

        const groups: SettingGroup[] = Object.entries(grouped).map(([name, settings]) => ({
          name,
          settings: settings as Setting[],
        }));

        setSettingGroups(groups);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSettingGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getSettingValue = (setting: Setting) => {
    if (editedSettings.hasOwnProperty(setting.key)) {
      return editedSettings[setting.key];
    }
    return setting.value;
  };

  const handleSave = async (group: string) => {
    try {
      setSaving(true);

      // Filter edited settings for this group
      const groupSettings = settingGroups.find((g) => g.name === group)?.settings || [];
      const settingsToUpdate: Record<string, any> = {};

      groupSettings.forEach((setting) => {
        if (editedSettings.hasOwnProperty(setting.key)) {
          settingsToUpdate[setting.key] = editedSettings[setting.key];
        }
      });

      if (Object.keys(settingsToUpdate).length === 0) {
        return;
      }

      await api.post('/admin/settings/bulk-update', {
        settings: settingsToUpdate,
      });

      // Clear edited settings for this group
      const newEditedSettings = { ...editedSettings };
      groupSettings.forEach((setting) => {
        delete newEditedSettings[setting.key];
      });
      setEditedSettings(newEditedSettings);

      await fetchSettings();
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (key: string) => {
    try {
      setSaving(true);
      await api.post(`/admin/settings/${key}/reset`);

      // Remove from edited settings
      const newEditedSettings = { ...editedSettings };
      delete newEditedSettings[key];
      setEditedSettings(newEditedSettings);

      await fetchSettings();
      setIsResetDialogOpen(false);
      alert('Setting reset to default successfully!');
    } catch (error) {
      console.error('Failed to reset setting:', error);
      alert('Failed to reset setting');
    } finally {
      setSaving(false);
    }
  };

  const openResetDialog = (key: string) => {
    setResetSettingKey(key);
    setIsResetDialogOpen(true);
  };

  const hasChanges = (group: string) => {
    const groupSettings = settingGroups.find((g) => g.name === group)?.settings || [];
    return groupSettings.some((setting) => editedSettings.hasOwnProperty(setting.key));
  };

  const renderSettingInput = (setting: Setting) => {
    const value = getSettingValue(setting);

    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.key}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
            />
            <Label htmlFor={setting.key} className="cursor-pointer">
              {Boolean(value) ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, Number(e.target.value))}
          />
        );

      case 'text':
      case 'json':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            rows={4}
            className={setting.type === 'json' ? 'font-mono text-sm' : ''}
          />
        );

      case 'string':
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
          />
        );
    }
  };

  const getGroupIcon = (group: string) => {
    const icons: Record<string, string> = {
      app: '🌐',
      email: '📧',
      notification: '🔔',
      security: '🔒',
      storage: '💾',
      api: '⚡',
      system: '⚙️',
      general: '🏢',
      po: '📦',
      sample: '🎨',
      production: '🏭',
      quality: '✓',
      shipment: '🚚',
      invitation: '✉️',
    };
    return icons[group] || '📋';
  };

  if (loading) {
    return (
      <DashboardLayout
        requiredPermissions={['admin.settings.view', 'admin.settings.edit']}
        requireAll={false}
      >
        <FormSkeleton fields={6} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      requiredPermissions={['admin.settings.view', 'admin.settings.edit']}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage application-wide configuration settings
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Settings</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {settingGroups.reduce((sum, group) => sum + group.settings.length, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Setting Groups</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{settingGroups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unsaved Changes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(editedSettings).length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Groups */}
        {settingGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">No settings configured</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={settingGroups[0]?.name} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(settingGroups.length, 6)}, 1fr)` }}>
              {settingGroups.map((group) => (
                <TabsTrigger key={group.name} value={group.name} className="relative">
                  {getGroupIcon(group.name)} {group.name.charAt(0).toUpperCase() + group.name.slice(1)}
                  {hasChanges(group.name) && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-500" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {settingGroups.map((group) => (
              <TabsContent key={group.name} value={group.name} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{group.name.charAt(0).toUpperCase() + group.name.slice(1)} Settings</CardTitle>
                        <CardDescription>
                          Configure {group.name} related settings
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => handleSave(group.name)}
                        disabled={!hasChanges(group.name) || saving}
                      >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {group.settings.map((setting) => (
                      <div key={setting.key} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <Label htmlFor={setting.key} className="text-base font-medium">
                              {setting.key.split('.').pop()?.replace(/_/g, ' ').toUpperCase()}
                            </Label>
                            {setting.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {setting.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Key: <code className="bg-muted px-1 py-0.5 rounded">{setting.key}</code>
                            </p>
                            {setting.default_value && (
                              <p className="text-xs text-muted-foreground">
                                Default: <code className="bg-muted px-1 py-0.5 rounded">{setting.default_value}</code>
                              </p>
                            )}
                          </div>
                          {setting.default_value && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetDialog(setting.key)}
                              title="Reset to default"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-2">
                          {renderSettingInput(setting)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Warning:</strong> Changes to system settings will affect the entire application.
              Make sure you understand the impact before modifying any settings.
            </p>
            <p>
              <strong>Tip:</strong> Each setting can be reset to its default value using the reset button.
              Changes are only saved when you click "Save Changes" for each group.
            </p>
            <p>
              <strong>Note:</strong> Some settings may require application restart to take effect.
            </p>
          </CardContent>
        </Card>

        {/* Reset Dialog */}
        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to Default?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset the setting "{resetSettingKey}" to its default value.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleReset(resetSettingKey)}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset to Default
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
