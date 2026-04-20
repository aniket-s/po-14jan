<?php

namespace App\Services\Import\Strategies;

use App\Services\Import\Contracts\DateCalculationPolicy;
use App\Services\Import\Policies\DdpDatePolicy;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Massive LLC DDP Excel PO.
 * Uses the standard DDP date cascade (IHD -> ETD -> Ex-Factory).
 */
class MassiveDdpExcelPoStrategy extends AbstractExcelStrategy
{
    public function key(): string { return 'massive.excel.ddp.po'; }
    public function label(): string { return 'Massive DDP Excel PO'; }
    public function buyerCode(): string { return 'MASSIVE'; }
    public function supportsBuySheetReference(): bool { return true; }

    public function datePolicy(): DateCalculationPolicy
    {
        return new DdpDatePolicy();
    }

    protected function headerAliases(): array
    {
        return [
            'style_number' => ['style #', 'style#', 'style number', 'style no'],
            'color_name' => ['color', 'colour'],
            'description' => ['print details', 'description', 'model/description'],
            'label' => ['label'],
            'fabric' => ['fabric', 'fab/content', 'fabric/content'],
            'fit' => ['fit'],
            'unit_price' => ['ddp', 'unit price', 'rate'],
            'quantity' => ['qty', 'quantity', 'total units', 'total pcs'],
            'size_breakdown' => ['size specifications', 'size scale', 'prepack', 'sizes'],
            'packing' => ['packing instruction', 'packing'],
            'ihd' => ['in-house', 'in house', 'ihd'],
        ];
    }

    protected function extractDocumentMeta(Worksheet $sheet, array $allRows): array
    {
        $contract = $this->findLabelledValue($allRows, 'CONTRACT#');
        $customer = $this->findLabelledValue($allRows, 'CUSTOMER');
        $supplier = $this->findLabelledValue($allRows, 'SUPPLIER');
        $model = $this->findLabelledValue($allRows, 'MODEL/DESCRIPTION');
        $docDate = $this->findLabelledValue($allRows, 'DATE');
        $inHouse = $this->findLabelledValue($allRows, 'IN-HOUSE')
            ?? $this->findLabelledValue($allRows, 'DIRECT TO CONSOLIDATOR');
        $etd = $this->findLabelledValue($allRows, 'ETD');
        $eta = $this->findLabelledValue($allRows, 'ETA');

        return [
            'po_number' => $contract,
            'buyer_name' => 'MASSIVE LLC',
            'customer_name' => $customer,
            'retailer_name' => $customer,
            'vendor_name' => $supplier,
            'agent_name' => $supplier,
            'additional_notes' => $model,
            'po_date' => $this->normalizeDate($docDate),
            'in_warehouse_date' => $this->normalizeDate($inHouse),
            'etd_date' => $this->normalizeDate($etd),
            'eta_date' => $this->normalizeDate($eta),
            'shipping_term' => 'DDP',
        ];
    }

    protected function buildHeader(array $meta): array
    {
        $h = parent::buildHeader($meta);
        // Wrap shipping_term explicitly
        $h['shipping_term'] = [
            'value' => 'DDP', 'status' => 'parsed', 'raw_text' => 'DDP', 'confidence' => 'high',
        ];
        return $h;
    }
}
