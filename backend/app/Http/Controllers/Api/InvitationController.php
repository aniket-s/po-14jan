<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\EmailService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    protected ActivityLogService $activityLog;
    protected EmailService $emailService;
    protected PermissionService $permissionService;

    public function __construct(
        ActivityLogService $activityLog,
        EmailService $emailService,
        PermissionService $permissionService
    ) {
        $this->activityLog = $activityLog;
        $this->emailService = $emailService;
        $this->permissionService = $permissionService;
    }

    /**
     * Get all invitations for a PO
     */
    public function index(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view invitations for this purchase order',
            ], 403);
        }

        $query = Invitation::with(['invitedBy', 'invitedUser'])
            ->where('purchase_order_id', $poId);

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Type filter
        if ($request->has('invitation_type')) {
            $query->where('invitation_type', $request->invitation_type);
        }

        $invitations = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'invitations' => $invitations->map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'invitation_type' => $invitation->invitation_type,
                    'invited_by' => [
                        'id' => $invitation->invitedBy->id,
                        'name' => $invitation->invitedBy->name,
                        'email' => $invitation->invitedBy->email,
                    ],
                    'invited_user' => $invitation->invitedUser ? [
                        'id' => $invitation->invitedUser->id,
                        'name' => $invitation->invitedUser->name,
                        'email' => $invitation->invitedUser->email,
                    ] : null,
                    'invited_email' => $invitation->invited_email,
                    'invited_name' => $invitation->invited_name,
                    'status' => $invitation->status,
                    'expires_at' => $invitation->expires_at,
                    'accepted_at' => $invitation->accepted_at,
                    'rejected_at' => $invitation->rejected_at,
                    'rejection_reason' => $invitation->rejection_reason,
                    'message' => $invitation->message,
                    'created_at' => $invitation->created_at,
                ];
            }),
        ]);
    }

    /**
     * Send invitation(s)
     * Type 1: Importer invites Agency
     * Type 2: Importer invites Factory (direct)
     * Type 3: Agency invites Factory
     * Type 4: Importer/Agency invites Quality Inspector
     */
    public function send(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to send invitations for this purchase order',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'invitation_type' => 'required|in:invite_agency,invite_factory_direct,invite_factory_via_agency,invite_inspector',
            'invited_users' => 'required|array|min:1',
            'invited_users.*.user_id' => 'nullable|exists:users,id',
            'invited_users.*.email' => 'required|email',
            'invited_users.*.name' => 'nullable|string|max:255',
            'message' => 'nullable|string',
            'expires_in_days' => 'nullable|integer|min:1|max:30',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Validate invitation type based on user role
        $validationResult = $this->validateInvitationType($user, $po, $request->invitation_type);
        if (!$validationResult['valid']) {
            return response()->json([
                'message' => $validationResult['message'],
            ], 403);
        }

        $sent = 0;
        $errors = [];
        $invitations = [];

        foreach ($request->invited_users as $invitedData) {
            // Check if user exists
            $invitedUser = null;
            if (isset($invitedData['user_id'])) {
                $invitedUser = User::find($invitedData['user_id']);

                // Validate user role for invitation type
                $roleValidation = $this->validateUserRole($invitedUser, $request->invitation_type);
                if (!$roleValidation['valid']) {
                    $errors[] = [
                        'email' => $invitedData['email'],
                        'error' => $roleValidation['message'],
                    ];
                    continue;
                }
            }

            // Check for existing pending invitation
            $existing = Invitation::where('purchase_order_id', $poId)
                ->where('invited_email', $invitedData['email'])
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->first();

            if ($existing) {
                $errors[] = [
                    'email' => $invitedData['email'],
                    'error' => 'Pending invitation already exists',
                ];
                continue;
            }

            // Create invitation
            $expiresAt = now()->addDays($request->get('expires_in_days', 7));
            $token = Str::random(64);

            $invitation = Invitation::create([
                'purchase_order_id' => $poId,
                'invitation_type' => $request->invitation_type,
                'invited_by' => $user->id,
                'invited_user_id' => $invitedUser?->id,
                'invited_email' => $invitedData['email'],
                'invited_name' => $invitedData['name'] ?? null,
                'invitation_token' => $token,
                'status' => 'pending',
                'expires_at' => $expiresAt,
                'message' => $request->message,
            ]);

            // Send email
            $this->sendInvitationEmail($invitation, $po);

            $invitations[] = $invitation;
            $sent++;
        }

        // Log invitation sending
        $this->activityLog->log(
            'invitations_sent',
            'PurchaseOrder',
            $poId,
            "Sent {$sent} {$request->invitation_type} invitation(s)",
            [
                'invitation_type' => $request->invitation_type,
                'sent_count' => $sent,
                'po_number' => $po->po_number,
            ]
        );

        return response()->json([
            'message' => "Successfully sent {$sent} invitation(s)",
            'sent_count' => $sent,
            'errors_count' => count($errors),
            'errors' => $errors,
            'invitations' => array_map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'invited_email' => $invitation->invited_email,
                    'expires_at' => $invitation->expires_at,
                ];
            }, $invitations),
        ], 201);
    }

    /**
     * Validate invitation token and return invitation details (public endpoint)
     */
    public function validate($token)
    {
        $invitation = Invitation::with(['invitedBy:id,name,company', 'purchaseOrder:id,po_number'])
            ->where('invitation_token', $token)
            ->first();

        if (!$invitation) {
            return response()->json([
                'message' => 'Invitation not found',
            ], 404);
        }

        // Check if expired
        if ($invitation->isExpired()) {
            return response()->json([
                'message' => 'This invitation has expired',
            ], 410);
        }

        // Get role mapping
        $roleMapping = [
            'invite_agency' => ['name' => 'Agency', 'display_name' => 'Agency', 'description' => 'Manage purchase orders and invite factories'],
            'invite_factory_direct' => ['name' => 'Factory', 'display_name' => 'Factory', 'description' => 'Fulfill orders and manage production'],
            'invite_factory_via_agency' => ['name' => 'Factory', 'display_name' => 'Factory (via Agency)', 'description' => 'Fulfill orders and manage production'],
            'invite_inspector' => ['name' => 'Quality Inspector', 'display_name' => 'Quality Inspector', 'description' => 'Perform quality inspections'],
        ];

        $role = $roleMapping[$invitation->invitation_type] ?? ['name' => 'Unknown', 'display_name' => 'Unknown', 'description' => null];

        return response()->json([
            'data' => [
                'id' => $invitation->id,
                'invitation_type' => $invitation->invitation_type,
                'email' => $invitation->invited_email,
                'status' => $invitation->status,
                'expires_at' => $invitation->expires_at,
                'inviter' => [
                    'name' => $invitation->invitedBy->name,
                    'company' => $invitation->invitedBy->company,
                ],
                'role' => $role,
                'created_at' => $invitation->created_at,
            ],
        ]);
    }

    /**
     * Accept invitation
     */
    public function accept(Request $request, $token)
    {
        $invitation = Invitation::where('invitation_token', $token)->firstOrFail();

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'This invitation is no longer valid',
                'status' => $invitation->status,
            ], 422);
        }

        $user = $request->user();

        // If no authenticated user, this is a new user registration
        if (!$user) {
            return $this->acceptInvitationAsNewUser($request, $invitation);
        }

        // Existing user accepting invitation
        // Verify the user accepting matches the invited email
        if ($user->email !== $invitation->invited_email) {
            return response()->json([
                'message' => 'You are not authorized to accept this invitation',
            ], 403);
        }

        $invitation->accept();

        // Process invitation based on type
        $this->processInvitationAcceptance($invitation, $user);

        // Log acceptance
        $this->activityLog->log(
            'invitation_accepted',
            'Invitation',
            $invitation->id,
            "Invitation accepted by {$user->name}",
            [
                'invitation_type' => $invitation->invitation_type,
                'po_number' => $invitation->purchaseOrder->po_number,
            ]
        );

        return response()->json([
            'message' => 'Invitation accepted successfully',
            'invitation' => [
                'id' => $invitation->id,
                'invitation_type' => $invitation->invitation_type,
                'status' => $invitation->status,
            ],
        ]);
    }

    /**
     * Accept invitation by creating a new user account
     */
    private function acceptInvitationAsNewUser(Request $request, Invitation $invitation)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
            'company' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if user already exists with this email
        $existingUser = User::where('email', $invitation->invited_email)->first();
        if ($existingUser) {
            return response()->json([
                'message' => 'An account with this email already exists. Please log in to accept the invitation.',
            ], 422);
        }

        // Create new user
        $user = User::create([
            'name' => $request->name,
            'email' => $invitation->invited_email,
            'password' => bcrypt($request->password),
            'company' => $request->company,
            'email_verified_at' => now(), // Auto-verify email since they have valid invitation
        ]);

        // Accept invitation
        $invitation->accept();

        // Process invitation based on type (assign role, etc.)
        $this->processInvitationAcceptance($invitation, $user);

        // Log acceptance
        $this->activityLog->log(
            'invitation_accepted',
            'Invitation',
            $invitation->id,
            "New user {$user->name} created and accepted invitation",
            [
                'invitation_type' => $invitation->invitation_type,
                'po_number' => $invitation->purchaseOrder->po_number,
                'user_id' => $user->id,
            ]
        );

        return response()->json([
            'message' => 'Account created and invitation accepted successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'invitation' => [
                'id' => $invitation->id,
                'invitation_type' => $invitation->invitation_type,
                'status' => $invitation->status,
            ],
        ], 201);
    }

    /**
     * Reject invitation
     */
    public function reject(Request $request, $token)
    {
        $invitation = Invitation::where('invitation_token', $token)->firstOrFail();

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'This invitation is no longer valid',
                'status' => $invitation->status,
            ], 422);
        }

        $user = $request->user();

        // Verify the user rejecting matches the invited email
        if ($user->email !== $invitation->invited_email) {
            return response()->json([
                'message' => 'You are not authorized to reject this invitation',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $invitation->reject($request->reason);

        // Log rejection
        $this->activityLog->log(
            'invitation_rejected',
            'Invitation',
            $invitation->id,
            "Invitation rejected by {$user->name}",
            [
                'invitation_type' => $invitation->invitation_type,
                'po_number' => $invitation->purchaseOrder->po_number,
                'reason' => $request->reason,
            ]
        );

        return response()->json([
            'message' => 'Invitation rejected successfully',
        ]);
    }

    /**
     * Cancel invitation
     */
    public function cancel(Request $request, $poId, $invitationId)
    {
        $user = $request->user();
        $invitation = Invitation::where('id', $invitationId)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Only the sender can cancel
        if ($invitation->invited_by !== $user->id) {
            return response()->json([
                'message' => 'You are not authorized to cancel this invitation',
            ], 403);
        }

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'Only pending invitations can be canceled',
            ], 422);
        }

        $invitation->status = 'canceled';
        $invitation->save();

        // Log cancellation
        $this->activityLog->log(
            'invitation_canceled',
            'Invitation',
            $invitation->id,
            "Invitation canceled",
            [
                'invitation_type' => $invitation->invitation_type,
                'invited_email' => $invitation->invited_email,
            ]
        );

        return response()->json([
            'message' => 'Invitation canceled successfully',
        ]);
    }

    /**
     * Resend invitation
     */
    public function resend(Request $request, $poId, $invitationId)
    {
        $user = $request->user();
        $invitation = Invitation::where('id', $invitationId)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Only the sender can resend
        if ($invitation->invited_by !== $user->id) {
            return response()->json([
                'message' => 'You are not authorized to resend this invitation',
            ], 403);
        }

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'Only pending invitations can be resent',
            ], 422);
        }

        // Extend expiration
        $invitation->expires_at = now()->addDays(7);
        $invitation->save();

        // Resend email
        $this->sendInvitationEmail($invitation, $invitation->purchaseOrder);

        // Log resend
        $this->activityLog->log(
            'invitation_resent',
            'Invitation',
            $invitation->id,
            "Invitation resent",
            [
                'invited_email' => $invitation->invited_email,
            ]
        );

        return response()->json([
            'message' => 'Invitation resent successfully',
            'expires_at' => $invitation->expires_at,
        ]);
    }

    /**
     * Validate invitation type based on user role
     */
    private function validateInvitationType(User $user, PurchaseOrder $po, string $type): array
    {
        switch ($type) {
            case 'invite_agency':
                // Only importer can invite agency
                if ($po->importer_id !== $user->id) {
                    return [
                        'valid' => false,
                        'message' => 'Only the importer can invite an agency',
                    ];
                }
                break;

            case 'invite_factory_direct':
                // Only importer can invite factory directly
                if ($po->importer_id !== $user->id) {
                    return [
                        'valid' => false,
                        'message' => 'Only the importer can invite factories directly',
                    ];
                }
                break;

            case 'invite_factory_via_agency':
                // Only agency can invite factory (and PO must have agency assigned)
                if ($po->agency_id !== $user->id) {
                    return [
                        'valid' => false,
                        'message' => 'Only the assigned agency can invite factories',
                    ];
                }
                break;

            case 'invite_inspector':
                // Importer or agency can invite inspector
                if ($po->importer_id !== $user->id && $po->agency_id !== $user->id) {
                    return [
                        'valid' => false,
                        'message' => 'Only the importer or assigned agency can invite inspectors',
                    ];
                }
                break;

            default:
                return [
                    'valid' => false,
                    'message' => 'Invalid invitation type',
                ];
        }

        return ['valid' => true];
    }

    /**
     * Validate user role for invitation type
     */
    private function validateUserRole(?User $user, string $type): array
    {
        if (!$user) {
            return ['valid' => true]; // Will be validated when they register
        }

        $requiredRole = match($type) {
            'invite_agency' => 'Agency',
            'invite_factory_direct', 'invite_factory_via_agency' => 'Factory',
            'invite_inspector' => 'Quality Inspector',
            default => null,
        };

        if ($requiredRole && !$user->hasRole($requiredRole)) {
            return [
                'valid' => false,
                'message' => "User must have {$requiredRole} role",
            ];
        }

        return ['valid' => true];
    }

    /**
     * Process invitation acceptance
     */
    private function processInvitationAcceptance(Invitation $invitation, User $user): void
    {
        $po = $invitation->purchaseOrder;

        // Assign appropriate role based on invitation type if user doesn't already have it
        $roleMapping = [
            'invite_agency' => 'Agency',
            'invite_factory_direct' => 'Factory',
            'invite_factory_via_agency' => 'Factory',
            'invite_inspector' => 'Quality Inspector',
        ];

        if (isset($roleMapping[$invitation->invitation_type])) {
            $roleName = $roleMapping[$invitation->invitation_type];
            // Only assign role if user doesn't have it yet
            if (!$user->hasRole($roleName)) {
                // Remove Viewer role if they have it (upgrading to proper role)
                if ($user->hasRole('Viewer')) {
                    $user->removeRole('Viewer');
                }
                $user->assignRole($roleName);
            }
        }

        switch ($invitation->invitation_type) {
            case 'invite_agency':
                // Assign agency to PO
                $po->agency_id = $user->id;
                $po->save();
                break;

            case 'invite_factory_direct':
            case 'invite_factory_via_agency':
                // Create factory assignment
                $assignmentType = $invitation->invitation_type === 'invite_factory_direct' ? 'direct' : 'via_agency';

                \App\Models\FactoryAssignment::create([
                    'purchase_order_id' => $po->id,
                    'factory_id' => $user->id,
                    'assigned_by' => $invitation->invited_by,
                    'assignment_type' => $assignmentType,
                    'status' => 'accepted',
                    'accepted_at' => now(),
                ]);
                break;

            case 'invite_inspector':
                // Inspector invitation accepted - no automatic assignment
                // Inspection assignment happens when creating quality inspection
                break;
        }
    }

    /**
     * Send invitation email
     */
    private function sendInvitationEmail(Invitation $invitation, PurchaseOrder $po): void
    {
        $templateName = match($invitation->invitation_type) {
            'invite_agency' => 'invitation_to_agency',
            'invite_factory_direct' => 'invitation_to_factory_direct',
            'invite_factory_via_agency' => 'invitation_to_factory_via_agency',
            'invite_inspector' => 'invitation_to_inspector',
            default => null,
        };

        if (!$templateName) {
            return;
        }

        $invitationUrl = env('FRONTEND_URL') . '/invitations/accept/' . $invitation->invitation_token;

        $variables = [
            'inviter_name' => $invitation->invitedBy->name,
            'inviter_company' => $invitation->invitedBy->company,
            'po_number' => $po->po_number,
            'brand_name' => $po->brand_name,
            'invitation_url' => $invitationUrl,
            'expires_at' => $invitation->expires_at->format('F j, Y'),
            'custom_message' => $invitation->message ?? '',
        ];

        $this->emailService->sendFromTemplate(
            $templateName,
            $invitation->invited_email,
            $variables
        );
    }

    /**
     * Get all invitations across all POs (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\Invitation::with(['purchaseOrder:id,po_number', 'invitedBy:id,name']);

        // Apply role-based filtering
        if ($user->hasRole('Super Admin')) {
            // Super Admin sees all invitations
        } elseif ($user->hasRole('Importer')) {
            // Importer sees invitations they sent (on POs they created)
            $query->whereHas('purchaseOrder', function($q) use ($user) {
                $q->where('creator_id', $user->id);
            });
        } else {
            // Agency/Factory/Inspector see invitations they received
            $query->where(function($q) use ($user) {
                $q->where('invited_email', $user->email)
                  ->orWhere('invited_user_id', $user->id);
            });
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('invited_email', 'like', "%{$search}%")
                  ->orWhere('invited_name', 'like', "%{$search}%")
                  ->orWhereHas('purchaseOrder', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                  });
            });
        }

        $paginated = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 20));

        // Transform the data to exclude deprecated fields
        $paginated->getCollection()->transform(function ($invitation) {
            return [
                'id' => $invitation->id,
                'purchase_order_id' => $invitation->purchase_order_id,
                'invitation_type' => $invitation->invitation_type,
                'invited_by' => $invitation->invitedBy ? [
                    'id' => $invitation->invitedBy->id,
                    'name' => $invitation->invitedBy->name,
                ] : null,
                'invited_user_id' => $invitation->invited_user_id,
                'invited_email' => $invitation->invited_email,
                'invited_name' => $invitation->invited_name,
                'invitation_token' => $invitation->invitation_token,
                'expires_at' => $invitation->expires_at,
                'status' => $invitation->status,
                'accepted_at' => $invitation->accepted_at,
                'rejected_at' => $invitation->rejected_at,
                'rejection_reason' => $invitation->rejection_reason,
                'message' => $invitation->message,
                'metadata' => $invitation->metadata,
                'created_at' => $invitation->created_at,
                'updated_at' => $invitation->updated_at,
                'purchase_order' => $invitation->purchaseOrder ? [
                    'id' => $invitation->purchaseOrder->id,
                    'po_number' => $invitation->purchaseOrder->po_number,
                ] : null,
            ];
        });

        return response()->json($paginated);
    }

    /**
     * Accept invitation by ID (authenticated users)
     */
    public function acceptById(Request $request, $id)
    {
        $user = $request->user();
        $invitation = Invitation::findOrFail($id);

        if ($user->email !== $invitation->invited_email) {
            return response()->json([
                'message' => 'You are not authorized to accept this invitation',
            ], 403);
        }

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'This invitation is no longer valid',
                'status' => $invitation->status,
            ], 422);
        }

        $invitation->accept();
        $this->processInvitationAcceptance($invitation, $user);

        $this->activityLog->log(
            'invitation_accepted',
            'Invitation',
            $invitation->id,
            "Invitation accepted by {$user->name}",
            [
                'invitation_type' => $invitation->invitation_type,
                'po_number' => $invitation->purchaseOrder->po_number,
            ]
        );

        return response()->json([
            'message' => 'Invitation accepted successfully',
            'invitation' => [
                'id' => $invitation->id,
                'invitation_type' => $invitation->invitation_type,
                'status' => $invitation->status,
            ],
        ]);
    }

    /**
     * Reject invitation by ID (authenticated users)
     */
    public function rejectById(Request $request, $id)
    {
        $user = $request->user();
        $invitation = Invitation::findOrFail($id);

        if ($user->email !== $invitation->invited_email) {
            return response()->json([
                'message' => 'You are not authorized to reject this invitation',
            ], 403);
        }

        if (!$invitation->isPending()) {
            return response()->json([
                'message' => 'This invitation is no longer valid',
                'status' => $invitation->status,
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $invitation->reject($request->reason);

        $this->activityLog->log(
            'invitation_rejected',
            'Invitation',
            $invitation->id,
            "Invitation rejected by {$user->name}",
            [
                'invitation_type' => $invitation->invitation_type,
                'po_number' => $invitation->purchaseOrder->po_number,
                'reason' => $request->reason,
            ]
        );

        return response()->json([
            'message' => 'Invitation rejected successfully',
        ]);
    }
}
