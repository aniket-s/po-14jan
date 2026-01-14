<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SettingsController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all system settings
     */
    public function index(Request $request)
    {
        $query = DB::table('system_settings');

        // Group filter
        if ($request->has('group')) {
            $query->where('group', $request->group);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('key', 'like', "%{$search}%")
                  ->orWhere('label', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $settings = $query->orderBy('group')->orderBy('display_order')->get();

        // Group settings by group
        $grouped = $settings->groupBy('group')->map(function ($items, $group) {
            return [
                'group' => $group,
                'label' => ucfirst(str_replace('_', ' ', $group)),
                'settings' => $items->map(function ($setting) {
                    return [
                        'id' => $setting->id,
                        'key' => $setting->key,
                        'label' => $setting->label,
                        'value' => $this->parseValue($setting->value, $setting->type),
                        'type' => $setting->type,
                        'options' => $setting->options ? json_decode($setting->options, true) : null,
                        'description' => $setting->description,
                        'validation_rules' => $setting->validation_rules,
                        'display_order' => $setting->display_order,
                        'is_public' => (bool) $setting->is_public,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'settings' => $grouped,
            'all_settings' => $settings->mapWithKeys(function ($setting) {
                return [$setting->key => $this->parseValue($setting->value, $setting->type)];
            }),
        ]);
    }

    /**
     * Get single setting
     */
    public function show($key)
    {
        $setting = DB::table('system_settings')
            ->where('key', $key)
            ->first();

        if (!$setting) {
            return response()->json([
                'message' => 'Setting not found',
            ], 404);
        }

        return response()->json([
            'setting' => [
                'id' => $setting->id,
                'key' => $setting->key,
                'label' => $setting->label,
                'value' => $this->parseValue($setting->value, $setting->type),
                'type' => $setting->type,
                'options' => $setting->options ? json_decode($setting->options, true) : null,
                'description' => $setting->description,
                'validation_rules' => $setting->validation_rules,
                'group' => $setting->group,
                'display_order' => $setting->display_order,
                'is_public' => (bool) $setting->is_public,
                'updated_at' => $setting->updated_at,
            ],
        ]);
    }

    /**
     * Update setting value
     */
    public function update(Request $request, $key)
    {
        $setting = DB::table('system_settings')
            ->where('key', $key)
            ->first();

        if (!$setting) {
            return response()->json([
                'message' => 'Setting not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'value' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Additional validation based on setting type
        $value = $request->value;
        if (!$this->validateValue($value, $setting->type, $setting->validation_rules)) {
            return response()->json([
                'message' => 'Invalid value for this setting type',
                'type' => $setting->type,
                'validation_rules' => $setting->validation_rules,
            ], 422);
        }

        $oldValue = $this->parseValue($setting->value, $setting->type);
        $newValue = $this->formatValue($value, $setting->type);

        // Update setting
        DB::table('system_settings')
            ->where('key', $key)
            ->update([
                'value' => $newValue,
                'updated_at' => now(),
            ]);

        // Log update
        $this->activityLog->log(
            'setting_updated',
            'SystemSetting',
            $setting->id,
            "Updated setting: {$setting->label}",
            [
                'key' => $key,
                'old_value' => $oldValue,
                'new_value' => $this->parseValue($newValue, $setting->type),
            ]
        );

        return response()->json([
            'message' => 'Setting updated successfully',
            'setting' => [
                'key' => $key,
                'value' => $this->parseValue($newValue, $setting->type),
            ],
        ]);
    }

    /**
     * Bulk update settings
     */
    public function bulkUpdate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'settings' => 'required|array',
            'settings.*.key' => 'required|exists:system_settings,key',
            'settings.*.value' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $updated = 0;
        $errors = [];

        foreach ($request->settings as $settingData) {
            $setting = DB::table('system_settings')
                ->where('key', $settingData['key'])
                ->first();

            if (!$setting) {
                $errors[] = "Setting '{$settingData['key']}' not found";
                continue;
            }

            // Validate value
            if (!$this->validateValue($settingData['value'], $setting->type, $setting->validation_rules)) {
                $errors[] = "Invalid value for setting '{$settingData['key']}'";
                continue;
            }

            $newValue = $this->formatValue($settingData['value'], $setting->type);

            // Update setting
            DB::table('system_settings')
                ->where('key', $settingData['key'])
                ->update([
                    'value' => $newValue,
                    'updated_at' => now(),
                ]);

            $updated++;
        }

        // Log bulk update
        $this->activityLog->log(
            'settings_bulk_updated',
            'SystemSetting',
            null,
            "Bulk updated {$updated} settings",
            [
                'updated_count' => $updated,
                'settings' => array_column($request->settings, 'key'),
                'errors' => $errors,
            ]
        );

        return response()->json([
            'message' => "Bulk update completed. {$updated} settings updated.",
            'updated_count' => $updated,
            'errors' => $errors,
        ]);
    }

    /**
     * Get public settings (for frontend)
     */
    public function publicSettings()
    {
        $settings = DB::table('system_settings')
            ->where('is_public', true)
            ->get();

        return response()->json([
            'settings' => $settings->mapWithKeys(function ($setting) {
                return [$setting->key => $this->parseValue($setting->value, $setting->type)];
            }),
        ]);
    }

    /**
     * Get settings by group
     */
    public function group($group)
    {
        $settings = DB::table('system_settings')
            ->where('group', $group)
            ->orderBy('display_order')
            ->get();

        if ($settings->isEmpty()) {
            return response()->json([
                'message' => 'No settings found for this group',
            ], 404);
        }

        return response()->json([
            'group' => $group,
            'label' => ucfirst(str_replace('_', ' ', $group)),
            'settings' => $settings->map(function ($setting) {
                return [
                    'id' => $setting->id,
                    'key' => $setting->key,
                    'label' => $setting->label,
                    'value' => $this->parseValue($setting->value, $setting->type),
                    'type' => $setting->type,
                    'options' => $setting->options ? json_decode($setting->options, true) : null,
                    'description' => $setting->description,
                    'validation_rules' => $setting->validation_rules,
                    'is_public' => (bool) $setting->is_public,
                ];
            }),
        ]);
    }

    /**
     * Parse value based on type
     */
    private function parseValue($value, $type)
    {
        switch ($type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'integer':
                return (int) $value;
            case 'float':
                return (float) $value;
            case 'json':
            case 'array':
                return json_decode($value, true);
            default:
                return $value;
        }
    }

    /**
     * Format value for storage
     */
    private function formatValue($value, $type)
    {
        switch ($type) {
            case 'boolean':
                return $value ? '1' : '0';
            case 'integer':
                return (string) (int) $value;
            case 'float':
                return (string) (float) $value;
            case 'json':
            case 'array':
                return is_string($value) ? $value : json_encode($value);
            default:
                return (string) $value;
        }
    }

    /**
     * Validate value based on type and rules
     */
    private function validateValue($value, $type, $rules)
    {
        // Type validation
        switch ($type) {
            case 'boolean':
                if (!is_bool($value) && !in_array($value, [0, 1, '0', '1', 'true', 'false'], true)) {
                    return false;
                }
                break;
            case 'integer':
                if (!is_numeric($value) || !filter_var($value, FILTER_VALIDATE_INT)) {
                    return false;
                }
                break;
            case 'float':
                if (!is_numeric($value)) {
                    return false;
                }
                break;
            case 'email':
                if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    return false;
                }
                break;
            case 'url':
                if (!filter_var($value, FILTER_VALIDATE_URL)) {
                    return false;
                }
                break;
        }

        // Additional validation rules
        if ($rules) {
            $validator = Validator::make(
                ['value' => $value],
                ['value' => $rules]
            );

            if ($validator->fails()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Reset setting to default value
     */
    public function reset($key)
    {
        $setting = DB::table('system_settings')
            ->where('key', $key)
            ->first();

        if (!$setting) {
            return response()->json([
                'message' => 'Setting not found',
            ], 404);
        }

        // For this implementation, we'll keep the current value as there's no default_value column
        // In production, you might want to add a default_value column to the settings table

        $this->activityLog->log(
            'setting_reset',
            'SystemSetting',
            $setting->id,
            "Reset setting: {$setting->label}",
            ['key' => $key]
        );

        return response()->json([
            'message' => 'Setting reset functionality - add default_value column to enable',
        ]);
    }
}
