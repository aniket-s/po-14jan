<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sample;
use App\Models\SampleType;
use App\Models\Style;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\EmailService;
use App\Services\PermissionService;
use App\Services\SampleExcelApprovalService;
use App\Jobs\SendSampleNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SampleController extends Controller
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
     * Get all samples for a style
     */
    public function index(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);

        if (!$style->belongsToPurchaseOrder($poId)) {
            return response()->json([
                'message' => 'Style does not belong to this purchase order',
            ], 404);
        }

        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to view samples for this style',
            ], 403);
        }

        $query = Sample::with(['sampleType', 'submittedBy', 'agencyApprovedBy', 'importerApprovedBy'])
            ->where('style_id', $styleId);

        if ($request->has('final_status')) {
            $query->where('final_status', $request->final_status);
        }

        if ($request->has('sample_type_id')) {
            $query->where('sample_type_id', $request->sample_type_id);
        }

        $samples = $query->orderBy('submission_date', 'desc')->get();

        return response()->json([
            'samples' => $samples->map(function ($sample) {
                return [
                    'id' => $sample->id,
                    'sample_type' => [
                        'id' => $sample->sampleType->id,
                        'name' => $sample->sampleType->name,
                        'display_name' => $sample->sampleType->display_name,
                    ],
                    'sample_reference' => $sample->sample_reference,
                    'submission_date' => $sample->submission_date?->format('Y-m-d'),
                    'submitted_by' => [
                        'id' => $sample->submittedBy->id,
                        'name' => $sample->submittedBy->name,
                    ],
                    'quantity' => $sample->quantity,
                    'agency_status' => $sample->agency_status,
                    'importer_status' => $sample->importer_status,
                    'final_status' => $sample->final_status,
                    'images' => $sample->images,
                    'created_at' => $sample->created_at,
                ];
            }),
        ]);
    }

    /**
     * Get single sample details
     */
    public function show(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $sample = Sample::with(['style', 'sampleType', 'submittedBy', 'agencyApprovedBy', 'importerApprovedBy'])
            ->findOrFail($id);

        if ($sample->style_id != $styleId || !$sample->style->belongsToPurchaseOrder($poId)) {
            return response()->json([
                'message' => 'Sample does not belong to this style/purchase order',
            ], 404);
        }

        if (!$this->permissionService->canAccessStyle($user, $sample->style)) {
            return response()->json([
                'message' => 'You do not have permission to view this sample',
            ], 403);
        }

        return response()->json([
            'sample' => [
                'id' => $sample->id,
                'style' => [
                    'id' => $sample->style->id,
                    'style_number' => $sample->style->style_number,
                ],
                'sample_type' => [
                    'id' => $sample->sampleType->id,
                    'name' => $sample->sampleType->name,
                    'display_name' => $sample->sampleType->display_name,
                    'description' => $sample->sampleType->description,
                ],
                'sample_reference' => $sample->sample_reference,
                'submission_date' => $sample->submission_date?->format('Y-m-d'),
                'submitted_by' => [
                    'id' => $sample->submittedBy->id,
                    'name' => $sample->submittedBy->name,
                    'email' => $sample->submittedBy->email,
                ],
                'quantity' => $sample->quantity,
                'notes' => $sample->notes,
                'attachment_paths' => $sample->attachment_paths,
                'images' => $sample->images,
                'agency_status' => $sample->agency_status,
                'agency_approved_by' => $sample->agencyApprovedBy ? [
                    'id' => $sample->agencyApprovedBy->id,
                    'name' => $sample->agencyApprovedBy->name,
                ] : null,
                'agency_approved_at' => $sample->agency_approved_at,
                'agency_rejection_reason' => $sample->agency_rejection_reason,
                'importer_status' => $sample->importer_status,
                'importer_approved_by' => $sample->importerApprovedBy ? [
                    'id' => $sample->importerApprovedBy->id,
                    'name' => $sample->importerApprovedBy->name,
                ] : null,
                'importer_approved_at' => $sample->importer_approved_at,
                'importer_rejection_reason' => $sample->importer_rejection_reason,
                'final_status' => $sample->final_status,
                'metadata' => $sample->metadata,
                'created_at' => $sample->created_at,
                'updated_at' => $sample->updated_at,
            ],
        ]);
    }

    /**
     * Submit new sample (factory submits)
     */
    public function store(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);

        if (!$style->belongsToPurchaseOrder($poId)) {
            return response()->json([
                'message' => 'Style does not belong to this purchase order',
            ], 404);
        }

        if (!$user->hasAnyPermission(['sample.create', 'sample.submit'])) {
            return response()->json([
                'message' => 'You do not have permission to submit samples',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'sample_type_id' => 'required|exists:sample_types,id',
            'sample_reference' => 'required|string|max:100',
            'submission_date' => 'required|date',
            'quantity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'attachment_paths' => 'nullable|array',
            'attachment_paths.*' => 'string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $sampleType = SampleType::findOrFail($request->sample_type_id);

        $existingSample = Sample::where('style_id', $styleId)
            ->where('sample_type_id', $request->sample_type_id)
            ->first();

        if ($existingSample) {
            return response()->json([
                'message' => 'A sample of this type already exists for this style',
                'existing_sample_id' => $existingSample->id,
            ], 422);
        }

        if (!$sampleType->allowsParallelSubmission()) {
            if (!$sampleType->prerequisitesMet($styleId)) {
                return response()->json([
                    'message' => 'Prerequisite sample types must be approved before submitting this sample',
                    'prerequisites' => $sampleType->prerequisites,
                ], 422);
            }
        }

        $sample = Sample::create([
            'style_id' => $styleId,
            'sample_type_id' => $request->sample_type_id,
            'submitted_by' => $user->id,
            'submission_date' => $request->submission_date,
            'sample_reference' => $request->sample_reference,
            'quantity' => $request->quantity,
            'notes' => $request->notes,
            'images' => $request->images,
            'attachment_paths' => $request->attachment_paths,
            'agency_status' => 'pending',
            'importer_status' => 'pending',
            'final_status' => 'pending',
        ]);

        $this->sendSampleSubmittedNotifications($sample, $style);

        $this->activityLog->logCreated('Sample', $sample->id, [
            'sample_type' => $sampleType->name,
            'style_number' => $style->style_number,
            'sample_reference' => $sample->sample_reference,
        ]);

        return response()->json([
            'message' => 'Sample submitted successfully',
            'sample' => [
                'id' => $sample->id,
                'sample_reference' => $sample->sample_reference,
                'sample_type' => [
                    'id' => $sampleType->id,
                    'name' => $sampleType->name,
                ],
                'final_status' => $sample->final_status,
            ],
        ], 201);
    }

    /**
     * Agency approves sample
     */
    public function agencyApprove(Request $request, $poId = null, $styleId = null, $id = null)
    {
        $user = $request->user();
        $sampleId = $id ?? $poId; // flat route: {id} maps to $poId
        $sample = Sample::with(['style'])->findOrFail($sampleId);

        if (!$this->canAgencyApprove($user, $sample)) {
            return response()->json([
                'message' => 'You do not have permission to approve this sample',
            ], 403);
        }

        if ($sample->agency_status !== 'pending') {
            return response()->json([
                'message' => 'Sample has already been reviewed by agency',
            ], 422);
        }

        $sample->agencyApprove($user->id);

        $this->sendAgencyApprovedNotification($sample);

        $this->activityLog->log(
            'sample_agency_approved',
            'Sample',
            $sample->id,
            "Agency approved sample {$sample->sample_reference}",
            [
                'sample_type' => $sample->sampleType->name,
                'style_number' => $sample->style->style_number,
            ]
        );

        return response()->json([
            'message' => 'Sample approved by agency successfully',
            'sample' => [
                'id' => $sample->id,
                'agency_status' => $sample->agency_status,
                'final_status' => $sample->final_status,
            ],
        ]);
    }

    /**
     * Agency rejects sample
     */
    public function agencyReject(Request $request, $poId = null, $styleId = null, $id = null)
    {
        $user = $request->user();
        $sampleId = $id ?? $poId;
        $sample = Sample::with(['style'])->findOrFail($sampleId);

        if (!$this->canAgencyApprove($user, $sample)) {
            return response()->json([
                'message' => 'You do not have permission to reject this sample',
            ], 403);
        }

        if ($sample->agency_status !== 'pending') {
            return response()->json([
                'message' => 'Sample has already been reviewed by agency',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $sample->agencyReject($user->id, $request->reason);

        $this->sendAgencyRejectedNotification($sample);

        $this->activityLog->log(
            'sample_agency_rejected',
            'Sample',
            $sample->id,
            "Agency rejected sample {$sample->sample_reference}",
            [
                'sample_type' => $sample->sampleType->name,
                'reason' => $request->reason,
            ]
        );

        return response()->json([
            'message' => 'Sample rejected by agency',
            'sample' => [
                'id' => $sample->id,
                'agency_status' => $sample->agency_status,
                'final_status' => $sample->final_status,
            ],
        ]);
    }

    /**
     * Importer approves sample
     */
    public function importerApprove(Request $request, $poId = null, $styleId = null, $id = null)
    {
        $user = $request->user();
        $sampleId = $id ?? $poId;
        $sample = Sample::with(['style'])->findOrFail($sampleId);

        if (!$this->canImporterApprove($user, $sample)) {
            return response()->json([
                'message' => 'You do not have permission to approve this sample',
            ], 403);
        }

        if ($sample->agency_status !== 'approved') {
            return response()->json([
                'message' => 'Sample must be approved by agency first',
            ], 422);
        }

        if ($sample->importer_status !== 'pending') {
            return response()->json([
                'message' => 'Sample has already been reviewed by importer',
            ], 422);
        }

        $sample->importerApprove($user->id);

        $this->sendImporterApprovedNotification($sample);

        $this->activityLog->log(
            'sample_importer_approved',
            'Sample',
            $sample->id,
            "Importer approved sample {$sample->sample_reference}",
            [
                'sample_type' => $sample->sampleType->name,
                'style_number' => $sample->style->style_number,
            ]
        );

        return response()->json([
            'message' => 'Sample approved by importer successfully',
            'sample' => [
                'id' => $sample->id,
                'importer_status' => $sample->importer_status,
                'final_status' => $sample->final_status,
            ],
        ]);
    }

    /**
     * Importer rejects sample
     */
    public function importerReject(Request $request, $poId = null, $styleId = null, $id = null)
    {
        $user = $request->user();
        $sampleId = $id ?? $poId;
        $sample = Sample::with(['style'])->findOrFail($sampleId);

        if (!$this->canImporterApprove($user, $sample)) {
            return response()->json([
                'message' => 'You do not have permission to reject this sample',
            ], 403);
        }

        if ($sample->agency_status !== 'approved') {
            return response()->json([
                'message' => 'Sample must be approved by agency first',
            ], 422);
        }

        if ($sample->importer_status !== 'pending') {
            return response()->json([
                'message' => 'Sample has already been reviewed by importer',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $sample->importerReject($user->id, $request->reason);

        $this->sendImporterRejectedNotification($sample);

        $this->activityLog->log(
            'sample_importer_rejected',
            'Sample',
            $sample->id,
            "Importer rejected sample {$sample->sample_reference}",
            [
                'sample_type' => $sample->sampleType->name,
                'reason' => $request->reason,
            ]
        );

        return response()->json([
            'message' => 'Sample rejected by importer',
            'sample' => [
                'id' => $sample->id,
                'importer_status' => $sample->importer_status,
                'final_status' => $sample->final_status,
            ],
        ]);
    }

    /**
     * Agency bulk approve/reject samples via Excel upload
     */
    public function bulkApproveExcel(Request $request)
    {
        $user = $request->user();

        if (!$user->hasRole('Agency') && !$user->hasRole('Super Admin') && !$user->hasRole('Admin')) {
            return response()->json([
                'message' => 'Only agency users can bulk update sample approvals via Excel',
            ], 403);
        }

        if (!$user->hasAnyPermission(['sample.agency_approve', 'sample.factory_approve', 'sample.bulk_approve'])) {
            return response()->json([
                'message' => 'You do not have permission to bulk approve samples',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $service = app(SampleExcelApprovalService::class);
        $result = $service->processApprovals($request->file('file'), $user);

        $this->activityLog->log(
            'sample_bulk_approval_excel',
            'Sample',
            null,
            "Agency bulk updated {$result['processed']} sample approvals via Excel",
            ['result' => $result]
        );

        return response()->json([
            'message' => "Processed {$result['processed']} samples",
            'result' => $result,
        ]);
    }

    /**
     * Get available sample types for a style
     */
    public function availableSampleTypes(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);

        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to view sample types for this style',
            ], 403);
        }

        $sampleTypes = SampleType::active()->ordered()->get();
        $submittedSamples = Sample::where('style_id', $styleId)->get();

        // Pre-compute which prerequisite types are approved to avoid N+1 queries
        $approvedTypeIds = $submittedSamples
            ->where('final_status', 'approved')
            ->pluck('sample_type_id')
            ->toArray();

        // Cache all sample type names for prerequisite lookups
        $sampleTypesByName = $sampleTypes->keyBy(function ($t) {
            return strtolower($t->name);
        });

        $availableTypes = $sampleTypes->map(function ($type) use ($submittedSamples, $approvedTypeIds, $sampleTypesByName) {
            $existingSample = $submittedSamples->firstWhere('sample_type_id', $type->id);

            $canSubmit = !$existingSample;

            if ($canSubmit && !$type->allowsParallelSubmission()) {
                // Check prerequisites in-memory instead of querying DB per type
                $prerequisites = $type->prerequisites ?? [];
                $canSubmit = empty($prerequisites);
                if (!$canSubmit) {
                    $canSubmit = true;
                    foreach ($prerequisites as $prereqName) {
                        $prereqType = $sampleTypesByName->get(strtolower($prereqName));
                        if (!$prereqType || !in_array($prereqType->id, $approvedTypeIds)) {
                            $canSubmit = false;
                            break;
                        }
                    }
                }
            }

            return [
                'id' => $type->id,
                'name' => $type->name,
                'display_name' => $type->display_name,
                'description' => $type->description,
                'display_order' => $type->display_order,
                'allows_parallel_submission' => $type->allowsParallelSubmission(),
                'prerequisites' => $type->prerequisites,
                'can_submit' => $canSubmit,
                'existing_sample' => $existingSample ? [
                    'id' => $existingSample->id,
                    'sample_reference' => $existingSample->sample_reference,
                    'final_status' => $existingSample->final_status,
                ] : null,
            ];
        });

        return response()->json([
            'sample_types' => $availableTypes,
        ]);
    }

    /**
     * Check if user can agency approve (agency role + linked to PO)
     */
    private function canAgencyApprove(User $user, Sample $sample): bool
    {
        if (!$user->hasPermissionTo('sample.agency_approve') && !$user->hasPermissionTo('sample.factory_approve')) {
            return false;
        }

        $po = $sample->style->getEffectivePurchaseOrder();
        if (!$po) {
            return false;
        }

        // Agency must be assigned to or creator of the PO
        return $po->agency_id === $user->id || $po->creator_id === $user->id || $user->hasRole('Super Admin');
    }

    /**
     * Check if user can importer approve
     */
    private function canImporterApprove(User $user, Sample $sample): bool
    {
        if (!$user->hasPermissionTo('sample.approve_final')) {
            return false;
        }

        $po = $sample->style->getEffectivePurchaseOrder();
        if (!$po) {
            return false;
        }

        return $po->importer_id === $user->id || $user->hasRole('Super Admin');
    }

    /**
     * Send sample submitted notifications (to agency and importer)
     */
    private function sendSampleSubmittedNotifications(Sample $sample, Style $style): void
    {
        $po = $style->getEffectivePurchaseOrder();
        if (!$po) {
            return;
        }

        // Notify agency
        if ($po->agency_id) {
            $agency = User::find($po->agency_id);
            if ($agency) {
                SendSampleNotification::dispatch($sample, $agency, 'submitted');
                $this->emailService->sendFromTemplate(
                    'sample_submitted',
                    $agency->email,
                    [
                        'factory_name' => $agency->name,
                        'po_number' => $po->po_number,
                        'style_number' => $style->style_number,
                        'sample_type' => $sample->sampleType->name,
                        'sample_reference' => $sample->sample_reference,
                    ]
                );
            }
        }

        // Notify importer
        if ($po->importer) {
            SendSampleNotification::dispatch($sample, $po->importer, 'submitted');
            $this->emailService->sendFromTemplate(
                'sample_submitted_to_importer',
                $po->importer->email,
                [
                    'importer_name' => $po->importer->name,
                    'po_number' => $po->po_number,
                    'style_number' => $style->style_number,
                    'sample_type' => $sample->sampleType->name,
                    'sample_reference' => $sample->sample_reference,
                ]
            );
        }
    }

    /**
     * Send agency approved notification to importer
     */
    private function sendAgencyApprovedNotification(Sample $sample): void
    {
        $po = $sample->style->getEffectivePurchaseOrder();
        if (!$po || !$po->importer) {
            return;
        }

        SendSampleNotification::dispatch($sample, $po->importer, 'approved');
        $this->emailService->sendFromTemplate(
            'sample_approved_by_agency',
            $po->importer->email,
            [
                'importer_name' => $po->importer->name,
                'po_number' => $po->po_number,
                'style_number' => $sample->style->style_number,
                'sample_type' => $sample->sampleType->name,
                'sample_reference' => $sample->sample_reference,
            ]
        );
    }

    /**
     * Send agency rejected notification to factory (submitter)
     */
    private function sendAgencyRejectedNotification(Sample $sample): void
    {
        if ($sample->submittedBy) {
            SendSampleNotification::dispatch($sample, $sample->submittedBy, 'rejected', $sample->agency_rejection_reason);
        }
        $po = $sample->style->getEffectivePurchaseOrder();
        $this->emailService->sendFromTemplate(
            'sample_factory_rejected',
            $sample->submittedBy->email,
            [
                'factory_name' => $sample->submittedBy->name,
                'po_number' => $po?->po_number,
                'sample_type' => $sample->sampleType->name,
                'rejection_reason' => $sample->agency_rejection_reason,
            ]
        );
    }

    /**
     * Send importer approved notification to factory
     */
    private function sendImporterApprovedNotification(Sample $sample): void
    {
        $po = $sample->style->getEffectivePurchaseOrder();
        if (!$po) {
            return;
        }

        // Notify the factory who submitted the sample
        if ($sample->submittedBy) {
            SendSampleNotification::dispatch($sample, $sample->submittedBy, 'approved');
            $this->emailService->sendFromTemplate(
                'sample_fully_approved',
                $sample->submittedBy->email,
                [
                    'factory_name' => $sample->submittedBy->name,
                    'po_number' => $po->po_number,
                    'style_number' => $sample->style->style_number,
                    'sample_type' => $sample->sampleType->name,
                ]
            );
        }
    }

    /**
     * Send importer rejected notification to factory
     */
    private function sendImporterRejectedNotification(Sample $sample): void
    {
        $po = $sample->style->getEffectivePurchaseOrder();
        if (!$po) {
            return;
        }

        if ($sample->submittedBy) {
            SendSampleNotification::dispatch($sample, $sample->submittedBy, 'rejected', $sample->importer_rejection_reason);
            $this->emailService->sendFromTemplate(
                'sample_importer_rejected',
                $sample->submittedBy->email,
                [
                    'factory_name' => $sample->submittedBy->name,
                    'po_number' => $po->po_number,
                    'sample_type' => $sample->sampleType->name,
                    'rejection_reason' => $sample->importer_rejection_reason,
                ]
            );
        }
    }

    /**
     * Get all samples across all POs and styles (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = Sample::with([
            'style.purchaseOrders:id,po_number',
            'style:id,style_number',
            'sampleType:id,name,display_name',
            'submittedBy:id,name,email',
            'agencyApprovedBy:id,name',
            'importerApprovedBy:id,name'
        ]);

        // Apply role-based filtering
        if ($user->hasRole('Factory')) {
            $query->whereHas('style', function($q) use ($user) {
                $q->where('assigned_factory_id', $user->id)
                  ->orWhereHas('purchaseOrders', function($pq) use ($user) {
                      $pq->where('purchase_order_style.assigned_factory_id', $user->id);
                  });
            });
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('style.purchaseOrders', function($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        } elseif ($user->hasRole('Agency')) {
            $query->whereHas('style.purchaseOrders', function($q) use ($user) {
                $q->where('purchase_orders.agency_id', $user->id)
                  ->orWhere('purchase_orders.creator_id', $user->id);
            });
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('final_status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->whereHas('style', function($sq) use ($search) {
                    $sq->where('style_number', 'like', "%{$search}%");
                })->orWhereHas('style.purchaseOrders', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                });
            });
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 20)));
    }

    /**
     * Submit new sample (aggregate endpoint - style_id in body)
     */
    public function storeAll(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'style_id' => 'required|exists:styles,id',
            'sample_type_id' => 'required|exists:sample_types,id',
            'sample_reference' => 'nullable|string|max:100',
            'submission_date' => 'nullable|date',
            'quantity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'attachment_paths' => 'nullable|array',
            'attachment_paths.*' => 'string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $style = Style::findOrFail($request->style_id);

        if (!$user->hasAnyPermission(['sample.create', 'sample.submit'])) {
            return response()->json([
                'message' => 'You do not have permission to submit samples',
            ], 403);
        }

        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to submit samples for this style',
            ], 403);
        }

        $sampleType = SampleType::findOrFail($request->sample_type_id);

        $existingSample = Sample::where('style_id', $request->style_id)
            ->where('sample_type_id', $request->sample_type_id)
            ->first();

        if ($existingSample) {
            return response()->json([
                'message' => 'A sample of this type already exists for this style',
                'existing_sample_id' => $existingSample->id,
            ], 422);
        }

        if (!$sampleType->allowsParallelSubmission()) {
            if (!$sampleType->prerequisitesMet($request->style_id)) {
                return response()->json([
                    'message' => 'Prerequisite sample types must be approved before submitting this sample',
                    'prerequisites' => $sampleType->prerequisites,
                ], 422);
            }
        }

        $sampleReference = $request->sample_reference;
        if (!$sampleReference) {
            $sampleReference = $style->style_number . '-ST' . $sampleType->id . '-' . date('YmdHis');
        }

        $submissionDate = $request->submission_date ?? now();

        $sample = Sample::create([
            'style_id' => $request->style_id,
            'sample_type_id' => $request->sample_type_id,
            'submitted_by' => $user->id,
            'submission_date' => $submissionDate,
            'sample_reference' => $sampleReference,
            'quantity' => $request->quantity,
            'notes' => $request->notes,
            'images' => $request->images,
            'attachment_paths' => $request->attachment_paths,
            'agency_status' => 'pending',
            'importer_status' => 'pending',
            'final_status' => 'pending',
        ]);

        $this->sendSampleSubmittedNotifications($sample, $style);

        $this->activityLog->logCreated('Sample', $sample->id, [
            'sample_type' => $sampleType->name,
            'style_number' => $style->style_number,
            'sample_reference' => $sample->sample_reference,
        ]);

        return response()->json([
            'message' => 'Sample submitted successfully',
            'sample' => [
                'id' => $sample->id,
                'sample_reference' => $sample->sample_reference,
                'sample_type' => [
                    'id' => $sampleType->id,
                    'name' => $sampleType->name,
                ],
                'final_status' => $sample->final_status,
            ],
        ], 201);
    }

    /**
     * Get a single sample (aggregate endpoint)
     */
    public function showSample(Request $request, $id)
    {
        $user = $request->user();
        $sample = Sample::with([
            'style.purchaseOrders:id,po_number',
            'sampleType',
            'submittedBy',
            'agencyApprovedBy',
            'importerApprovedBy',
        ])->findOrFail($id);

        if (!$this->permissionService->canAccessStyle($user, $sample->style)) {
            return response()->json(['message' => 'You do not have permission to view this sample'], 403);
        }

        return response()->json(['sample' => $sample]);
    }

    /**
     * Resubmit a rejected sample (factory resubmits with updated data)
     */
    public function resubmit(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->hasAnyPermission(['sample.create', 'sample.submit'])) {
            return response()->json(['message' => 'You do not have permission to resubmit samples'], 403);
        }

        $sample = Sample::with(['style', 'sampleType'])->findOrFail($id);

        if (!$this->permissionService->canAccessStyle($user, $sample->style)) {
            return response()->json(['message' => 'You do not have permission to resubmit this sample'], 403);
        }

        // Only rejected samples can be resubmitted
        if ($sample->final_status !== 'rejected') {
            return response()->json([
                'message' => 'Only rejected samples can be resubmitted (current status: ' . $sample->final_status . ')',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'attachment_paths' => 'nullable|array',
            'attachment_paths.*' => 'string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        // Reset the sample statuses and update with new data
        $sample->update([
            'submitted_by' => $user->id,
            'submission_date' => now(),
            'notes' => $request->notes ?? $sample->notes,
            'images' => $request->has('images') ? $request->images : $sample->images,
            'attachment_paths' => $request->has('attachment_paths') ? $request->attachment_paths : $sample->attachment_paths,
            'agency_status' => 'pending',
            'agency_approved_by' => null,
            'agency_approved_at' => null,
            'agency_rejection_reason' => null,
            'importer_status' => 'pending',
            'importer_approved_by' => null,
            'importer_approved_at' => null,
            'importer_rejection_reason' => null,
            'final_status' => 'pending',
        ]);

        $this->sendSampleSubmittedNotifications($sample, $sample->style);

        $this->activityLog->log(
            'sample_resubmitted',
            'Sample',
            $sample->id,
            'Sample resubmitted after rejection',
            [
                'sample_type' => $sample->sampleType->name,
                'style_number' => $sample->style->style_number,
                'sample_reference' => $sample->sample_reference,
            ]
        );

        return response()->json([
            'message' => 'Sample resubmitted successfully',
            'sample' => $sample->fresh(['style', 'sampleType', 'submittedBy']),
        ]);
    }

    /**
     * Delete a sample (only own pending samples)
     */
    public function destroySample(Request $request, $id)
    {
        $user = $request->user();

        $sample = Sample::with(['style', 'sampleType'])->findOrFail($id);

        // Must be the one who submitted it
        if ($sample->submitted_by !== $user->id && !$user->hasRole('Super Admin')) {
            return response()->json(['message' => 'You can only delete your own samples'], 403);
        }

        // Can only delete pending samples (not yet approved/rejected at any level)
        if ($sample->agency_status !== 'pending') {
            return response()->json([
                'message' => 'Cannot delete this sample as it has already been reviewed',
            ], 422);
        }

        $sampleData = [
            'sample_type' => $sample->sampleType?->name,
            'style_number' => $sample->style?->style_number,
            'sample_reference' => $sample->sample_reference,
        ];

        $this->activityLog->logDeleted('Sample', $sample->id, $sampleData);

        $sample->delete();

        return response()->json(['message' => 'Sample deleted successfully']);
    }

    /**
     * Get full sample details with timeline
     */
    public function timeline(Request $request, $id)
    {
        $user = $request->user();
        $sample = Sample::with([
            'style.purchaseOrders',
            'sampleType',
            'submittedBy:id,name,email',
            'agencyApprovedBy:id,name',
            'importerApprovedBy:id,name',
        ])->findOrFail($id);

        // Permission check via style access
        if (!$this->permissionService->canAccessStyle($user, $sample->style)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Fetch activity logs for this sample
        $logs = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.id',
                'activity_logs.action',
                'activity_logs.description',
                'activity_logs.metadata',
                'activity_logs.created_at',
                'users.name as user_name'
            )
            ->where('activity_logs.resource_type', 'Sample')
            ->where('activity_logs.resource_id', $id)
            ->orderBy('activity_logs.created_at', 'asc')
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'description' => $log->description,
                    'user_name' => $log->user_name,
                    'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                    'created_at' => $log->created_at,
                ];
            });

        return response()->json([
            'sample' => [
                'id' => $sample->id,
                'sample_reference' => $sample->sample_reference,
                'submission_date' => $sample->submission_date?->format('Y-m-d'),
                'quantity' => $sample->quantity,
                'notes' => $sample->notes,
                'images' => $sample->images,
                'attachment_paths' => $sample->attachment_paths,
                'agency_status' => $sample->agency_status,
                'agency_approved_by' => $sample->agencyApprovedBy ? [
                    'id' => $sample->agencyApprovedBy->id,
                    'name' => $sample->agencyApprovedBy->name,
                ] : null,
                'agency_approved_at' => $sample->agency_approved_at?->toISOString(),
                'agency_rejection_reason' => $sample->agency_rejection_reason,
                'importer_status' => $sample->importer_status,
                'importer_approved_by' => $sample->importerApprovedBy ? [
                    'id' => $sample->importerApprovedBy->id,
                    'name' => $sample->importerApprovedBy->name,
                ] : null,
                'importer_approved_at' => $sample->importer_approved_at?->toISOString(),
                'importer_rejection_reason' => $sample->importer_rejection_reason,
                'final_status' => $sample->final_status,
                'created_at' => $sample->created_at,
                'style' => $sample->style ? [
                    'style_number' => $sample->style->style_number,
                    'description' => $sample->style->description,
                ] : null,
                'sample_type' => $sample->sampleType ? [
                    'name' => $sample->sampleType->name,
                    'display_name' => $sample->sampleType->display_name,
                ] : null,
                'submitted_by' => $sample->submittedBy ? [
                    'id' => $sample->submittedBy->id,
                    'name' => $sample->submittedBy->name,
                ] : null,
                'po_number' => $sample->style?->purchaseOrders?->first()?->po_number,
            ],
            'timeline' => $logs,
        ]);
    }
}
