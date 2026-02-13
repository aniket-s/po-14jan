<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Style;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;


class PurchaseOrderStyleController extends Controller
{
    /**
     * Get all styles associated with a purchase order
     *
     * GET /api/purchase-orders/{poId}/styles
     */
    public function index(Request $request, $poId)
    {
        $po = PurchaseOrder::findOrFail($poId);

        // Check permissions
        // Add permission checks as needed

        $query = $po->styles();

        // Apply filters
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('style_number', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->has('status')) {
            $query->wherePivot('status', $request->status);
        }

        if ($request->has('assigned_factory_id')) {
            $query->wherePivot('assigned_factory_id', $request->assigned_factory_id);
        }

        if ($request->has('assignment_type')) {
            $query->wherePivot('assignment_type', $request->assignment_type);
        }

        $query->with([
            'brand',
            'season',
            'prepacks',
            'sampleProcesses',
        ]);

        $styles = $query->paginate($request->per_page ?? 50);

        // Return consistent response format with 'styles' key
        return response()->json([
            'styles' => $styles->items(),
            'meta' => [
                'current_page' => $styles->currentPage(),
                'per_page' => $styles->perPage(),
                'total' => $styles->total(),
                'last_page' => $styles->lastPage(),
            ],
        ]);
    }

    /**
     * Attach styles to a purchase order
     *
     * POST /api/purchase-orders/{poId}/styles/attach
     */
    public function attachStyles(Request $request, $poId)
    {
        $po = PurchaseOrder::findOrFail($poId);

        $validator = Validator::make($request->all(), [
            'styles' => 'required|array|min:1',
            'styles.*.style_id' => 'required|exists:styles,id',
            'styles.*.quantity_in_po' => 'required|integer|min:1',
            'styles.*.unit_price_in_po' => 'nullable|numeric|min:0',
            'styles.*.shipping_term' => 'nullable|in:FOB,DDP',
            'styles.*.size_breakdown' => 'nullable|array',
            'styles.*.assigned_factory_id' => 'nullable|exists:users,id',
            'styles.*.assigned_agency_id' => 'nullable|exists:users,id',
            'styles.*.assignment_type' => 'nullable|in:direct_to_factory,via_agency',
            'styles.*.target_production_date' => 'nullable|date',
            'styles.*.target_shipment_date' => 'nullable|date',
            'styles.*.ex_factory_date' => 'nullable|date',
            'styles.*.status' => 'nullable|string|max:50',
            'styles.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $attachedCount = 0;
        $errors = [];

        foreach ($request->styles as $styleData) {
            $styleId = $styleData['style_id'];

            // Check if style is already attached to this PO
            if ($po->styles()->where('style_id', $styleId)->exists()) {
                $errors[] = "Style {$styleId} is already attached to this purchase order";
                continue;
            }

            // Prepare pivot data
            $pivotData = [
                'quantity_in_po' => $styleData['quantity_in_po'],
                'unit_price_in_po' => $styleData['unit_price_in_po'] ?? null,
                'shipping_term' => $styleData['shipping_term'] ?? null,
                'size_breakdown' => isset($styleData['size_breakdown']) ? json_encode($styleData['size_breakdown']) : null,
                'assigned_factory_id' => $styleData['assigned_factory_id'] ?? null,
                'assigned_agency_id' => $styleData['assigned_agency_id'] ?? null,
                'assignment_type' => $styleData['assignment_type'] ?? null,
                'assigned_at' => isset($styleData['assigned_factory_id']) || isset($styleData['assigned_agency_id']) ? now() : null,
                'target_production_date' => $styleData['target_production_date'] ?? null,
                'target_shipment_date' => $styleData['target_shipment_date'] ?? null,
                'ex_factory_date' => $styleData['ex_factory_date'] ?? null,
                'status' => $styleData['status'] ?? 'pending',
                'notes' => $styleData['notes'] ?? null,
            ];

            // Attach style to PO
            $po->styles()->attach($styleId, $pivotData);
            $attachedCount++;
        }

        // Update PO totals
        $po->updateTotals();

        return response()->json([
            'message' => "Successfully attached {$attachedCount} style(s) to purchase order",
            'attached_count' => $attachedCount,
            'errors' => $errors,
            'po_totals' => [
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'total_styles' => $po->total_styles,
            ],
        ]);
    }

    /**
     * Detach a style from a purchase order
     *
     * DELETE /api/purchase-orders/{poId}/styles/{styleId}/detach
     */
    public function detachStyle($poId, $styleId)
    {
        $po = PurchaseOrder::findOrFail($poId);

        // Check if style is attached to this PO
        if (!$po->styles()->where('style_id', $styleId)->exists()) {
            return response()->json(['error' => 'Style is not attached to this purchase order'], 404);
        }

        // Detach style from PO
        $po->styles()->detach($styleId);

        // Update PO totals
        $po->updateTotals();

        return response()->json([
            'message' => 'Style successfully removed from purchase order',
            'po_totals' => [
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'total_styles' => $po->total_styles,
            ],
        ]);
    }

    /**
     * Update pivot data for a style in a purchase order
     *
     * PUT /api/purchase-orders/{poId}/styles/{styleId}
     */
    public function updatePivot(Request $request, $poId, $styleId)
    {
        $po = PurchaseOrder::findOrFail($poId);
        $style = Style::findOrFail($styleId);

        // Check if style is attached to this PO
        if (!$po->styles()->where('style_id', $styleId)->exists()) {
            return response()->json(['error' => 'Style is not attached to this purchase order'], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity_in_po' => 'sometimes|required|integer|min:1',
            'unit_price_in_po' => 'nullable|numeric|min:0',
            'shipping_term' => 'nullable|in:FOB,DDP',
            'size_breakdown' => 'nullable|array',
            'assigned_factory_id' => 'nullable|exists:users,id',
            'assigned_agency_id' => 'nullable|exists:users,id',
            'assignment_type' => 'nullable|in:direct_to_factory,via_agency',
            'target_production_date' => 'nullable|date',
            'target_shipment_date' => 'nullable|date',
            'ex_factory_date' => 'nullable|date',
            'status' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Prepare update data
        $updateData = $request->only([
            'quantity_in_po',
            'unit_price_in_po',
            'shipping_term',
            'size_breakdown',
            'assigned_factory_id',
            'assigned_agency_id',
            'assignment_type',
            'target_production_date',
            'target_shipment_date',
            'ex_factory_date',
            'status',
            'notes',
        ]);

        // Handle size_breakdown JSON encoding
        if (isset($updateData['size_breakdown']) && is_array($updateData['size_breakdown'])) {
            $updateData['size_breakdown'] = json_encode($updateData['size_breakdown']);
        }

        // Update assigned_at if factory/agency is being assigned
        if (isset($updateData['assigned_factory_id']) || isset($updateData['assigned_agency_id'])) {
            $updateData['assigned_at'] = now();
        }

        // Update pivot
        $po->styles()->updateExistingPivot($styleId, $updateData);

        // Update PO totals if quantity or price changed
        if (isset($updateData['quantity_in_po']) || isset($updateData['unit_price_in_po'])) {
            $po->updateTotals();
        }

        return response()->json([
            'message' => 'Style data updated successfully',
            'po_totals' => [
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'total_styles' => $po->total_styles,
            ],
        ]);
    }

    /**
     * Assign factory to a style within a purchase order
     *
     * POST /api/purchase-orders/{poId}/styles/{styleId}/assign-factory
     */
    public function assignFactory(Request $request, $poId, $styleId)
    {
        $po = PurchaseOrder::findOrFail($poId);
        $style = Style::findOrFail($styleId);

        // Check if style is attached to this PO
        if (!$po->styles()->where('style_id', $styleId)->exists()) {
            return response()->json(['error' => 'Style is not attached to this purchase order'], 404);
        }

        $validator = Validator::make($request->all(), [
            'assignment_type' => 'required|in:direct_to_factory,via_agency',
            'assigned_factory_id' => 'required_if:assignment_type,direct_to_factory|nullable|exists:users,id',
            'assigned_agency_id' => 'required_if:assignment_type,via_agency|nullable|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Update pivot
        $po->styles()->updateExistingPivot($styleId, [
            'assignment_type' => $request->assignment_type,
            'assigned_factory_id' => $request->assigned_factory_id,
            'assigned_agency_id' => $request->assigned_agency_id,
            'assigned_at' => now(),
        ]);

        return response()->json(['message' => 'Factory assigned successfully']);
    }

    /**
     * Bulk attach styles to a purchase order
     *
     * POST /api/purchase-orders/{poId}/styles/attach-bulk
     */
    public function attachStylesBulk(Request $request, $poId)
    {
        $po = PurchaseOrder::findOrFail($poId);

        $validator = Validator::make($request->all(), [
            'style_ids' => 'required|array|min:1',
            'style_ids.*' => 'exists:styles,id',
            'default_quantity' => 'nullable|integer|min:1',
            'default_status' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $attachedCount = 0;
        $errors = [];

        foreach ($request->style_ids as $styleId) {
            // Check if style is already attached to this PO
            if ($po->styles()->where('style_id', $styleId)->exists()) {
                $errors[] = "Style {$styleId} is already attached to this purchase order";
                continue;
            }

            // Get style to use its base quantity if no default provided
            $style = Style::find($styleId);

            $pivotData = [
                'quantity_in_po' => $request->default_quantity ?? $style->total_quantity,
                'unit_price_in_po' => null, // Use style's base price
                'status' => $request->default_status ?? 'pending',
            ];

            // Attach style to PO
            $po->styles()->attach($styleId, $pivotData);
            $attachedCount++;
        }

        // Update PO totals
        $po->updateTotals();

        return response()->json([
            'message' => "Successfully attached {$attachedCount} style(s) to purchase order",
            'attached_count' => $attachedCount,
            'errors' => $errors,
            'po_totals' => [
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'total_styles' => $po->total_styles,
            ],
        ]);
    }
}
