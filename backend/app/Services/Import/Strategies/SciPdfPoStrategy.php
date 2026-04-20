<?php

namespace App\Services\Import\Strategies;

use App\Services\Import\Contracts\DateCalculationPolicy;
use App\Services\Import\Policies\FobDatePolicy;

/**
 * Sports Casual International PDF PO.
 * Uses the generic Claude extraction (which already has SCI-specific hints
 * baked into its prompt) and applies the standard FOB date cascade. Supports
 * "import against an existing buy sheet" - that linkage is applied at commit time.
 */
class SciPdfPoStrategy extends AbstractClaudePdfStrategy
{
    public function key(): string { return 'sci.pdf.po'; }
    public function label(): string { return 'SCI PDF PO'; }
    public function buyerCode(): string { return 'SCI'; }
    public function supportsBuySheetReference(): bool { return true; }

    public function datePolicy(): DateCalculationPolicy
    {
        return new FobDatePolicy();
    }
}
