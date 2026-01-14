<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class TNAChartService
{
    protected SampleScheduleService $scheduleService;

    public function __construct(SampleScheduleService $scheduleService)
    {
        $this->scheduleService = $scheduleService;
    }

    /**
     * Generate TNA (Time and Action) Chart for a Purchase Order
     *
     * @param PurchaseOrder $purchaseOrder
     * @return string Path to the generated file
     */
    public function generateTNAChart(PurchaseOrder $purchaseOrder): string
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Set document properties
        $spreadsheet->getProperties()
            ->setCreator('PO Management System')
            ->setTitle('TNA Chart - ' . $purchaseOrder->po_number)
            ->setSubject('Time and Action Calendar')
            ->setDescription('Sample schedule and milestone tracking')
            ->setKeywords('TNA PO Sample Schedule')
            ->setCategory('Purchase Order');

        // Add header
        $this->addHeader($sheet, $purchaseOrder);

        // Add TNA table
        $this->addTNATable($sheet, $purchaseOrder);

        // Auto-size columns
        foreach (range('A', 'F') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Save file
        $fileName = 'TNA_' . $purchaseOrder->po_number . '_' . now()->format('Ymd_His') . '.xlsx';
        $filePath = 'tna_charts/' . $fileName;
        $fullPath = storage_path('app/public/' . $filePath);

        // Ensure directory exists
        $directory = dirname($fullPath);
        if (!file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        $writer = new Xlsx($spreadsheet);
        $writer->save($fullPath);

        return $filePath;
    }

    /**
     * Add header section to the TNA chart
     *
     * @param $sheet
     * @param PurchaseOrder $purchaseOrder
     * @return void
     */
    protected function addHeader($sheet, PurchaseOrder $purchaseOrder): void
    {
        // Title
        $sheet->setCellValue('A1', 'TIME AND ACTION CALENDAR (TNA)');
        $sheet->mergeCells('A1:F1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // PO Information
        $row = 3;
        $sheet->setCellValue('A' . $row, 'PO Number:');
        $sheet->setCellValue('B' . $row, $purchaseOrder->po_number);
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);

        $row++;
        $sheet->setCellValue('A' . $row, 'PO Date:');
        $sheet->setCellValue('B' . $row, $purchaseOrder->po_date ? $purchaseOrder->po_date->format('Y-m-d') : 'N/A');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);

        $row++;
        $sheet->setCellValue('A' . $row, 'ETD Date:');
        $sheet->setCellValue('B' . $row, $purchaseOrder->etd_date ? $purchaseOrder->etd_date->format('Y-m-d') : 'N/A');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);

        $row++;
        $sheet->setCellValue('A' . $row, 'ETA Date:');
        $sheet->setCellValue('B' . $row, $purchaseOrder->eta_date ? $purchaseOrder->eta_date->format('Y-m-d') : 'N/A');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);

        $row++;
        if ($purchaseOrder->retailer) {
            $sheet->setCellValue('A' . $row, 'Retailer:');
            $sheet->setCellValue('B' . $row, $purchaseOrder->retailer->name ?? 'N/A');
            $sheet->getStyle('A' . $row)->getFont()->setBold(true);
        }

        $row++;
        $sheet->setCellValue('A' . $row, 'Generated:');
        $sheet->setCellValue('B' . $row, now()->format('Y-m-d H:i:s'));
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);
    }

    /**
     * Add TNA table with milestones
     *
     * @param $sheet
     * @param PurchaseOrder $purchaseOrder
     * @return void
     */
    protected function addTNATable($sheet, PurchaseOrder $purchaseOrder): void
    {
        $startRow = 12;

        // Table headers
        $headers = ['#', 'Milestone', 'Planned Date', 'Actual Date', 'Status', 'Remarks'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $startRow, $header);
            $col++;
        }

        // Style headers
        $headerRange = 'A' . $startRow . ':F' . $startRow;
        $sheet->getStyle($headerRange)->getFont()->setBold(true);
        $sheet->getStyle($headerRange)->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FF4472C4');
        $sheet->getStyle($headerRange)->getFont()->getColor()->setARGB(Color::COLOR_WHITE);
        $sheet->getStyle($headerRange)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Get sample schedule
        if ($purchaseOrder->po_date && $purchaseOrder->etd_date) {
            $schedule = $this->scheduleService->generateSchedule(
                $purchaseOrder->po_date,
                $purchaseOrder->etd_date
            );
        } else {
            $schedule = [];
        }

        // Add milestone rows
        $row = $startRow + 1;
        $index = 1;
        $today = Carbon::today();

        foreach ($schedule as $key => $milestone) {
            $plannedDate = $milestone['date'];
            $status = 'Pending';

            // Determine status
            if ($plannedDate->lessThan($today)) {
                $status = 'Overdue';
                $statusColor = 'FFFF0000'; // Red
            } elseif ($plannedDate->equalTo($today)) {
                $status = 'Due Today';
                $statusColor = 'FFFFA500'; // Orange
            } else {
                $status = 'Pending';
                $statusColor = 'FF92D050'; // Green
            }

            $sheet->setCellValue('A' . $row, $index);
            $sheet->setCellValue('B' . $row, $milestone['name']);
            $sheet->setCellValue('C' . $row, $plannedDate->format('Y-m-d'));
            $sheet->setCellValue('D' . $row, ''); // Actual date - to be filled manually
            $sheet->setCellValue('E' . $row, $status);
            $sheet->setCellValue('F' . $row, $milestone['description']);

            // Style status cell
            $sheet->getStyle('E' . $row)->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB($statusColor);

            // Center align
            $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('E' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $row++;
            $index++;
        }

        // Add borders to table
        $tableRange = 'A' . $startRow . ':F' . ($row - 1);
        $sheet->getStyle($tableRange)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        // Add notes section
        $row += 2;
        $sheet->setCellValue('A' . $row, 'Notes:');
        $sheet->getStyle('A' . $row)->getFont()->setBold(true);
        $row++;
        $sheet->setCellValue('A' . $row, '- Fill in "Actual Date" column when milestone is completed');
        $row++;
        $sheet->setCellValue('A' . $row, '- Update "Status" based on completion: Pending / In Progress / Completed / Overdue');
        $row++;
        $sheet->setCellValue('A' . $row, '- Add remarks for any delays or issues');
    }

    /**
     * Get TNA chart file path for a PO
     *
     * @param PurchaseOrder $purchaseOrder
     * @return string|null
     */
    public function getTNAChartPath(PurchaseOrder $purchaseOrder): ?string
    {
        // Check if TNA chart exists
        $pattern = 'tna_charts/TNA_' . $purchaseOrder->po_number . '_*.xlsx';
        $files = Storage::disk('public')->files('tna_charts');

        foreach ($files as $file) {
            if (str_starts_with(basename($file), 'TNA_' . $purchaseOrder->po_number . '_')) {
                return $file;
            }
        }

        return null;
    }

    /**
     * Delete old TNA charts for a PO
     *
     * @param PurchaseOrder $purchaseOrder
     * @return int Number of files deleted
     */
    public function deleteOldTNACharts(PurchaseOrder $purchaseOrder): int
    {
        $deleted = 0;
        $files = Storage::disk('public')->files('tna_charts');

        foreach ($files as $file) {
            if (str_starts_with(basename($file), 'TNA_' . $purchaseOrder->po_number . '_')) {
                Storage::disk('public')->delete($file);
                $deleted++;
            }
        }

        return $deleted;
    }
}
