<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BuySheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BuySheetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = BuySheet::with(['buyer:id,name,code', 'retailer:id,name', 'season:id,name']);

        if ($request->filled('buyer_id')) {
            $q->where('buyer_id', (int) $request->buyer_id);
        }
        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->string('search');
            $q->where(function ($w) use ($s) {
                $w->where('buy_sheet_number', 'LIKE', "%{$s}%")
                    ->orWhere('name', 'LIKE', "%{$s}%");
            });
        }

        return response()->json(
            $q->orderByDesc('created_at')->paginate((int) $request->input('per_page', 20))
        );
    }

    public function show($id): JsonResponse
    {
        $sheet = BuySheet::with([
            'buyer', 'retailer', 'season',
            'styles' => fn ($q) => $q->withPivot(['quantity', 'unit_price', 'size_breakdown', 'packing', 'label', 'ihd']),
            'purchaseOrders:id,po_number,status,buy_sheet_id,po_date,total_quantity,total_value',
            'creator:id,name',
        ])->findOrFail($id);

        return response()->json(['buy_sheet' => $sheet]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $sheet = BuySheet::findOrFail($id);
        $v = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'retailer_id' => 'nullable|exists:retailers,id',
            'season_id' => 'nullable|exists:seasons,id',
            'status' => 'nullable|in:open,po_issued,closed,cancelled',
            'tickets_required' => 'nullable|boolean',
            'buyer_approvals_required' => 'nullable|boolean',
        ]);
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }
        $sheet->update($v->validated());
        return response()->json(['buy_sheet' => $sheet->fresh()]);
    }

    public function destroy($id): JsonResponse
    {
        $sheet = BuySheet::findOrFail($id);
        if ($sheet->purchaseOrders()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a buy sheet with linked purchase orders.',
            ], 422);
        }
        $sheet->delete();
        return response()->json(['success' => true]);
    }
}
