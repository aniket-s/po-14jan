<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use App\Services\ExcelImportService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ExcelImportController extends Controller
{
    protected ExcelImportService $excelService;
    protected ActivityLogService $activityLog;
    protected PermissionService $permissionService;

    public function __construct(
        ExcelImportService $excelService,
        ActivityLogService $activityLog,
        PermissionService $permissionService
    ) {
        $this->excelService = $excelService;
        $this->activityLog = $activityLog;
        $this->permissionService = $permissionService;
    }

    /**
     * Analyze uploaded Excel file
     */
    public function analyze(Request $request, $poId)
    {
        // Verify PO exists and user has access
        $po = PurchaseOrder::findOrFail($poId);
        $user = $request->user();
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to import styles for this purchase order',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Store file temporarily
        $file = $request->file('file');
        $path = $file->store('temp/imports');
        $fullPath = Storage::path($path);

        // Analyze file
        $analysis = $this->excelService->analyzeFile($fullPath);

        if (!$analysis['success']) {
            Storage::delete($path);
            return response()->json([
                'message' => 'Failed to analyze file',
                'error' => $analysis['error'] ?? 'Unknown error',
            ], 422);
        }

        return response()->json([
            'message' => 'File analyzed successfully',
            'analysis' => [
                'headers' => $analysis['headers'],
                'sample_rows' => $analysis['sample_rows'],
                'total_rows' => $analysis['total_rows'],
                'suggested_mappings' => $analysis['suggested_mappings'],
                'header_row' => $analysis['header_row'] ?? 1,
                'data_start_row' => $analysis['data_start_row'] ?? 2,
                'row_images' => $analysis['row_images'] ?? [],
                'has_images' => $analysis['has_images'] ?? false,
                'total_images' => $analysis['total_images'] ?? 0,
                'image_columns' => $analysis['image_columns'] ?? [],
                'image_format_detected' => $analysis['image_format_detected'] ?? null,
                'column_images' => $analysis['column_images'] ?? [],
                'debug_image_extraction' => $analysis['debug_image_extraction'] ?? null,
            ],
            'temp_file_path' => $path,
        ]);
    }

    /**
     * Import styles from Excel
     */
    public function import(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('style.create')) {
            return response()->json([
                'message' => 'You do not have permission to import styles for this purchase order',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'temp_file_path' => 'required|string',
            'column_mapping' => 'required|array',
            'skip_first_row' => 'nullable|boolean',
            'start_row' => 'nullable|integer|min:1',
            'end_row' => 'nullable|integer|min:1',
            'image_columns' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify temp file path is within allowed directory and exists
        if (!str_starts_with($request->temp_file_path, 'temp/imports/')) {
            return response()->json([
                'message' => 'Invalid file path.',
            ], 400);
        }

        if (!Storage::exists($request->temp_file_path)) {
            return response()->json([
                'message' => 'Temporary file not found. Please upload the file again.',
            ], 404);
        }

        $fullPath = Storage::path($request->temp_file_path);

        // Import styles
        $result = $this->excelService->importStyles(
            $fullPath,
            $poId,
            $request->column_mapping,
            $request->get('skip_first_row', true),
            $request->start_row,
            $request->end_row,
            $request->image_columns
        );

        // Delete temp file
        Storage::delete($request->temp_file_path);

        if (!$result['success']) {
            return response()->json([
                'message' => 'Import failed',
                'error' => $result['error'] ?? 'Unknown error',
            ], 422);
        }

        // Log import
        $this->activityLog->log(
            'styles_imported',
            'PurchaseOrder',
            $poId,
            "Imported {$result['imported']} styles from Excel",
            [
                'imported' => $result['imported'],
                'skipped' => $result['skipped'],
                'total_processed' => $result['total_processed'],
                'po_number' => $po->po_number,
            ]
        );

        return response()->json([
            'message' => 'Import completed successfully',
            'result' => [
                'imported' => $result['imported'],
                'skipped' => $result['skipped'],
                'total_processed' => $result['total_processed'],
                'errors' => $result['errors'],
                'styles' => $result['styles'],
            ],
        ]);
    }

    /**
     * Download template Excel file
     */
    public function downloadTemplate()
    {
        try {
            $templatePath = $this->excelService->exportTemplate();

            return response()->download($templatePath, 'style_import_template.xlsx')->deleteFileAfterSend();

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to generate template',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validate column mapping
     */
    public function validateMapping(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'column_mapping' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $mapping = $request->column_mapping;
        $requiredFields = ['style_number', 'quantity', 'unit_price'];
        $missingFields = [];

        foreach ($requiredFields as $field) {
            if (!isset($mapping[$field]) || $mapping[$field] === null) {
                $missingFields[] = $field;
            }
        }

        if (!empty($missingFields)) {
            return response()->json([
                'valid' => false,
                'message' => 'Missing required field mappings',
                'missing_fields' => $missingFields,
            ]);
        }

        return response()->json([
            'valid' => true,
            'message' => 'Column mapping is valid',
        ]);
    }

    /**
     * Analyze uploaded Excel file for standalone styles
     */
    public function analyzeStandalone(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Store file temporarily
        $file = $request->file('file');
        $path = $file->store('temp/imports');
        $fullPath = Storage::path($path);

        // Analyze file
        $analysis = $this->excelService->analyzeFile($fullPath);

        if (!$analysis['success']) {
            Storage::delete($path);
            return response()->json([
                'message' => 'Failed to analyze file',
                'error' => $analysis['error'] ?? 'Unknown error',
            ], 422);
        }

        return response()->json([
            'message' => 'File analyzed successfully',
            'analysis' => [
                'headers' => $analysis['headers'],
                'sample_rows' => $analysis['sample_rows'],
                'total_rows' => $analysis['total_rows'],
                'suggested_mappings' => $analysis['suggested_mappings'],
                'header_row' => $analysis['header_row'] ?? 1,
                'data_start_row' => $analysis['data_start_row'] ?? 2,
                'row_images' => $analysis['row_images'] ?? [],
                'has_images' => $analysis['has_images'] ?? false,
                'total_images' => $analysis['total_images'] ?? 0,
                'image_columns' => $analysis['image_columns'] ?? [],
                'image_format_detected' => $analysis['image_format_detected'] ?? null,
                'column_images' => $analysis['column_images'] ?? [],
                'debug_image_extraction' => $analysis['debug_image_extraction'] ?? null,
            ],
            'temp_file_path' => $path,
        ]);
    }

    /**
     * Serve an extracted import image from storage
     */
    public function serveImage(Request $request)
    {
        $path = $request->query('path');

        if (!$path || !str_starts_with($path, 'imports/images/')) {
            abort(404);
        }

        if (!Storage::disk('public')->exists($path)) {
            abort(404);
        }

        $content = Storage::disk('public')->get($path);
        $mimeType = Storage::disk('public')->mimeType($path) ?: 'image/jpeg';

        return response($content, 200)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=3600');
    }

    /**
     * Import standalone styles from Excel
     */
    public function importStandalone(Request $request)
    {
        $user = $request->user();

        // Check permission
        if (!$user->hasPermissionTo('style.create')) {
            return response()->json([
                'message' => 'You do not have permission to import styles',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'temp_file_path' => 'required|string',
            'column_mapping' => 'required|array',
            'skip_first_row' => 'nullable|boolean',
            'start_row' => 'nullable|integer|min:1',
            'end_row' => 'nullable|integer|min:1',
            'image_columns' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify temp file path is within allowed directory and exists
        if (!str_starts_with($request->temp_file_path, 'temp/imports/')) {
            return response()->json([
                'message' => 'Invalid file path.',
            ], 400);
        }

        if (!Storage::exists($request->temp_file_path)) {
            return response()->json([
                'message' => 'Temporary file not found. Please upload the file again.',
            ], 404);
        }

        $fullPath = Storage::path($request->temp_file_path);

        // Import standalone styles
        $result = $this->excelService->importStandaloneStyles(
            $fullPath,
            $user->id,
            $request->column_mapping,
            $request->get('skip_first_row', true),
            $request->start_row,
            $request->end_row,
            $request->image_columns
        );

        // Delete temp file
        Storage::delete($request->temp_file_path);

        if (!$result['success']) {
            return response()->json([
                'message' => 'Import failed',
                'error' => $result['error'] ?? 'Unknown error',
            ], 422);
        }

        // Log import
        $this->activityLog->log(
            'standalone_styles_imported',
            'Style',
            null,
            "Imported {$result['imported']} standalone styles from Excel",
            [
                'imported' => $result['imported'],
                'skipped' => $result['skipped'],
                'total_processed' => $result['total_processed'],
            ]
        );

        return response()->json([
            'message' => 'Import completed successfully',
            'result' => [
                'imported' => $result['imported'],
                'skipped' => $result['skipped'],
                'total_processed' => $result['total_processed'],
                'errors' => $result['errors'],
                'styles' => $result['styles'],
            ],
        ]);
    }
}
