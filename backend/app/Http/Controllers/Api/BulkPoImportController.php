<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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
    /**
     * Upload cap (KB). Historical WIP sheets are large because of embedded CAD
     * images, so this is well above the other importers' limits. PHP
     * upload_max_filesize / post_max_size and the web server's body-size limit
     * must be at least this high for the largest files to get through.
     */
    private const MAX_UPLOAD_KB = 102400; // 100 MB

    public function __construct(
        protected BulkPoExcelImportService $service,
        protected ActivityLogService $activityLog,
    ) {}

    /** POST /api/imports/bulk-po/analyze */
    public function analyze(Request $request): JsonResponse
    {
        $this->raiseResourceLimits();

        $v = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:' . self::MAX_UPLOAD_KB,
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
        $this->raiseResourceLimits();

        // Strict, authoritative validation built from the same field rules the
        // frontend uses - the client blocks bad data before submit, and this is
        // the server-side guard that never trusts it.
        $v = Validator::make($request->all(), $this->service->commitValidationRules());
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

    /**
     * GET /api/imports/bulk-po/factories
     *
     * Factories for the resolution picker. Unlike the general /factories list this
     * includes inactive placeholders, so a factory created on a previous import
     * can be re-selected rather than re-created.
     */
    public function factories(): JsonResponse
    {
        $factories = User::role('Factory')
            ->orderBy('name')
            ->get(['id', 'name', 'company'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'company' => $u->company]);

        return response()->json($factories);
    }

    /**
     * POST /api/imports/bulk-po/factories
     *
     * Create a placeholder Factory user for a sheet name with no existing match
     * (status inactive, no usable login) so a historical assignment can resolve.
     */
    public function createFactory(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), ['name' => 'required|string|max:255']);
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $factory = $this->service->createPlaceholderFactory(
            (string) $request->input('name'),
            $request->user()->id,
        );

        return response()->json(['id' => $factory->id, 'name' => $factory->name], 201);
    }

    /**
     * Loading a large workbook + extracting every embedded image is heavy.
     * Give the request more time and headroom, but never lower an already
     * higher (or unlimited) memory_limit.
     */
    private function raiseResourceLimits(): void
    {
        @set_time_limit(600);

        $target = 2048 * 1024 * 1024; // 2 GB
        $current = $this->iniBytes((string) ini_get('memory_limit'));
        if ($current !== -1 && $current < $target) {
            @ini_set('memory_limit', '2048M');
        }
    }

    /** Convert a php.ini shorthand byte value ("512M", "1G", "-1") to bytes. */
    private function iniBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '-1') {
            return -1;
        }
        $num = (int) $value;
        return match (strtolower(substr($value, -1))) {
            'g' => $num * 1024 * 1024 * 1024,
            'm' => $num * 1024 * 1024,
            'k' => $num * 1024,
            default => $num,
        };
    }
}
