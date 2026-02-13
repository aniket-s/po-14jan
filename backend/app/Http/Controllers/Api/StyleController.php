<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Models\StylePrepack;
use App\Models\PrepackCode;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class StyleController extends Controller
{
    protected ActivityLogService $activityLog;
    protected PermissionService $permissionService;

    public function __construct(ActivityLogService $activityLog, PermissionService $permissionService)
    {
        $this->activityLog = $activityLog;
        $this->permissionService = $permissionService;
    }

    /**
     * Get styles for a purchase order
     */
    public function index(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view styles for this purchase order',
            ], 403);
        }

        $query = Style::with(['assignedFactory', 'prepacks.prepackCode'])->where('po_id', $poId);

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Assignment type filter
        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        // Factory filter
        if ($request->has('factory_id')) {
            if ($request->factory_id === 'null') {
                $query->whereNull('assigned_factory_id');
            } else {
                $query->where('assigned_factory_id', $request->factory_id);
            }
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('style_number', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $styles = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'styles' => $styles->map(function ($style) {
                return [
                    'id' => $style->id,
                    'style_number' => $style->style_number,
                    'description' => $style->description,
                    'fabric' => $style->fabric,
                    'color' => $style->color,
                    'size_breakup' => $style->size_breakup,
                    'packing_details' => $style->packing_details,
                    'quantity' => $style->total_quantity,
                    'unit_price' => $style->unit_price,
                    'fob_price' => $style->fob_price,
                    'assigned_factory' => $style->assignedFactory ? [
                        'id' => $style->assignedFactory->id,
                        'name' => $style->assignedFactory->name,
                        'company' => $style->assignedFactory->company,
                    ] : null,
                    'assignment_type' => $style->assignment_type,
                    'target_production_date' => $style->target_production_date?->format('Y-m-d'),
                    'target_shipment_date' => $style->target_shipment_date?->format('Y-m-d'),
                    'ex_factory_date' => $style->ex_factory_date?->format('Y-m-d'),
                    'status' => $style->status,
                    'created_at' => $style->created_at,
                ];
            }),
        ]);
    }

    /**
     * Get single style
     */
    public function show(Request $request, $poId, $id)
    {
        $user = $request->user();
        $style = Style::with(['purchaseOrder', 'assignedFactory', 'prepacks.prepackCode'])->findOrFail($id);

        // Verify style belongs to PO
        if ($style->po_id != $poId) {
            return response()->json([
                'message' => 'Style does not belong to this purchase order',
            ], 404);
        }

        // Check permission
        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to view this style',
            ], 403);
        }

        return response()->json([
            'style' => [
                'id' => $style->id,
                'po_id' => $style->po_id,
                'style_number' => $style->style_number,
                'description' => $style->description,
                'fabric' => $style->fabric,
                'color' => $style->color,
                'size_breakdown' => $style->size_breakdown,
                'packing_details' => $style->packing_details,
                'quantity' => $style->quantity,
                'unit_price' => $style->unit_price,
                'total_price' => $style->total_price,
                'assigned_factory' => $style->assignedFactory ? [
                    'id' => $style->assignedFactory->id,
                    'name' => $style->assignedFactory->name,
                    'email' => $style->assignedFactory->email,
                    'company' => $style->assignedFactory->company,
                ] : null,
                'assignment_type' => $style->assignment_type,
                'assigned_at' => $style->assigned_at,
                'target_production_date' => $style->target_production_date?->format('Y-m-d'),
                'target_shipment_date' => $style->target_shipment_date?->format('Y-m-d'),
                'technical_file_paths' => $style->technical_file_paths,
                'images' => $style->images,
                'status' => $style->status,
                'metadata' => $style->metadata,
                'prepacks' => $style->prepacks->map(function ($sp) {
                    return [
                        'id' => $sp->id,
                        'prepack_code' => [
                            'id' => $sp->prepackCode->id,
                            'code' => $sp->prepackCode->code,
                            'name' => $sp->prepackCode->name,
                            'size_range' => $sp->prepackCode->size_range,
                            'ratio' => $sp->prepackCode->ratio,
                            'sizes' => $sp->prepackCode->sizes,
                            'total_pieces_per_pack' => $sp->prepackCode->total_pieces_per_pack,
                        ],
                        'quantity' => $sp->quantity,
                        'total_pieces' => $sp->total_pieces,
                        'piece_breakdown' => $sp->piece_breakdown,
                        'notes' => $sp->notes,
                    ];
                }),
                'created_at' => $style->created_at,
                'updated_at' => $style->updated_at,
            ],
        ]);
    }

    /**
     * Create new style
     */
    public function store(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('style.create')) {
            return response()->json([
                'message' => 'You do not have permission to create styles for this purchase order',
            ], 403);
        }

        // Check agency upload permission
        if ($user->hasRole('agency')) {
            $setting = \App\Models\SystemSetting::where('key', 'agency_style_upload_enabled')->first();
            $isEnabled = $setting ? ($setting->value === 'true' || $setting->value === true) : true;

            if (!$isEnabled) {
                return response()->json([
                    'message' => 'Style upload is currently disabled for agencies. Please contact your administrator.',
                ], 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'style_number' => 'required|string|max:100',
            'description' => 'nullable|string',
            'fabric' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:100',
            'size_breakdown' => 'nullable|array',
            'quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'target_production_date' => 'nullable|date',
            'target_shipment_date' => 'nullable|date|after:target_production_date',
            'technical_file_paths' => 'nullable|array',
            'images' => 'nullable|array',
            'status' => 'nullable|string|max:50',
            'assignment_type' => 'nullable|in:direct_to_factory,via_agency',
            'assigned_factory_id' => 'nullable|exists:users,id',
            'assigned_agency_id' => 'nullable|exists:users,id',
            // Pack details
            'packing_details' => 'nullable|array',
            'packing_details.packs' => 'nullable|array',
            'packing_details.total_quantity' => 'nullable|integer',
            'packing_details.overall_size_breakdown' => 'nullable|array',
            // Prepacks
            'prepacks' => 'nullable|array',
            'prepacks.*.prepack_code_id' => 'required|exists:prepack_codes,id',
            'prepacks.*.quantity' => 'required|integer|min:1',
            'prepacks.*.notes' => 'nullable|string',
            // Master data foreign keys
            'brand_id' => 'nullable|exists:brands,id',
            'gender_id' => 'required|exists:genders,id', // REQUIRED for size management
            // Enhanced style fields
            'color_code' => 'nullable|string|max:50',
            'color_name' => 'nullable|string|max:100',
            'fabric_name' => 'nullable|string|max:255',
            'fabric_type' => 'nullable|string|max:100',
            'fabric_type_name' => 'nullable|string|max:255',
            'fabric_weight' => 'nullable|string|max:50',
            'country_of_origin' => 'nullable|string|max:100',
            'item_description' => 'nullable|string',
            'tp_date' => 'nullable|date',
            'fit' => 'nullable|string|max:100',
            'fob_price' => 'nullable|numeric|min:0',
            // Trims association
            'trims' => 'nullable|array',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check style number uniqueness within PO
        $existingStyle = Style::where('po_id', $poId)
            ->where('style_number', $request->style_number)
            ->first();

        if ($existingStyle) {
            return response()->json([
                'message' => 'Style number already exists in this purchase order',
            ], 422);
        }

        // Calculate total price only if both quantity and unit_price are provided
        $totalPrice = ($request->quantity && $request->unit_price)
            ? $request->quantity * $request->unit_price
            : null;

        $style = Style::create([
            'po_id' => $poId,
            'style_number' => $request->style_number,
            'description' => $request->description,
            'fabric' => $request->fabric,
            'color' => $request->color,
            'size_breakdown' => $request->size_breakdown,
            'quantity' => $request->quantity,
            'unit_price' => $request->unit_price,
            'total_price' => $totalPrice,
            'fob_price' => $request->fob_price,
            'packing_details' => $request->packing_details,
            'target_production_date' => $request->target_production_date,
            'target_shipment_date' => $request->target_shipment_date,
            'technical_file_paths' => $request->technical_file_paths,
            'images' => $request->images,
            'status' => $request->get('status', 'pending'),
            'assignment_type' => $request->assignment_type,
            'assigned_factory_id' => $request->assigned_factory_id,
            'assigned_agency_id' => $request->assigned_agency_id,
            // Master data foreign keys
            'brand_id' => $request->brand_id,
            'gender_id' => $request->gender_id,
            // Enhanced style fields
            'color_code' => $request->color_code,
            'color_name' => $request->color_name,
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $request->fabric_type_name,
            'fabric_weight' => $request->fabric_weight,
            'country_of_origin' => $request->country_of_origin,
            'item_description' => $request->item_description,
            'created_by' => $user->id,
            'tp_date' => $request->tp_date,
            'fit' => $request->fit,
        ]);

        // Create StylePrepack records if prepacks are provided
        if ($request->has('prepacks') && is_array($request->prepacks)) {
            foreach ($request->prepacks as $prepack) {
                $prepackCode = PrepackCode::find($prepack['prepack_code_id']);
                if ($prepackCode) {
                    $totalPieces = $prepackCode->total_pieces_per_pack * ($prepack['quantity'] ?? 1);

                    StylePrepack::create([
                        'style_id' => $style->id,
                        'prepack_code_id' => $prepack['prepack_code_id'],
                        'quantity' => $prepack['quantity'] ?? 1,
                        'total_pieces' => $totalPieces,
                        'piece_breakdown' => $prepackCode->sizes,
                        'notes' => $prepack['notes'] ?? null,
                    ]);
                }
            }
        }

        // Attach trims if provided
        if ($request->has('trims') && is_array($request->trims)) {
            foreach ($request->trims as $trim) {
                $style->trims()->attach($trim['trim_id'], [
                    'quantity' => $trim['quantity'] ?? null,
                    'notes' => $trim['notes'] ?? null,
                ]);
            }
        }

        // Update PO totals
        $po->updateTotals();

        // Log creation
        $this->activityLog->logCreated('Style', $style->id, [
            'style_number' => $style->style_number,
            'po_number' => $po->po_number,
            'quantity' => $style->quantity,
        ]);

        return response()->json([
            'message' => 'Style created successfully',
            'style' => [
                'id' => $style->id,
                'style_number' => $style->style_number,
                'quantity' => $style->quantity,
                'total_price' => $style->total_price,
                'status' => $style->status,
            ],
        ], 201);
    }

    /**
     * Update style
     */
    public function update(Request $request, $poId, $id)
    {
        $user = $request->user();
        $style = Style::findOrFail($id);

        // Verify style belongs to PO
        if ($style->po_id != $poId) {
            return response()->json([
                'message' => 'Style does not belong to this purchase order',
            ], 404);
        }

        // Check permission
        if (!$this->permissionService->canAccessStyle($user, $style) || !$user->hasPermissionTo('style.edit')) {
            return response()->json([
                'message' => 'You do not have permission to edit this style',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'style_number' => 'required|string|max:100',
            'description' => 'nullable|string',
            'fabric' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:100',
            'size_breakdown' => 'nullable|array',
            'quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'fob_price' => 'nullable|numeric|min:0',
            'target_production_date' => 'nullable|date',
            'target_shipment_date' => 'nullable|date|after:target_production_date',
            'technical_file_paths' => 'nullable|array',
            'images' => 'nullable|array',
            'status' => 'nullable|string|max:50',
            // Enhanced fields
            'color_code' => 'nullable|string|max:50',
            'color_name' => 'nullable|string|max:100',
            'fabric_name' => 'nullable|string|max:255',
            'fabric_type' => 'nullable|string|max:100',
            'fabric_type_name' => 'nullable|string|max:255',
            'fabric_weight' => 'nullable|string|max:50',
            'country_of_origin' => 'nullable|string|max:100',
            'item_description' => 'nullable|string',
            'fit' => 'nullable|string|max:100',
            // Trims association
            'trims' => 'nullable|array',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check style number uniqueness within PO
        $existingStyle = Style::where('po_id', $poId)
            ->where('style_number', $request->style_number)
            ->where('id', '!=', $id)
            ->first();

        if ($existingStyle) {
            return response()->json([
                'message' => 'Style number already exists in this purchase order',
            ], 422);
        }

        $oldData = [
            'style_number' => $style->style_number,
            'quantity' => $style->quantity,
            'unit_price' => $style->unit_price,
            'status' => $style->status,
        ];

        // Calculate total price only if both quantity and unit_price are provided
        $quantity = $request->has('quantity') ? $request->quantity : $style->quantity;
        $unitPrice = $request->has('unit_price') ? $request->unit_price : $style->unit_price;
        $totalPrice = ($quantity && $unitPrice) ? $quantity * $unitPrice : null;

        $style->update([
            'style_number' => $request->style_number,
            'description' => $request->description,
            'fabric' => $request->fabric,
            'color' => $request->color,
            'size_breakdown' => $request->size_breakdown,
            'quantity' => $request->quantity,
            'unit_price' => $request->unit_price,
            'fob_price' => $request->fob_price ?? $style->fob_price,
            'total_price' => $totalPrice,
            'target_production_date' => $request->target_production_date,
            'target_shipment_date' => $request->target_shipment_date,
            'technical_file_paths' => $request->technical_file_paths,
            'images' => $request->images,
            'status' => $request->get('status', $style->status),
            // Enhanced fields
            'color_code' => $request->color_code,
            'color_name' => $request->color_name,
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $request->fabric_type_name,
            'fabric_weight' => $request->fabric_weight,
            'country_of_origin' => $request->country_of_origin,
            'item_description' => $request->item_description,
            'fit' => $request->fit,
        ]);

        // Sync trims if provided
        if ($request->has('trims')) {
            $trimsToSync = [];
            foreach ($request->trims as $trim) {
                $trimsToSync[$trim['trim_id']] = [
                    'quantity' => $trim['quantity'] ?? null,
                    'notes' => $trim['notes'] ?? null,
                ];
            }
            $style->trims()->sync($trimsToSync);
        }

        $newData = [
            'style_number' => $style->style_number,
            'quantity' => $style->quantity,
            'unit_price' => $style->unit_price,
            'status' => $style->status,
        ];

        // Update PO totals
        $style->purchaseOrder->updateTotals();

        // Log update
        $this->activityLog->logUpdated('Style', $style->id, $oldData, $newData);

        return response()->json([
            'message' => 'Style updated successfully',
            'style' => [
                'id' => $style->id,
                'style_number' => $style->style_number,
                'quantity' => $style->quantity,
                'total_price' => $style->total_price,
                'status' => $style->status,
            ],
        ]);
    }

    /**
     * Delete style
     */
    public function destroy(Request $request, $poId, $id)
    {
        $user = $request->user();
        $style = Style::findOrFail($id);

        // Verify style belongs to PO
        if ($style->po_id != $poId) {
            return response()->json([
                'message' => 'Style does not belong to this purchase order',
            ], 404);
        }

        // Check permission
        if (!$this->permissionService->canAccessStyle($user, $style) || !$user->hasPermissionTo('style.delete')) {
            return response()->json([
                'message' => 'You do not have permission to delete this style',
            ], 403);
        }

        $styleData = [
            'style_number' => $style->style_number,
            'po_number' => $style->purchaseOrder->po_number,
        ];

        $po = $style->purchaseOrder;

        // Log deletion
        $this->activityLog->logDeleted('Style', $style->id, $styleData);

        $style->delete();

        // Update PO totals
        $po->updateTotals();

        return response()->json([
            'message' => 'Style deleted successfully',
        ]);
    }

    /**
     * Bulk create styles
     */
    public function bulkStore(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('style.create')) {
            return response()->json([
                'message' => 'You do not have permission to create styles for this purchase order',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'styles' => 'required|array|min:1',
            'styles.*.style_number' => 'required|string|max:100',
            'styles.*.description' => 'nullable|string',
            'styles.*.fabric' => 'nullable|string|max:255',
            'styles.*.color' => 'nullable|string|max:100',
            'styles.*.size_breakdown' => 'nullable|array',
            'styles.*.quantity' => 'required|integer|min:1',
            'styles.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $created = 0;
        $errors = [];
        $createdStyles = [];

        foreach ($request->styles as $styleData) {
            // Check style number uniqueness
            $exists = Style::where('po_id', $poId)
                ->where('style_number', $styleData['style_number'])
                ->exists();

            if ($exists) {
                $errors[] = [
                    'style_number' => $styleData['style_number'],
                    'error' => 'Style number already exists in this purchase order',
                ];
                continue;
            }

            $totalPrice = $styleData['quantity'] * $styleData['unit_price'];

            $style = Style::create([
                'po_id' => $poId,
                'style_number' => $styleData['style_number'],
                'description' => $styleData['description'] ?? null,
                'fabric' => $styleData['fabric'] ?? null,
                'color' => $styleData['color'] ?? null,
                'size_breakdown' => $styleData['size_breakdown'] ?? null,
                'quantity' => $styleData['quantity'],
                'unit_price' => $styleData['unit_price'],
                'total_price' => $totalPrice,
                'status' => 'pending',
            ]);

            $createdStyles[] = $style;
            $created++;
        }

        // Update PO totals
        $po->updateTotals();

        // Log bulk creation
        $this->activityLog->log(
            'bulk_styles_created',
            'PurchaseOrder',
            $po->id,
            "Bulk created {$created} styles",
            [
                'created_count' => $created,
                'po_number' => $po->po_number,
                'errors_count' => count($errors),
            ]
        );

        return response()->json([
            'message' => "Bulk creation completed. {$created} styles created.",
            'created_count' => $created,
            'errors_count' => count($errors),
            'errors' => $errors,
            'styles' => array_map(function ($style) {
                return [
                    'id' => $style->id,
                    'style_number' => $style->style_number,
                    'quantity' => $style->quantity,
                    'total_price' => $style->total_price,
                ];
            }, $createdStyles),
        ], 201);
    }

    /**
     * Assign factory to style(s)
     */
    public function assignFactory(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('po.assign_factory')) {
            return response()->json([
                'message' => 'You do not have permission to assign factories',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'style_ids' => 'required|array|min:1',
            'style_ids.*' => 'exists:styles,id',
            'factory_id' => 'required|exists:users,id',
            'assignment_type' => 'required|in:direct,via_agency',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify factory has Factory role
        $factory = User::find($request->factory_id);
        if (!$factory->hasRole('Factory')) {
            return response()->json([
                'message' => 'The selected user is not a factory',
            ], 422);
        }

        $updated = 0;

        foreach ($request->style_ids as $styleId) {
            $style = Style::where('id', $styleId)
                ->where('po_id', $poId)
                ->first();

            if ($style) {
                $style->update([
                    'assigned_factory_id' => $request->factory_id,
                    'assignment_type' => $request->assignment_type,
                    'assigned_at' => now(),
                ]);
                $updated++;
            }
        }

        // Log assignment
        $this->activityLog->log(
            'factory_assigned',
            'PurchaseOrder',
            $po->id,
            "Assigned {$updated} styles to factory {$factory->name}",
            [
                'factory_id' => $factory->id,
                'factory_name' => $factory->name,
                'style_count' => $updated,
                'assignment_type' => $request->assignment_type,
            ]
        );

        return response()->json([
            'message' => "Factory assigned to {$updated} style(s) successfully",
            'updated_count' => $updated,
        ]);
    }

    /**
     * Create standalone style (not attached to any PO yet)
     */
    public function createStandalone(Request $request)
    {
        $user = $request->user();

        // Check permission
        if (!$user->hasPermissionTo('style.create')) {
            return response()->json([
                'message' => 'You do not have permission to create styles',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'style_number' => 'required|string|max:100|unique:styles,style_number',
            'description' => 'nullable|string',
            'size_breakup' => 'nullable|array',
            'total_quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'fob_price' => 'nullable|numeric|min:0',
            'technical_file_paths' => 'nullable|array',
            'images' => 'nullable|array',
            // Master data foreign keys
            'brand_id' => 'nullable|exists:brands,id',
            'retailer_id' => 'nullable|exists:retailers,id',
            'category_id' => 'nullable|exists:categories,id',
            'season_id' => 'nullable|exists:seasons,id',
            'gender_id' => 'required|exists:genders,id',
            'color_id' => 'nullable|exists:colors,id',
            // Enhanced style fields
            'fabric_name' => 'nullable|string|max:255',
            'fabric_type' => 'nullable|string|max:100',
            'fabric_type_name' => 'nullable|string|max:255',
            'fabric_weight' => 'nullable|string|max:50',
            'country_of_origin' => 'nullable|string|max:100',
            'item_description' => 'nullable|string',
            'fit' => 'nullable|string|max:100',
            // Pricing fields
            'msrp' => 'nullable|numeric|min:0',
            'wholesale_price' => 'nullable|numeric|min:0',
            // Status
            'is_active' => 'boolean',
            // Trims association
            'trims' => 'nullable|array',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
            // Prepacks
            'prepacks' => 'nullable|array',
            'prepacks.*.prepack_code_id' => 'required|exists:prepack_codes,id',
            'prepacks.*.quantity' => 'required|integer|min:1',
            'prepacks.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $style = Style::create([
            'style_number' => $request->style_number,
            'description' => $request->description,
            'size_breakup' => $request->size_breakup,
            'total_quantity' => $request->total_quantity,
            'unit_price' => $request->unit_price,
            'fob_price' => $request->fob_price,
            'technical_file_paths' => $request->technical_file_paths,
            'images' => $request->images,
            // Master data foreign keys
            'brand_id' => $request->brand_id,
            'retailer_id' => $request->retailer_id,
            'category_id' => $request->category_id,
            'season_id' => $request->season_id,
            'gender_id' => $request->gender_id,
            'color_id' => $request->color_id,
            // Enhanced style fields
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $request->fabric_type_name,
            'fabric_weight' => $request->fabric_weight,
            'country_of_origin' => $request->country_of_origin,
            'item_description' => $request->item_description,
            'fit' => $request->fit,
            // Pricing fields
            'msrp' => $request->msrp,
            'wholesale_price' => $request->wholesale_price,
            // Status
            'is_active' => $request->input('is_active', true),
            // Audit
            'created_by' => $user->id,
        ]);

        // Attach trims if provided
        if ($request->has('trims') && is_array($request->trims)) {
            foreach ($request->trims as $trim) {
                $style->trims()->attach($trim['trim_id'], [
                    'quantity' => $trim['quantity'] ?? null,
                    'notes' => $trim['notes'] ?? null,
                ]);
            }
        }

        // Attach prepacks if provided
        if ($request->has('prepacks') && is_array($request->prepacks)) {
            foreach ($request->prepacks as $prepack) {
                $prepackCode = PrepackCode::find($prepack['prepack_code_id']);
                if ($prepackCode) {
                    $totalPieces = $prepackCode->total_pieces_per_pack * $prepack['quantity'];

                    \App\Models\StylePrepack::create([
                        'style_id' => $style->id,
                        'prepack_code_id' => $prepack['prepack_code_id'],
                        'quantity' => $prepack['quantity'],
                        'total_pieces' => $totalPieces,
                        'piece_breakdown' => $prepackCode->sizes,
                        'notes' => $prepack['notes'] ?? null,
                    ]);
                }
            }
        }

        // Log creation
        $this->activityLog->logCreated('Style', $style->id, [
            'style_number' => $style->style_number,
            'total_quantity' => $style->total_quantity,
        ]);

        return response()->json($style->fresh(['trims', 'prepacks.prepackCode']), 201);
    }

    /**
     * Get single standalone style
     */
    public function showStandalone(Request $request, $id)
    {
        $style = Style::with([
            'brand',
            'retailer',
            'category',
            'season',
            'gender',
            'color',
            'purchaseOrders',
            'prepacks.prepackCode',
            'creator',
            'updatedBy'
        ])->findOrFail($id);

        return response()->json($style);
    }

    /**
     * Update standalone style
     */
    public function updateStandalone(Request $request, $id)
    {
        $user = $request->user();
        $style = Style::findOrFail($id);

        // Check permission
        if (!$user->hasPermissionTo('style.edit')) {
            return response()->json([
                'message' => 'You do not have permission to edit styles',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'style_number' => 'required|string|max:100|unique:styles,style_number,' . $id,
            'description' => 'nullable|string',
            'fabric' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:100',
            'size_breakup' => 'nullable|array',
            'total_quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'fob_price' => 'nullable|numeric|min:0',
            'technical_file_paths' => 'nullable|array',
            'images' => 'nullable|array',
            // Master data
            'brand_id' => 'nullable|exists:brands,id',
            'retailer_id' => 'nullable|exists:retailers,id',
            'category_id' => 'nullable|exists:categories,id',
            'season_id' => 'nullable|exists:seasons,id',
            'gender_id' => 'nullable|exists:genders,id',
            'color_id' => 'nullable|exists:colors,id',
            // Enhanced fields
            'color_code' => 'nullable|string|max:50',
            'color_name' => 'nullable|string|max:100',
            'fabric_name' => 'nullable|string|max:255',
            'fabric_type' => 'nullable|string|max:100',
            'fabric_type_name' => 'nullable|string|max:255',
            'fabric_weight' => 'nullable|string|max:50',
            'country_of_origin' => 'nullable|string|max:100',
            'item_description' => 'nullable|string',
            'fit' => 'nullable|string|max:100',
            // Pricing fields
            'msrp' => 'nullable|numeric|min:0',
            'wholesale_price' => 'nullable|numeric|min:0',
            // Status
            'is_active' => 'boolean',
            // Trims association
            'trims' => 'nullable|array',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
            // Prepacks
            'prepacks' => 'nullable|array',
            'prepacks.*.prepack_code_id' => 'required|exists:prepack_codes,id',
            'prepacks.*.quantity' => 'required|integer|min:1',
            'prepacks.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldData = [
            'style_number' => $style->style_number,
            'total_quantity' => $style->total_quantity,
            'unit_price' => $style->unit_price,
        ];

        $style->update([
            'style_number' => $request->style_number,
            'description' => $request->description,
            'fabric' => $request->fabric,
            'color' => $request->color,
            'size_breakup' => $request->size_breakup,
            'total_quantity' => $request->total_quantity,
            'unit_price' => $request->unit_price,
            'fob_price' => $request->fob_price,
            'technical_file_paths' => $request->technical_file_paths,
            'images' => $request->images,
            // Master data
            'brand_id' => $request->brand_id,
            'retailer_id' => $request->retailer_id,
            'category_id' => $request->category_id,
            'season_id' => $request->season_id,
            'gender_id' => $request->gender_id,
            'color_id' => $request->color_id,
            // Enhanced fields
            'color_code' => $request->color_code,
            'color_name' => $request->color_name,
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $request->fabric_type_name,
            'fabric_weight' => $request->fabric_weight,
            'country_of_origin' => $request->country_of_origin,
            'item_description' => $request->item_description,
            'fit' => $request->fit,
            // Pricing fields
            'msrp' => $request->msrp,
            'wholesale_price' => $request->wholesale_price,
            // Status
            'is_active' => $request->input('is_active', $style->is_active),
            // Audit
            'updated_by' => $user->id,
        ]);

        // Sync trims if provided
        if ($request->has('trims')) {
            $trimsToSync = [];
            foreach ($request->trims as $trim) {
                $trimsToSync[$trim['trim_id']] = [
                    'quantity' => $trim['quantity'] ?? null,
                    'notes' => $trim['notes'] ?? null,
                ];
            }
            $style->trims()->sync($trimsToSync);
        }

        // Sync prepacks if provided
        if ($request->has('prepacks')) {
            // Delete existing prepacks
            \App\Models\StylePrepack::where('style_id', $style->id)->delete();

            // Create new prepacks
            foreach ($request->prepacks as $prepack) {
                $prepackCode = PrepackCode::find($prepack['prepack_code_id']);
                if ($prepackCode) {
                    $totalPieces = $prepackCode->total_pieces_per_pack * $prepack['quantity'];

                    \App\Models\StylePrepack::create([
                        'style_id' => $style->id,
                        'prepack_code_id' => $prepack['prepack_code_id'],
                        'quantity' => $prepack['quantity'],
                        'total_pieces' => $totalPieces,
                        'piece_breakdown' => $prepackCode->sizes,
                        'notes' => $prepack['notes'] ?? null,
                    ]);
                }
            }
        }

        $newData = [
            'style_number' => $style->style_number,
            'total_quantity' => $style->total_quantity,
            'unit_price' => $style->unit_price,
        ];

        // Log update
        $this->activityLog->logUpdated('Style', $style->id, $oldData, $newData);

        return response()->json($style->fresh(['trims', 'prepacks.prepackCode']));
    }

    /**
     * Delete standalone style
     */
    public function destroyStandalone(Request $request, $id)
    {
        $user = $request->user();
        $style = Style::findOrFail($id);

        // Check permission
        if (!$user->hasPermissionTo('style.delete')) {
            return response()->json([
                'message' => 'You do not have permission to delete styles',
            ], 403);
        }

        $styleData = [
            'style_number' => $style->style_number,
        ];

        // Log deletion
        $this->activityLog->logDeleted('Style', $style->id, $styleData);

        $style->delete();

        return response()->json([
            'message' => 'Style deleted successfully',
        ]);
    }

    /**
     * Get all styles across all purchase orders (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = Style::with([
            'purchaseOrder:id,po_number,status',
            'prepacks.prepackCode',
            'brand:id,name',
            'retailer:id,name',
            'category:id,name',
            'season:id,name',
            'gender:id,name',
            'gender.activeSizes:id,gender_id,size_code,size_name,display_order',
            'color:id,name,code,pantone_code'
        ]);

        // Apply role-based filtering
        if (!$user->can('style.view_all')) {
            // Filter based on user role and accessible styles
            $query->where(function($q) use ($user) {
                // Include standalone styles (not attached to any PO) created by this user
                $q->where(function($subQ) use ($user) {
                    $subQ->whereNull('po_id')
                         ->where('created_by', $user->id);
                });

                // OR include styles attached to accessible POs
                $q->orWhereHas('purchaseOrder', function($poQuery) use ($user) {
                    if ($user->hasRole('Factory')) {
                        // Factories see styles assigned to them
                        $poQuery->where('assigned_factory_id', $user->id);
                    } elseif ($user->hasRole('Importer')) {
                        // Importers see their own POs
                        $poQuery->where('created_by', $user->id);
                    }
                });
            });
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Assignment type filter
        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        // Factory filter
        if ($request->has('factory_id')) {
            $query->where('assigned_factory_id', $request->factory_id);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('style_number', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('purchaseOrder', function($q) use ($search) {
                      $q->where('po_number', 'like', "%{$search}%");
                  });
            });
        }

        // Pagination
        $perPage = $request->input('per_page', 20);
        $styles = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform response to use consistent field names
        return response()->json([
            'current_page' => $styles->currentPage(),
            'data' => $styles->items(),
            'first_page_url' => $styles->url(1),
            'from' => $styles->firstItem(),
            'last_page' => $styles->lastPage(),
            'last_page_url' => $styles->url($styles->lastPage()),
            'links' => $styles->linkCollection()->toArray(),
            'next_page_url' => $styles->nextPageUrl(),
            'path' => $styles->path(),
            'per_page' => $styles->perPage(),
            'prev_page_url' => $styles->previousPageUrl(),
            'to' => $styles->lastItem(),
            'total' => $styles->total(),
        ]);
    }

    /**
     * Get trims for a style
     */
    public function getTrims($id): JsonResponse
    {
        $style = Style::with(['trims' => function($query) {
            $query->with('brand')->where('is_active', true);
        }])->findOrFail($id);

        return response()->json([
            'trims' => $style->trims->map(function($trim) {
                return [
                    'id' => $trim->id,
                    'brand_id' => $trim->brand_id,
                    'brand_name' => $trim->brand->name ?? null,
                    'trim_type' => $trim->trim_type,
                    'trim_code' => $trim->trim_code,
                    'description' => $trim->description,
                    'image_path' => $trim->image_path,
                    'quantity' => $trim->pivot->quantity,
                    'notes' => $trim->pivot->notes,
                ];
            }),
        ]);
    }

    /**
     * Attach trims to a style
     */
    public function attachTrims(Request $request, $id): JsonResponse
    {
        $style = Style::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'trims' => 'required|array|min:1',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        foreach ($request->trims as $trim) {
            // Use syncWithoutDetaching to avoid removing existing trims
            $style->trims()->syncWithoutDetaching([
                $trim['trim_id'] => [
                    'quantity' => $trim['quantity'] ?? null,
                    'notes' => $trim['notes'] ?? null,
                ]
            ]);
        }

        return response()->json([
            'message' => 'Trims attached successfully',
            'style' => $style->load('trims'),
        ]);
    }

    /**
     * Detach trims from a style
     */
    public function detachTrims(Request $request, $id): JsonResponse
    {
        $style = Style::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'trim_ids' => 'required|array|min:1',
            'trim_ids.*' => 'required|exists:trims,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $style->trims()->detach($request->trim_ids);

        return response()->json([
            'message' => 'Trims detached successfully',
            'style' => $style->load('trims'),
        ]);
    }

    /**
     * Sync trims for a style (replace all existing trims)
     */
    public function syncTrims(Request $request, $id): JsonResponse
    {
        $style = Style::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'trims' => 'required|array',
            'trims.*.trim_id' => 'required|exists:trims,id',
            'trims.*.quantity' => 'nullable|integer|min:1',
            'trims.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $trimsToSync = [];
        foreach ($request->trims as $trim) {
            $trimsToSync[$trim['trim_id']] = [
                'quantity' => $trim['quantity'] ?? null,
                'notes' => $trim['notes'] ?? null,
            ];
        }

        $style->trims()->sync($trimsToSync);

        return response()->json([
            'message' => 'Trims synced successfully',
            'style' => $style->load('trims'),
        ]);
    }
}
