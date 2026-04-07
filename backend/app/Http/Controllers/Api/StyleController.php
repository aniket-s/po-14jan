<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Style;
use App\Models\StylePrepack;
use App\Models\PrepackCode;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
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
            'fabric_type_id' => 'nullable|exists:fabric_types,id',
            'fabric_quality_id' => 'nullable|exists:fabric_qualities,id',
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

        // Auto-resolve fabric_type_name from fabric_type_id if not explicitly provided
        $fabricTypeName = $request->fabric_type_name;
        if (!$fabricTypeName && $request->fabric_type_id) {
            $fabricType = \App\Models\FabricType::find($request->fabric_type_id);
            if ($fabricType) {
                $fabricTypeName = $fabricType->name;
            }
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
            'fabric_type_id' => $request->fabric_type_id,
            'fabric_quality_id' => $request->fabric_quality_id,
            // Enhanced style fields
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $fabricTypeName,
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
        $user = $request->user();
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

        // Check access permission
        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to view this style',
            ], 403);
        }

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

        // Check access - user must have access to this specific style
        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to edit this style',
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
            'fabric_type_id' => 'nullable|exists:fabric_types,id',
            'fabric_quality_id' => 'nullable|exists:fabric_qualities,id',
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

        // Auto-resolve fabric_type_name from fabric_type_id if not explicitly provided
        $fabricTypeName = $request->fabric_type_name;
        if (!$fabricTypeName && $request->fabric_type_id) {
            $fabricType = \App\Models\FabricType::find($request->fabric_type_id);
            if ($fabricType) {
                $fabricTypeName = $fabricType->name;
            }
        }

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
            'fabric_type_id' => $request->fabric_type_id,
            'fabric_quality_id' => $request->fabric_quality_id,
            // Enhanced fields
            'color_code' => $request->color_code,
            'color_name' => $request->color_name,
            'fabric_name' => $request->fabric_name,
            'fabric_type' => $request->fabric_type,
            'fabric_type_name' => $fabricTypeName,
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

        // Check access - user must have access to this specific style
        if (!$this->permissionService->canAccessStyle($user, $style)) {
            return response()->json([
                'message' => 'You do not have permission to delete this style',
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
        // Roles with style.view (Viewer, Quality Inspector) see all styles — read-only
        // Roles with style.view_own (Importer, Agency, Factory) see only their own
        if ($user->can('style.view')) {
            // No filtering needed — read-only access to all styles
        } else {
            // Filter based on user role and accessible styles
            $query->where(function($q) use ($user) {
                // Include standalone styles (not attached to any PO) created by this user
                $q->where(function($subQ) use ($user) {
                    $subQ->whereNull('po_id')
                         ->where('created_by', $user->id);
                });

                if ($user->hasRole('Factory')) {
                    // Factories see styles assigned to them (direct or via pivot)
                    $q->orWhere('styles.assigned_factory_id', $user->id)
                       ->orWhereHas('purchaseOrders', function($poQuery) use ($user) {
                           $poQuery->where('purchase_order_style.assigned_factory_id', $user->id);
                       });
                } elseif ($user->hasRole('Importer')) {
                    // Importers see styles from POs where they are the importer
                    $q->orWhereHas('purchaseOrder', function($poQuery) use ($user) {
                        $poQuery->where('importer_id', $user->id);
                    })
                    ->orWhereHas('purchaseOrders', function($poQuery) use ($user) {
                        $poQuery->where('importer_id', $user->id);
                    });
                } elseif ($user->hasRole('Agency')) {
                    // Agencies see styles from POs assigned to them, or styles directly assigned to them
                    $q->orWhere('styles.assigned_agency_id', $user->id)
                       ->orWhereHas('purchaseOrder', function($poQuery) use ($user) {
                           $poQuery->where('agency_id', $user->id);
                       })
                       ->orWhereHas('purchaseOrders', function($poQuery) use ($user) {
                           $poQuery->where('agency_id', $user->id);
                       })
                       ->orWhereHas('purchaseOrders', function($poQuery) use ($user) {
                           $poQuery->where('purchase_order_style.assigned_agency_id', $user->id);
                       });
                }
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
            $query->where('styles.assigned_factory_id', $request->factory_id);
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
