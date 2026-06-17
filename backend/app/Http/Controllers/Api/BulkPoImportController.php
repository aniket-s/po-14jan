<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Services\Import\BulkPoExcelImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * Bulk multi-PO Excel import (historical back-fill).
 *
 *   POST /api/imports/bulk-po/analyze  - raw grid + suggested column mapping
 *   POST /api/imports/bulk-po/commit   - create the resolved PO groups as drafts
 *
 * The heavy lifting (grouping, validation, value editing) happens on the client
 * against the raw grid returned by analyze; commit() re-validates and persists.
 */
class BulkPoImportController extends Controller
{
    public function __construct(
        protected BulkPoExcelImportService $service,
        protected ActivityLogService $activityLog,
    ) {}

    /** POST /api/imports/bulk-po/analyze */
    public function analyze(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ]);
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $tempPath = $request->file('file')->store('temp/imports');
        $fullPath = Storage::disk('local')->path($tempPath);

        try {
            $result = $this->service->analyze($fullPath);
        } finally {
            // Commit works off the client-posted (and possibly edited) grid, so the
            // upload is only needed for this parse. Don't leave it lying around.
            Storage::disk('local')->delete($tempPath);
        }

        if (!($result['success'] ?? false)) {
            return response()->json([
                'message' => $result['error'] ?? 'Failed to analyze file.',
            ], 422);
        }

        return response()->json($result);
    }

    /** POST /api/imports/bulk-po/commit */
    public function commit(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'options' => 'nullable|array',
            'options.duplicate_strategy' => 'nullable|in:skip,update',
            'options.default_shipping_term' => 'nullable|in:FOB,DDP',
            'options.buyer_id' => 'nullable|exists:buyers,id',
            'options.filename' => 'nullable|string|max:255',
            'pos' => 'required|array|min:1',
            'pos.*.po_number' => 'required|string|max:50',
            'pos.*.po_date' => 'nullable|date',
            'pos.*.retailer_name' => 'nullable|string|max:255',
            'pos.*.retailer_id' => 'nullable|exists:retailers,id',
            'pos.*.shipping_term' => 'nullable|in:FOB,DDP',
            'pos.*.metadata' => 'nullable|array',
            'pos.*.styles' => 'required|array|min:1',
            'pos.*.styles.*.style_number' => 'required|string|max:100',
            'pos.*.styles.*.quantity' => 'nullable|integer|min:0',
            'pos.*.styles.*.unit_price' => 'nullable|numeric|min:0',
            'pos.*.styles.*.description' => 'nullable|string',
            'pos.*.styles.*.color_name' => 'nullable|string',
            'pos.*.styles.*.size_breakdown' => 'nullable|array',
            'pos.*.styles.*.metadata' => 'nullable|array',
            'pos.*.styles.*.images' => 'nullable|array',
            'pos.*.styles.*.images.*' => 'string',
        ]);
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $report = $this->service->commit(
            $request->input('pos'),
            $request->input('options', []),
            $request->user()->id,
        );

        $this->activityLog->logCreated('PurchaseOrder', 0, [
            'source' => 'bulk_import',
            'batch_id' => $report['batch_id'] ?? null,
            'pos_created' => $report['summary']['pos_created'] ?? 0,
            'pos_updated' => $report['summary']['pos_updated'] ?? 0,
            'pos_skipped' => $report['summary']['pos_skipped'] ?? 0,
        ]);

        return response()->json($report, $report['success'] ? 201 : 422);
    }
}
