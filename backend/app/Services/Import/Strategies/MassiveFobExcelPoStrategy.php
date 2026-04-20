<?php

namespace App\Services\Import\Strategies;

use App\Services\Import\Contracts\DateCalculationPolicy;
use App\Services\Import\Policies\MassiveFobDatePolicy;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Massive LLC FOB Excel PO.
 *
 * Special rule from product: no In-House / ETD / ETA are computed or stored.
 * FOB date = "DIRECT TO CONSOLIDATOR" date on the sheet.
 * Ex-Factory = FOB - 15 calendar days (applied by MassiveFobDatePolicy).
 */
class MassiveFobExcelPoStrategy extends AbstractExcelStrategy
{
    public function key(): string { return 'massive.excel.fob.po'; }
    public function label(): string { return 'Massive FOB Excel PO'; }
    public function buyerCode(): string { return 'MASSIVE'; }
    public function supportsBuySheetReference(): bool { return true; }

    public function datePolicy(): DateCalculationPolicy
    {
        return new MassiveFobDatePolicy();
    }

    protected function headerAliases(): array
    {
        return [
            'style_number' => ['style #', 'style#', 'style number'],
            'color_name' => ['color', 'colour'],
            'description' => ['print details', 'description', 'model/description'],
            'label' => ['label'],
            'fabric' => ['fabric', 'fab/content'],
            'fit' => ['fit'],
            'unit_price' => ['fob', 'unit price', 'rate'],
            'quantity' => ['qty', 'quantity', 'total pcs', 'total units'],
            'size_breakdown' => ['size specifications', 'sizes'],
        ];
    }

    protected function extractDocumentMeta(Worksheet $sheet, array $allRows): array
    {
        $contract = $this->findLabelledValue($allRows, 'CONTRACT#');
        $customer = $this->findLabelledValue($allRows, 'CUSTOMER');
        $supplier = $this->findLabelledValue($allRows, 'SUPPLIER');
        $model = $this->findLabelledValue($allRows, 'MODEL/DESCRIPTION');
        $docDate = $this->findLabelledValue($allRows, 'DATE');
        $consolidator = $this->findLabelledValue($allRows, 'DIRECT TO CONSOLIDATOR');
        $fobPrice = $this->findLabelledValue($allRows, 'FOB');

        return [
            'po_number' => $contract,
            'buyer_name' => 'MASSIVE LLC',
            'customer_name' => $customer,
            'retailer_name' => $customer,
            'vendor_name' => $supplier,
            'agent_name' => $supplier,
            'additional_notes' => $model,
            'po_date' => $this->normalizeDate($docDate),
            'fob_date' => $this->normalizeDate($consolidator),
            'shipping_term' => 'FOB',
            'fob_price_raw' => $fobPrice,
        ];
    }

    protected function buildHeader(array $meta): array
    {
        $h = parent::buildHeader($meta);
        $h['shipping_term'] = [
            'value' => 'FOB', 'status' => 'parsed', 'raw_text' => 'FOB', 'confidence' => 'high',
        ];
        // Keep etd/eta/ihd empty - policy deliberately doesn't fill them
        return $h;
    }
}
