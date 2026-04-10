<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReportController extends Controller
{
    protected $reportService;

    public function __construct(ReportService $reportService)
    {
        $this->reportService = $reportService;
    }

    /**
     * Get dashboard overview with all key metrics
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = [];
        if ($request->has('start_date') && $request->has('end_date')) {
            $filters['start_date'] = $request->start_date;
            $filters['end_date'] = $request->end_date;
        }

        $dashboard = $this->reportService->getDashboardOverview($user, $filters);

        return response()->json($dashboard);
    }

    /**
     * Get purchase order report
     */
    public function purchaseOrders(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|string',
            'importer_id' => 'nullable|exists:users,id',
            'format' => 'nullable|string|in:json,csv,excel',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'status', 'importer_id']);
        $report = $this->reportService->getPurchaseOrderReport($user, $filters);

        $format = $request->input('format', 'json');

        if ($format === 'csv') {
            return $this->exportToCsv($report['orders'], 'purchase_orders_report.csv');
        }

        if ($format === 'excel') {
            return $this->exportToExcel($report['orders'], 'purchase_orders_report.xlsx');
        }

        return response()->json($report);
    }

    /**
     * Get production report
     */
    public function production(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'style_id' => 'nullable|exists:styles,id',
            'stage_id' => 'nullable|exists:production_stages,id',
            'format' => 'nullable|string|in:json,csv,excel',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'style_id', 'stage_id']);
        $report = $this->reportService->getProductionReport($user, $filters);

        $format = $request->input('format', 'json');

        if ($format === 'csv') {
            return $this->exportToCsv($report['records'], 'production_report.csv');
        }

        if ($format === 'excel') {
            return $this->exportToExcel($report['records'], 'production_report.xlsx');
        }

        return response()->json($report);
    }

    /**
     * Get quality inspection report
     */
    public function qualityInspections(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'result' => 'nullable|string|in:pass,fail',
            'inspection_type_id' => 'nullable|exists:inspection_types,id',
            'format' => 'nullable|string|in:json,csv,excel',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'result', 'inspection_type_id']);
        $report = $this->reportService->getQualityInspectionReport($user, $filters);

        $format = $request->input('format', 'json');

        if ($format === 'csv') {
            return $this->exportToCsv($report['inspections'], 'quality_inspections_report.csv');
        }

        if ($format === 'excel') {
            return $this->exportToExcel($report['inspections'], 'quality_inspections_report.xlsx');
        }

        return response()->json($report);
    }

    /**
     * Get shipment report
     */
    public function shipments(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|string',
            'method' => 'nullable|string|in:air,sea,courier,road',
            'format' => 'nullable|string|in:json,csv,excel',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'status', 'method']);
        $report = $this->reportService->getShipmentReport($user, $filters);

        $format = $request->input('format', 'json');

        if ($format === 'csv') {
            return $this->exportToCsv($report['shipments'], 'shipments_report.csv');
        }

        if ($format === 'excel') {
            return $this->exportToExcel($report['shipments'], 'shipments_report.xlsx');
        }

        return response()->json($report);
    }

    /**
     * Get purchase order statistics
     */
    public function purchaseOrderStats(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stats = $this->reportService->getPurchaseOrderStats(
            $user,
            $request->start_date,
            $request->end_date
        );

        return response()->json($stats);
    }

    /**
     * Get sample statistics
     */
    public function sampleStats(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stats = $this->reportService->getSampleStats(
            $user,
            $request->start_date,
            $request->end_date
        );

        return response()->json($stats);
    }

    /**
     * Get production statistics
     */
    public function productionStats(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stats = $this->reportService->getProductionStats(
            $user,
            $request->start_date,
            $request->end_date
        );

        return response()->json($stats);
    }

    /**
     * Get quality inspection statistics
     */
    public function qualityInspectionStats(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stats = $this->reportService->getQualityInspectionStats(
            $user,
            $request->start_date,
            $request->end_date
        );

        return response()->json($stats);
    }

    /**
     * Get shipment statistics
     */
    public function shipmentStats(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stats = $this->reportService->getShipmentStats(
            $user,
            $request->start_date,
            $request->end_date
        );

        return response()->json($stats);
    }

    /**
     * Get factory-wise report
     */
    public function factoryWise(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'factory_id' => 'nullable|exists:users,id',
            'format' => 'nullable|string|in:json,csv',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'factory_id']);
        $report = $this->reportService->getFactoryWiseReport($user, $filters);

        if ($request->input('format') === 'csv') {
            return $this->exportToCsv(collect($report['items']), 'factory_wise_report.csv');
        }

        return response()->json($report);
    }

    /**
     * Get pending shipments report
     */
    public function pendingShipments(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'factory_id' => 'nullable|exists:users,id',
            'format' => 'nullable|string|in:json,csv',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'factory_id']);
        $report = $this->reportService->getPendingShipmentsReport($user, $filters);

        if ($request->input('format') === 'csv') {
            return $this->exportToCsv(collect($report['items']), 'pending_shipments_report.csv');
        }

        return response()->json($report);
    }

    /**
     * Get pending samples report
     */
    public function pendingSamples(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'factory_id' => 'nullable|exists:users,id',
            'sample_type' => 'nullable|exists:sample_types,id',
            'format' => 'nullable|string|in:json,csv',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['start_date', 'end_date', 'factory_id', 'sample_type']);
        $report = $this->reportService->getPendingSamplesReport($user, $filters);

        if ($request->input('format') === 'csv') {
            return $this->exportToCsv(collect($report['items']), 'pending_samples_report.csv');
        }

        return response()->json($report);
    }

    /**
     * Get delay report
     */
    public function delays(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'factory_id' => 'nullable|exists:users,id',
            'format' => 'nullable|string|in:json,csv',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $filters = $request->only(['factory_id']);
        $report = $this->reportService->getDelayReport($user, $filters);

        if ($request->input('format') === 'csv') {
            return $this->exportToCsv(collect($report['items']), 'delay_report.csv');
        }

        return response()->json($report);
    }

    /**
     * Export data to CSV
     */
    private function exportToCsv($data, string $filename)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($data) {
            $file = fopen('php://output', 'w');

            // Write headers
            if ($data->isNotEmpty()) {
                fputcsv($file, array_keys($data->first()));
            }

            // Write rows
            foreach ($data as $row) {
                fputcsv($file, (array) $row);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export data to Excel (placeholder - would require PhpSpreadsheet)
     */
    private function exportToExcel($data, string $filename)
    {
        // For now, return CSV format
        // In production, implement with PhpSpreadsheet for true Excel format
        return $this->exportToCsv($data, $filename);
    }
}
