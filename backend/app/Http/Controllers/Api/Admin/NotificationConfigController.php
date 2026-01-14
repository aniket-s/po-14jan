<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationConfig;
use App\Models\EmailTemplate;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NotificationConfigController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all notification configs
     */
    public function index(Request $request)
    {
        $query = NotificationConfig::with('emailTemplate');

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Category filter
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('event_name', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $notificationConfigs = $query->orderBy('category')->orderBy('event_name')->get();

        // Group by category
        $grouped = $notificationConfigs->groupBy('category');

        return response()->json([
            'notification_configs' => $notificationConfigs,
            'grouped_by_category' => $grouped,
        ]);
    }

    /**
     * Store a new notification config
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'event_name' => 'required|string|max:100|unique:notification_configs,event_name',
            'category' => 'nullable|string|max:50',
            'email_enabled' => 'boolean',
            'in_app_enabled' => 'boolean',
            'sms_enabled' => 'boolean',
            'recipients' => 'nullable|array',
            'email_template_id' => 'nullable|exists:email_templates,id',
            'in_app_message' => 'nullable|string',
            'sms_message' => 'nullable|string|max:160',
            'delay_minutes' => 'nullable|integer|min:0',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $notificationConfig = NotificationConfig::create($request->all());
        $notificationConfig->load('emailTemplate');

        $this->activityLog->log(
            'created',
            "Created notification config: {$notificationConfig->event_name}",
            'NotificationConfig',
            $notificationConfig->id
        );

        return response()->json([
            'message' => 'Notification config created successfully',
            'notification_config' => $notificationConfig,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $notificationConfig = NotificationConfig::with('emailTemplate')->findOrFail($id);

        return response()->json([
            'notification_config' => $notificationConfig,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $notificationConfig = NotificationConfig::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'event_name' => 'required|string|max:100|unique:notification_configs,event_name,' . $id,
            'category' => 'nullable|string|max:50',
            'email_enabled' => 'boolean',
            'in_app_enabled' => 'boolean',
            'sms_enabled' => 'boolean',
            'recipients' => 'nullable|array',
            'email_template_id' => 'nullable|exists:email_templates,id',
            'in_app_message' => 'nullable|string',
            'sms_message' => 'nullable|string|max:160',
            'delay_minutes' => 'nullable|integer|min:0',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldValues = $notificationConfig->toArray();
        $notificationConfig->update($request->all());
        $notificationConfig->load('emailTemplate');

        $this->activityLog->log(
            'updated',
            "Updated notification config: {$notificationConfig->event_name}",
            'NotificationConfig',
            $notificationConfig->id,
            ['old' => $oldValues, 'new' => $notificationConfig->toArray()]
        );

        return response()->json([
            'message' => 'Notification config updated successfully',
            'notification_config' => $notificationConfig,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $notificationConfig = NotificationConfig::findOrFail($id);

        $eventName = $notificationConfig->event_name;
        $notificationConfig->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted notification config: {$eventName}",
            'NotificationConfig',
            $id
        );

        return response()->json([
            'message' => 'Notification config deleted successfully',
        ]);
    }

    /**
     * Get available email templates for dropdown
     */
    public function getAvailableTemplates()
    {
        $templates = EmailTemplate::where('is_active', true)
            ->select('id', 'name', 'display_name', 'type')
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        return response()->json([
            'templates' => $templates,
        ]);
    }
}
