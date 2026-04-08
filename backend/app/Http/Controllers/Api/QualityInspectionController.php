<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QualityInspection;
use App\Models\InspectionDefect;
use App\Models\InspectionType;
use App\Models\DefectType;
use App\Models\Style;
use App\Services\ActivityLogService;
use App\Services\EmailService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class QualityInspectionController extends Controller
{
    protected $activityLog;
    protected $emailService;
    protected $permissionService;

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
     * Get quality inspections for a style
     */
    public function index(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view quality inspections',
            ], 403);
        }

        $query = QualityInspection::with([
            'inspectionType:id,name,code',
            'inspector:id,name,email',
            'submittedBy:id,name',
        ])
            ->where('style_id', $styleId);

        // Filter by inspection type
        if ($request->has('inspection_type_id')) {
            $query->where('inspection_type_id', $request->inspection_type_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by result
        if ($request->has('result')) {
            $query->where('inspection_result', $request->result);
        }

        // Filter by date range
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('inspected_at', [$request->start_date, $request->end_date]);
        }

        // Sort
        $sortField = $request->input('sort_field', 'inspected_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortField, $sortOrder);

        $perPage = $request->input('per_page', 25);
        $inspections = $query->paginate($perPage);

        return response()->json($inspections);
    }

    /**
     * Calculate AQL parameters for a new inspection
     */
    public function calculateAql(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to calculate AQL',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'lot_size' => 'required|integer|min:1',
            'inspection_level' => 'nullable|string|in:I,II,III',
            'aql_critical' => 'nullable|numeric|min:0',
            'aql_major' => 'nullable|numeric|min:0',
            'aql_minor' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $lotSize = $request->lot_size;
        $inspectionLevel = $request->input('inspection_level', 'II');
        $aqlCritical = $request->input('aql_critical', 0.065);
        $aqlMajor = $request->input('aql_major', 2.5);
        $aqlMinor = $request->input('aql_minor', 4.0);

        // Calculate sample size
        $sampleSize = QualityInspection::calculateSampleSize($lotSize, $inspectionLevel);

        // Get accept/reject numbers for each defect level
        $criticalLimits = QualityInspection::getAcceptRejectNumbers($sampleSize, $aqlCritical);
        $majorLimits = QualityInspection::getAcceptRejectNumbers($sampleSize, $aqlMajor);
        $minorLimits = QualityInspection::getAcceptRejectNumbers($sampleSize, $aqlMinor);

        return response()->json([
            'lot_size' => $lotSize,
            'inspection_level' => $inspectionLevel,
            'sample_size' => $sampleSize,
            'aql_levels' => [
                'critical' => [
                    'aql' => $aqlCritical,
                    'accept' => $criticalLimits['accept'],
                    'reject' => $criticalLimits['reject'],
                ],
                'major' => [
                    'aql' => $aqlMajor,
                    'accept' => $majorLimits['accept'],
                    'reject' => $majorLimits['reject'],
                ],
                'minor' => [
                    'aql' => $aqlMinor,
                    'accept' => $minorLimits['accept'],
                    'reject' => $minorLimits['reject'],
                ],
            ],
        ]);
    }

    /**
     * Create new quality inspection
     */
    public function store(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->canCreateInspection($user, $style, $po)) {
            return response()->json([
                'message' => 'You do not have permission to create quality inspections',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'inspection_type_id' => 'required|exists:inspection_types,id',
            'inspector_id' => 'required|exists:users,id',
            'inspected_at' => 'required|date|before_or_equal:today',
            'lot_size' => 'required|integer|min:1',
            'sample_size' => 'required|integer|min:1|lte:lot_size',
            'aql_critical' => 'required|numeric|min:0',
            'aql_major' => 'required|numeric|min:0',
            'aql_minor' => 'required|numeric|min:0',
            'critical_accept' => 'required|integer|min:0',
            'critical_reject' => 'required|integer|min:0',
            'major_accept' => 'required|integer|min:0',
            'major_reject' => 'required|integer|min:0',
            'minor_accept' => 'required|integer|min:0',
            'minor_reject' => 'required|integer|min:0',
            'inspection_location' => 'nullable|string|max:255',
            'temperature' => 'nullable|string|max:50',
            'humidity' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:2000',
            'images' => 'nullable|array',
            'images.*' => 'nullable|string|max:500',
            'defects' => 'nullable|array',
            'defects.*.defect_type_id' => 'required|exists:defect_types,id',
            'defects.*.quantity' => 'required|integer|min:1',
            'defects.*.description' => 'nullable|string|max:500',
            'defects.*.location' => 'nullable|string|max:255',
            'defects.*.images' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Generate inspection reference
            $inspectionReference = $this->generateInspectionReference($style);

            // Create inspection
            $inspection = QualityInspection::create([
                'style_id' => $styleId,
                'inspection_type_id' => $request->inspection_type_id,
                'inspector_id' => $request->inspector_id,
                'inspected_at' => $request->inspected_at,
                'inspection_reference' => $inspectionReference,
                'lot_size' => $request->lot_size,
                'sample_size' => $request->sample_size,
                'aql_level' => 'II', // Can be made configurable
                'aql_critical' => $request->aql_critical,
                'aql_major' => $request->aql_major,
                'aql_minor' => $request->aql_minor,
                'critical_accept' => $request->critical_accept,
                'critical_reject' => $request->critical_reject,
                'major_accept' => $request->major_accept,
                'major_reject' => $request->major_reject,
                'minor_accept' => $request->minor_accept,
                'minor_reject' => $request->minor_reject,
                'critical_found' => 0,
                'major_found' => 0,
                'minor_found' => 0,
                'total_defects_found' => 0,
                'status' => 'in_progress',
                'notes' => $request->notes,
                'images' => $request->images ?? [],
                'inspection_location' => $request->inspection_location,
                'temperature' => $request->temperature,
                'humidity' => $request->humidity,
                'submitted_by' => $user->id,
            ]);

            // Add defects if provided
            if ($request->has('defects') && is_array($request->defects)) {
                foreach ($request->defects as $defectData) {
                    $defectType = DefectType::find($defectData['defect_type_id']);

                    InspectionDefect::create([
                        'quality_inspection_id' => $inspection->id,
                        'defect_type_id' => $defectData['defect_type_id'],
                        'quantity' => $defectData['quantity'],
                        'description' => $defectData['description'] ?? null,
                        'location' => $defectData['location'] ?? null,
                        'images' => $defectData['images'] ?? [],
                        'severity' => $defectType->severity,
                    ]);
                }

                // Calculate result based on defects
                $inspection->calculateResult();
            }

            // Reload with relationships
            $inspection->load([
                'inspectionType',
                'inspector:id,name,email',
                'defects.defectType',
            ]);

            // Send notification to inspector
            $this->sendInspectionCreatedNotification($inspection);

            // Log activity
            $this->activityLog->log(
                'quality_inspection_created',
                'QualityInspection',
                $inspection->id,
                "Quality inspection {$inspectionReference} created",
                [
                    'style_number' => $style->style_number,
                    'inspection_type' => $inspection->inspectionType->name,
                    'result' => $inspection->inspection_result,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Quality inspection created successfully',
                'inspection' => $inspection,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create quality inspection',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get single quality inspection
     */
    public function show(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $inspection = QualityInspection::with([
            'style',
            'inspectionType',
            'inspector:id,name,email',
            'submittedBy:id,name',
            'approvedBy:id,name',
            'defects.defectType',
        ])->findOrFail($id);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view this quality inspection',
            ], 403);
        }

        // Add defect summary
        $inspection->defect_summary = $inspection->getDefectSummary();

        return response()->json($inspection);
    }

    /**
     * Update quality inspection
     */
    public function update(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $inspection = QualityInspection::with('style')->findOrFail($id);

        // Check permission
        if (!$this->canUpdateInspection($user, $inspection)) {
            return response()->json([
                'message' => 'You do not have permission to update this quality inspection',
            ], 403);
        }

        // Cannot update completed inspections
        if ($inspection->isCompleted()) {
            return response()->json([
                'message' => 'Cannot update completed quality inspection',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'inspection_location' => 'nullable|string|max:255',
            'temperature' => 'nullable|string|max:50',
            'humidity' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:2000',
            'images' => 'nullable|array',
            'images.*' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $inspection->fill($request->only([
            'inspection_location',
            'temperature',
            'humidity',
            'notes',
            'images',
        ]));
        $inspection->save();

        // Reload with relationships
        $inspection->load([
            'inspectionType',
            'inspector:id,name,email',
            'defects.defectType',
        ]);

        // Log activity
        $this->activityLog->log(
            'quality_inspection_updated',
            'QualityInspection',
            $inspection->id,
            "Quality inspection {$inspection->inspection_reference} updated",
            ['style_number' => $inspection->style->style_number]
        );

        return response()->json([
            'message' => 'Quality inspection updated successfully',
            'inspection' => $inspection,
        ]);
    }

    /**
     * Add defects to inspection
     */
    public function addDefects(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $inspection = QualityInspection::with('style')->findOrFail($id);

        // Check permission
        if (!$this->canUpdateInspection($user, $inspection)) {
            return response()->json([
                'message' => 'You do not have permission to add defects',
            ], 403);
        }

        // Cannot update completed inspections
        if ($inspection->isCompleted()) {
            return response()->json([
                'message' => 'Cannot add defects to completed quality inspection',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'defects' => 'required|array|min:1',
            'defects.*.defect_type_id' => 'required|exists:defect_types,id',
            'defects.*.quantity' => 'required|integer|min:1',
            'defects.*.description' => 'nullable|string|max:500',
            'defects.*.location' => 'nullable|string|max:255',
            'defects.*.images' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            foreach ($request->defects as $defectData) {
                $defectType = DefectType::find($defectData['defect_type_id']);

                InspectionDefect::create([
                    'quality_inspection_id' => $inspection->id,
                    'defect_type_id' => $defectData['defect_type_id'],
                    'quantity' => $defectData['quantity'],
                    'description' => $defectData['description'] ?? null,
                    'location' => $defectData['location'] ?? null,
                    'images' => $defectData['images'] ?? [],
                    'severity' => $defectType->severity,
                ]);
            }

            // Recalculate result
            $inspection->calculateResult();

            // Reload with relationships
            $inspection->load(['defects.defectType']);

            // Log activity
            $this->activityLog->log(
                'quality_inspection_defects_added',
                'QualityInspection',
                $inspection->id,
                count($request->defects) . " defects added to inspection {$inspection->inspection_reference}",
                ['style_number' => $inspection->style->style_number]
            );

            DB::commit();

            return response()->json([
                'message' => 'Defects added successfully',
                'inspection' => $inspection,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to add defects',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Complete inspection
     */
    public function complete(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $inspection = QualityInspection::with('style')->findOrFail($id);

        // Check permission
        if (!$this->canCompleteInspection($user, $inspection)) {
            return response()->json([
                'message' => 'You do not have permission to complete this quality inspection',
            ], 403);
        }

        if ($inspection->isCompleted()) {
            return response()->json([
                'message' => 'Quality inspection is already completed',
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Recalculate result one final time
            $inspection->calculateResult();

            // Mark as completed
            $inspection->markAsCompleted($user->id);

            // Reload with relationships
            $inspection->load([
                'inspectionType',
                'inspector:id,name,email',
                'defects.defectType',
                'approvedBy:id,name',
            ]);

            // Send notification
            $this->sendInspectionCompletedNotification($inspection);

            // Log activity
            $this->activityLog->log(
                'quality_inspection_completed',
                'QualityInspection',
                $inspection->id,
                "Quality inspection {$inspection->inspection_reference} completed with result: {$inspection->inspection_result}",
                [
                    'style_number' => $inspection->style->style_number,
                    'result' => $inspection->inspection_result,
                    'certificate_number' => $inspection->certificate_number,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Quality inspection completed successfully',
                'inspection' => $inspection,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to complete quality inspection',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download inspection certificate
     */
    public function certificate(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $inspection = QualityInspection::with('style')->findOrFail($id);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to download this certificate',
            ], 403);
        }

        if (!$inspection->certificate_number) {
            return response()->json([
                'message' => 'No certificate available for this inspection',
            ], 404);
        }

        // Return certificate data (actual PDF generation would be implemented separately)
        return response()->json([
            'certificate_number' => $inspection->certificate_number,
            'issued_at' => $inspection->certificate_issued_at,
            'inspection' => [
                'reference' => $inspection->inspection_reference,
                'date' => $inspection->inspected_at,
                'type' => $inspection->inspectionType->name,
                'result' => $inspection->inspection_result,
            ],
            'style' => [
                'style_number' => $inspection->style->style_number,
                'description' => $inspection->style->description,
            ],
            'po' => [
                'po_number' => $inspection->style->getEffectivePurchaseOrder()?->po_number,
            ],
            'aql' => [
                'lot_size' => $inspection->lot_size,
                'sample_size' => $inspection->sample_size,
                'defects' => $inspection->getDefectSummary(),
            ],
            'inspector' => [
                'name' => $inspection->inspector->name,
            ],
        ]);
    }

    /**
     * Get inspection statistics for a style
     */
    public function statistics(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = \App\Models\PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view inspection statistics',
            ], 403);
        }

        $totalInspections = QualityInspection::where('style_id', $styleId)->count();
        $passedInspections = QualityInspection::where('style_id', $styleId)->where('inspection_result', 'pass')->count();
        $failedInspections = QualityInspection::where('style_id', $styleId)->where('inspection_result', 'fail')->count();
        $inProgressInspections = QualityInspection::where('style_id', $styleId)->where('status', 'in_progress')->count();
        $completedInspections = QualityInspection::where('style_id', $styleId)->where('status', 'completed')->count();

        $passRate = $totalInspections > 0 ? round(($passedInspections / $totalInspections) * 100, 2) : 0;

        // Get inspections by type
        $byType = QualityInspection::where('style_id', $styleId)
            ->with('inspectionType:id,name')
            ->get()
            ->groupBy('inspection_type_id')
            ->map(function ($inspections, $typeId) {
                $type = $inspections->first()->inspectionType;
                return [
                    'type_name' => $type->name,
                    'total' => $inspections->count(),
                    'passed' => $inspections->where('inspection_result', 'pass')->count(),
                    'failed' => $inspections->where('inspection_result', 'fail')->count(),
                ];
            })
            ->values();

        // Get most common defects
        $commonDefects = InspectionDefect::whereHas('qualityInspection', function ($query) use ($styleId) {
            $query->where('style_id', $styleId);
        })
            ->with('defectType:id,name,severity')
            ->get()
            ->groupBy('defect_type_id')
            ->map(function ($defects, $typeId) {
                $defectType = $defects->first()->defectType;
                return [
                    'defect_type' => $defectType->name,
                    'severity' => $defectType->severity,
                    'total_count' => $defects->sum('quantity'),
                    'occurrences' => $defects->count(),
                ];
            })
            ->sortByDesc('total_count')
            ->take(10)
            ->values();

        return response()->json([
            'style_number' => $style->style_number,
            'total_inspections' => $totalInspections,
            'passed_inspections' => $passedInspections,
            'failed_inspections' => $failedInspections,
            'in_progress_inspections' => $inProgressInspections,
            'completed_inspections' => $completedInspections,
            'pass_rate' => $passRate,
            'by_type' => $byType,
            'common_defects' => $commonDefects,
        ]);
    }

    /**
     * Get inspection types (master data)
     */
    public function inspectionTypes(Request $request)
    {
        $types = InspectionType::active()->ordered()->get();
        return response()->json($types);
    }

    /**
     * Get defect types (master data)
     */
    public function defectTypes(Request $request)
    {
        $severity = $request->input('severity');

        $query = DefectType::active()->ordered();

        if ($severity) {
            $query->where('severity', $severity);
        }

        $types = $query->get();
        return response()->json($types);
    }

    /**
     * Generate inspection reference
     */
    private function generateInspectionReference(Style $style): string
    {
        $date = now()->format('Ymd');
        $random = strtoupper(substr(md5(uniqid()), 0, 4));
        return "QI-{$style->style_number}-{$date}-{$random}";
    }

    /**
     * Check if user can create inspection
     */
    private function canCreateInspection(object $user, Style $style, ?\App\Models\PurchaseOrder $po = null): bool
    {
        // Admin and QC inspectors can create
        if ($user->hasRole(['admin', 'qc_inspector'])) {
            return true;
        }

        // Check PO access
        $effectivePo = $po ?? $style->getEffectivePurchaseOrder();
        return $effectivePo && $this->permissionService->canAccessPurchaseOrder($user, $effectivePo);
    }

    /**
     * Check if user can update inspection
     */
    private function canUpdateInspection(object $user, QualityInspection $inspection): bool
    {
        // Admin can always update
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Inspector or submitter can update
        return $inspection->inspector_id === $user->id || $inspection->submitted_by === $user->id;
    }

    /**
     * Check if user can complete inspection
     */
    private function canCompleteInspection(object $user, QualityInspection $inspection): bool
    {
        // Admin or QC inspector with proper role can complete
        if ($user->hasRole(['admin', 'qc_inspector'])) {
            return true;
        }

        // Inspector can complete their own inspection
        return $inspection->inspector_id === $user->id;
    }

    /**
     * Send inspection created notification
     */
    private function sendInspectionCreatedNotification(QualityInspection $inspection): void
    {
        try {
            $this->emailService->sendTemplatedEmail(
                'quality_inspection_created',
                $inspection->inspector->email,
                [
                    'inspector_name' => $inspection->inspector->name,
                    'inspection_reference' => $inspection->inspection_reference,
                    'style_number' => $inspection->style->style_number,
                    'inspection_type' => $inspection->inspectionType->name,
                    'inspected_at' => $inspection->inspected_at->format('Y-m-d'),
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Failed to send inspection created notification: ' . $e->getMessage());
        }
    }

    /**
     * Send inspection completed notification
     */
    private function sendInspectionCompletedNotification(QualityInspection $inspection): void
    {
        try {
            $po = $inspection->style->getEffectivePurchaseOrder();
            if (!$po) {
                return;
            }

            // Notify importer
            $this->emailService->sendTemplatedEmail(
                'quality_inspection_completed',
                $po->importer->email,
                [
                    'importer_name' => $po->importer->name,
                    'inspection_reference' => $inspection->inspection_reference,
                    'po_number' => $po->po_number,
                    'style_number' => $inspection->style->style_number,
                    'inspection_type' => $inspection->inspectionType->name,
                    'result' => $inspection->inspection_result,
                    'certificate_number' => $inspection->certificate_number ?? 'N/A',
                ]
            );

            // Notify agency if assigned
            if ($po->agency_id) {
                $this->emailService->sendTemplatedEmail(
                    'quality_inspection_completed',
                    $po->agency->email,
                    [
                        'importer_name' => $po->agency->name,
                        'inspection_reference' => $inspection->inspection_reference,
                        'po_number' => $po->po_number,
                        'style_number' => $inspection->style->style_number,
                        'inspection_type' => $inspection->inspectionType->name,
                        'result' => $inspection->inspection_result,
                        'certificate_number' => $inspection->certificate_number ?? 'N/A',
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send inspection completed notification: ' . $e->getMessage());
        }
    }

    /**
     * Get all quality inspections across all POs and styles (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\QualityInspection::with([
            'style.purchaseOrders:id,po_number',
            'style:id,style_number',
            'inspectionType:id,name,code',
            'aqlLevel:id,name,code'
        ]);

        // Apply role-based filtering
        if ($user->hasRole('Factory')) {
            $query->whereHas('style', function($q) use ($user) {
                $q->where('assigned_factory_id', $user->id);
            });
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('style.purchaseOrders', function($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        // Result filter
        if ($request->has('inspection_result')) {
            $query->where('inspection_result', $request->inspection_result);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('certificate_number', 'like', "%{$search}%")
                  ->orWhereHas('style', function($sq) use ($search) {
                    $sq->where('style_number', 'like', "%{$search}%");
                  })->orWhereHas('style.purchaseOrders', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                  });
            });
        }

        return response()->json($query->orderBy('inspected_at', 'desc')->paginate($request->input('per_page', 20)));
    }
}
