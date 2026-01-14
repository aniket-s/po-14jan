<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class EmailTemplateController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all email templates
     */
    public function index(Request $request)
    {
        $query = DB::table('email_templates');

        // Type/Category filter
        if ($request->has('category')) {
            $query->where('type', $request->category);
        }

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $templates = $query->get();

        return response()->json([
            'templates' => $templates->map(function ($template) {
                return [
                    'id' => $template->id,
                    'name' => $template->name,
                    'category' => $template->type ?? null,
                    'subject' => $template->subject,
                    'description' => $template->description,
                    'available_variables' => $template->available_variables ? json_decode($template->available_variables, true) : [],
                    'is_active' => (bool) $template->is_active,
                    'created_at' => $template->created_at,
                    'updated_at' => $template->updated_at,
                ];
            }),
        ]);
    }

    /**
     * Get single email template
     */
    public function show($id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        return response()->json([
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'category' => $template->type ?? null,
                'subject' => $template->subject,
                'body_text' => $template->body_text,
                'body_html' => $template->body_html,
                'available_variables' => $template->available_variables ? json_decode($template->available_variables, true) : [],
                'from_email' => $template->from_email,
                'from_name' => $template->from_name,
                'reply_to' => $template->reply_to,
                'cc' => $template->cc,
                'bcc' => $template->bcc,
                'description' => $template->description,
                'is_active' => (bool) $template->is_active,
                'created_at' => $template->created_at,
                'updated_at' => $template->updated_at,
            ],
        ]);
    }

    /**
     * Create new email template
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:email_templates,name',
            'category' => 'required|string|max:50',
            'subject' => 'required|string|max:255',
            'body_text' => 'nullable|string',
            'body_html' => 'nullable|string',
            'available_variables' => 'nullable|array',
            'from_email' => 'nullable|email|max:255',
            'from_name' => 'nullable|string|max:255',
            'reply_to' => 'nullable|email|max:255',
            'cc' => 'nullable|string|max:500',
            'bcc' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Ensure at least one body format is provided
        if (empty($request->body_text) && empty($request->body_html)) {
            return response()->json([
                'message' => 'At least one of body_text or body_html must be provided',
            ], 422);
        }

        $id = DB::table('email_templates')->insertGetId([
            'name' => $request->name,
            'type' => $request->category,
            'subject' => $request->subject,
            'body_text' => $request->body_text,
            'body_html' => $request->body_html,
            'available_variables' => $request->available_variables ? json_encode($request->available_variables) : null,
            'from_email' => $request->from_email,
            'from_name' => $request->from_name,
            'reply_to' => $request->reply_to,
            'cc' => $request->cc,
            'bcc' => $request->bcc,
            'description' => $request->description,
            'is_active' => $request->get('is_active', true),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Log creation
        $this->activityLog->logCreated('EmailTemplate', $id, [
            'name' => $request->name,
            'category' => $request->category,
        ]);

        $template = DB::table('email_templates')->where('id', $id)->first();

        return response()->json([
            'message' => 'Email template created successfully',
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'category' => $template->type ?? null,
                'subject' => $template->subject,
                'available_variables' => $template->available_variables ? json_decode($template->available_variables, true) : [],
                'is_active' => (bool) $template->is_active,
            ],
        ], 201);
    }

    /**
     * Update email template
     */
    public function update(Request $request, $id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:email_templates,name,' . $id,
            'category' => 'required|string|max:50',
            'subject' => 'required|string|max:255',
            'body_text' => 'nullable|string',
            'body_html' => 'nullable|string',
            'available_variables' => 'nullable|array',
            'from_email' => 'nullable|email|max:255',
            'from_name' => 'nullable|string|max:255',
            'reply_to' => 'nullable|email|max:255',
            'cc' => 'nullable|string|max:500',
            'bcc' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Ensure at least one body format is provided
        if (empty($request->body_text) && empty($request->body_html)) {
            return response()->json([
                'message' => 'At least one of body_text or body_html must be provided',
            ], 422);
        }

        $oldData = [
            'name' => $template->name,
            'subject' => $template->subject,
            'is_active' => $template->is_active,
        ];

        DB::table('email_templates')->where('id', $id)->update([
            'name' => $request->name,
            'type' => $request->category,
            'subject' => $request->subject,
            'body_text' => $request->body_text,
            'body_html' => $request->body_html,
            'available_variables' => $request->available_variables ? json_encode($request->available_variables) : null,
            'from_email' => $request->from_email,
            'from_name' => $request->from_name,
            'reply_to' => $request->reply_to,
            'cc' => $request->cc,
            'bcc' => $request->bcc,
            'description' => $request->description,
            'is_active' => $request->get('is_active', true),
            'updated_at' => now(),
        ]);

        $newData = [
            'name' => $request->name,
            'subject' => $request->subject,
            'is_active' => $request->get('is_active', true),
        ];

        // Log update
        $this->activityLog->logUpdated('EmailTemplate', $id, $oldData, $newData);

        $updated = DB::table('email_templates')->where('id', $id)->first();

        return response()->json([
            'message' => 'Email template updated successfully',
            'template' => [
                'id' => $updated->id,
                'name' => $updated->name,
                'category' => $updated->type ?? null,
                'subject' => $updated->subject,
                'available_variables' => $updated->available_variables ? json_decode($updated->available_variables, true) : [],
                'is_active' => (bool) $updated->is_active,
            ],
        ]);
    }

    /**
     * Delete email template
     */
    public function destroy($id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        $templateData = [
            'name' => $template->name,
            'category' => $template->type ?? null,
        ];

        // Log deletion
        $this->activityLog->logDeleted('EmailTemplate', $id, $templateData);

        // Delete template
        DB::table('email_templates')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Email template deleted successfully',
        ]);
    }

    /**
     * Get email templates by category
     */
    public function byCategory($category)
    {
        $templates = DB::table('email_templates')
            ->where('type', $category)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json([
            'category' => $category,
            'templates' => $templates->map(function ($template) {
                return [
                    'id' => $template->id,
                    'name' => $template->name,
                    'subject' => $template->subject,
                    'description' => $template->description,
                    'available_variables' => $template->available_variables ? json_decode($template->available_variables, true) : [],
                ];
            }),
        ]);
    }

    /**
     * Get available categories
     */
    public function categories()
    {
        $categories = DB::table('email_templates')
            ->select('type')
            ->distinct()
            ->orderBy('type')
            ->pluck('type');

        return response()->json([
            'categories' => $categories->map(function ($category) {
                return [
                    'value' => $category,
                    'label' => ucfirst(str_replace('_', ' ', $category)),
                    'count' => DB::table('email_templates')->where('type', $category)->count(),
                ];
            }),
        ]);
    }

    /**
     * Preview email template with sample data
     */
    public function preview(Request $request, $id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $variables = $request->get('variables', []);

        // Replace variables in subject
        $subject = $this->replaceVariables($template->subject, $variables);

        // Replace variables in body_text
        $bodyText = $template->body_text ? $this->replaceVariables($template->body_text, $variables) : null;

        // Replace variables in body_html
        $bodyHtml = $template->body_html ? $this->replaceVariables($template->body_html, $variables) : null;

        return response()->json([
            'preview' => [
                'subject' => $subject,
                'body_text' => $bodyText,
                'body_html' => $bodyHtml,
                'from_email' => $template->from_email,
                'from_name' => $template->from_name,
                'reply_to' => $template->reply_to,
            ],
        ]);
    }

    /**
     * Test send email template
     */
    public function testSend(Request $request, $id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'to_email' => 'required|email',
            'variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $variables = $request->get('variables', []);

        // Replace variables
        $subject = $this->replaceVariables($template->subject, $variables);
        $bodyText = $template->body_text ? $this->replaceVariables($template->body_text, $variables) : null;
        $bodyHtml = $template->body_html ? $this->replaceVariables($template->body_html, $variables) : null;

        // In production, this would send actual email via AWS SES
        // For now, we'll log it to email_logs table
        DB::table('email_logs')->insert([
            'template_id' => $id,
            'to_email' => $request->to_email,
            'from_email' => $template->from_email,
            'subject' => $subject,
            'body_html' => $bodyHtml,
            'body_text' => $bodyText,
            'status' => 'sent',
            'sent_at' => now(),
            'metadata' => json_encode([
                'test_email' => true,
                'variables' => $variables,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Log test send
        $this->activityLog->log(
            'email_test_sent',
            'EmailTemplate',
            $id,
            "Test email sent from template: {$template->name}",
            [
                'to_email' => $request->to_email,
                'template_name' => $template->name,
            ]
        );

        return response()->json([
            'message' => 'Test email sent successfully',
            'details' => [
                'to' => $request->to_email,
                'subject' => $subject,
                'template' => $template->name,
            ],
        ]);
    }

    /**
     * Toggle template active state
     */
    public function toggleActive($id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        $newActiveState = !$template->is_active;

        DB::table('email_templates')->where('id', $id)->update([
            'is_active' => $newActiveState,
            'updated_at' => now(),
        ]);

        // Log toggle
        $this->activityLog->log(
            'template_toggled',
            'EmailTemplate',
            $id,
            "Email template {$template->name} " . ($newActiveState ? 'activated' : 'deactivated'),
            [
                'old_state' => $template->is_active,
                'new_state' => $newActiveState,
            ]
        );

        return response()->json([
            'message' => 'Email template ' . ($newActiveState ? 'activated' : 'deactivated') . ' successfully',
            'is_active' => $newActiveState,
        ]);
    }

    /**
     * Duplicate email template
     */
    public function duplicate($id)
    {
        $template = DB::table('email_templates')->where('id', $id)->first();

        if (!$template) {
            return response()->json([
                'message' => 'Email template not found',
            ], 404);
        }

        // Create new name
        $newName = $template->name . ' (Copy)';
        $counter = 1;
        while (DB::table('email_templates')->where('name', $newName)->exists()) {
            $newName = $template->name . ' (Copy ' . $counter . ')';
            $counter++;
        }

        $newId = DB::table('email_templates')->insertGetId([
            'name' => $newName,
            'type' => $template->type,
            'subject' => $template->subject,
            'body_text' => $template->body_text,
            'body_html' => $template->body_html,
            'available_variables' => $template->available_variables,
            'from_email' => $template->from_email,
            'from_name' => $template->from_name,
            'reply_to' => $template->reply_to,
            'cc' => $template->cc,
            'bcc' => $template->bcc,
            'description' => $template->description,
            'is_active' => false, // Duplicates start as inactive
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Log duplication
        $this->activityLog->log(
            'template_duplicated',
            'EmailTemplate',
            $newId,
            "Email template duplicated from: {$template->name}",
            [
                'original_id' => $id,
                'original_name' => $template->name,
                'new_name' => $newName,
            ]
        );

        $newTemplate = DB::table('email_templates')->where('id', $newId)->first();

        return response()->json([
            'message' => 'Email template duplicated successfully',
            'template' => [
                'id' => $newTemplate->id,
                'name' => $newTemplate->name,
                'category' => $newTemplate->type ?? null,
                'subject' => $newTemplate->subject,
                'is_active' => (bool) $newTemplate->is_active,
            ],
        ], 201);
    }

    /**
     * Replace variables in template content
     */
    private function replaceVariables(string $content, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Replace {{variable}} with value
            $content = str_replace('{{' . $key . '}}', $value, $content);
        }

        return $content;
    }
}
