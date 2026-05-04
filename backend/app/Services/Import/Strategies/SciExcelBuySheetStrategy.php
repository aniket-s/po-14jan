<?php

namespace App\Services\Import\Strategies;

use App\Services\Import\Contracts\DateCalculationPolicy;
use App\Services\Import\Policies\NoDatesPolicy;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * SCI Excel Buy Sheet import. Creates a BuySheet record (not a PO).
 *
 * Reads the SCI buy-sheet top block:
 *   RETAILER/BUYER NAME: 128- CITI TRENDS TOPS   TICKETS REQ: YES
 *   DATE SUBMITTED: 4/9/26                       BUYER APPROVALS REQUIRED: YES
 *
 * And the style grid columns:
 *   LABEL | STYLE # | COLOR | CAD | DESCRIPTION | FABRIC | FIT | FACTORY DDP |
 *   TOTAL UNITS | PREPACK / SIZE SCALE | PACKING | IHD
 */
class SciExcelBuySheetStrategy extends AbstractExcelStrategy
{
    public function key(): string { return 'sci.excel.buy_sheet'; }
    public function label(): string { return 'SCI Excel Buy Sheet'; }
    public function buyerCode(): string { return 'SCI'; }
    public function documentKind(): string { return 'buy_sheet'; }

    public function datePolicy(): DateCalculationPolicy
    {
        return new NoDatesPolicy();
    }

    protected function headerAliases(): array
    {
        return [
            'label' => ['label'],
            'style_number' => ['style #', 'style#', 'style number', 'style no'],
            'color_name' => ['color', 'colour'],
            'description' => ['description', 'desc'],
            'notes' => ['notes', 'comment'],
            'fabric' => ['fabric'],
            'fit' => ['fit'],
            'unit_price' => ['factory ddp', 'ddp', 'unit price', 'fob'],
            'quantity' => ['total units', 'qty', 'quantity', 'total qty'],
            'size_breakdown' => ['size scale / prepack', 'prepack / size scale', 'size scale', 'prepack'],
            'pre_pack_inner' => ['pre pack inner', 'prepack inner', 'units per pack', 'pcs per pack'],
            'packing' => ['packing'],
            'ihd' => ['ihd', 'in-hand date', 'in hand'],
        ];
    }

    protected function extractDocumentMeta(Worksheet $sheet, array $allRows): array
    {
        $retailerCell = $this->findLabelledValue($allRows, 'RETAILER/BUYER NAME');
        $parsed = $this->parseBuySheetNumberCell($retailerCell);

        // Templates have varied across stores: some say "TICKETS REQ", others
        // "PRETICKETS"; some say "BUYER APPROVALS REQUIRED" (plural), others
        // singular. Try both so neither silently saves null.
        $ticketsCell = $this->findLabelledValue($allRows, ['TICKETS REQ', 'PRETICKETS']);
        $approvalsCell = $this->findLabelledValue($allRows, [
            'BUYER APPROVALS REQUIRED',
            'BUYER APPROVAL REQUIRED',
        ]);

        return [
            'buyer_name' => 'SPORT CASUAL INTERNATIONAL',
            'retailer_name' => $parsed['buy_sheet_name'],
            'buy_sheet_number' => $parsed['buy_sheet_number'],
            'buy_sheet_name' => $parsed['buy_sheet_name'],
            'tickets_required' => $this->yesNo($ticketsCell),
            'buyer_approvals_required' => $this->yesNo($approvalsCell),
            'po_date' => $this->normalizeDate($this->findLabelledValue($allRows, 'DATE SUBMITTED')),
        ];
    }

    private function yesNo(?string $v): ?bool
    {
        if ($v === null) return null;
        $v = strtolower(trim($v));
        if ($v === '') return null;
        // "NONE" appears in templates where the field is intentionally blank;
        // treat it as "no" rather than letting it look like an unknown value.
        if (in_array($v, ['no', 'n', 'false', '0', 'none', 'na', 'n/a'], true)) return false;
        return in_array($v, ['yes', 'y', 'true', '1'], true);
    }
}
