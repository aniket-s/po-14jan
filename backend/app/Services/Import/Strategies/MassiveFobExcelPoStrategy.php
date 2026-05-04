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
        $contract = $this->findLabelledValue($allRows, ['CONTRACT#', 'CONTRACT #', 'CONTRACT NO']);
        $customer = $this->findLabelledValue($allRows, 'CUSTOMER');
        $supplier = $this->findLabelledValue($allRows, ['SUPPLIER', 'VENDOR']);
        $model = $this->findLabelledValue($allRows, ['MODEL/DESCRIPTION', 'MODEL / DESCRIPTION', 'STYLE NAME']);
        // The Massive template puts the issue date under a plain "DATE" label,
        // but other variants of the template call it "PO DATE" / "ISSUE DATE" /
        // "ORDER DATE". Try all of them so we don't fall back to today's date.
        $docDate = $this->findLabelledValue($allRows, [
            'DATE',
            'PO DATE',
            'ORDER DATE',
            'ISSUE DATE',
            'CONTRACT DATE',
            'PO ISSUE DATE',
        ]);
        $consolidator = $this->findLabelledValue($allRows, ['DIRECT TO CONSOLIDATOR', 'CONSOLIDATOR']);
        $fobPrice = $this->findLabelledValue($allRows, 'FOB');
        // The accessory "SUPPLIED BY: INDIA" cell is the only country signal in
        // this template - take it as country of origin so the form auto-resolves.
        $country = $this->findLabelledValue($allRows, [
            'COUNTRY OF ORIGIN', 'COUNTRY', 'SUPPLIED BY', 'ORIGIN',
        ]);

        return [
            'po_number' => $contract,
            'buyer_name' => 'MASSIVE LLC',
            'customer_name' => $customer,
            'retailer_name' => $customer,
            'vendor_name' => $supplier,
            'agent_name' => $supplier,
            'headline' => $model,
            'additional_notes' => $model,
            'po_date' => $this->normalizeDate($docDate),
            'fob_date' => $this->normalizeDate($consolidator),
            'shipping_term' => 'FOB',
            // Massive's template hard-codes USD pricing (the FOB cell uses a $
            // sign), so seed currency_raw rather than letting it default silently
            // to USD on the frontend without a "matched" status.
            'currency_raw' => 'USD',
            'country_of_origin' => $country,
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
