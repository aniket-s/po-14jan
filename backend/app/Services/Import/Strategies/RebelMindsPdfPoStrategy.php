<?php

namespace App\Services\Import\Strategies;

use App\Services\Import\Contracts\DateCalculationPolicy;
use App\Services\Import\Policies\FobDatePolicy;

/**
 * Rebel Minds PDF PO. First pass uses the generic Claude extraction + FOB
 * date policy. When a Rebel Minds-specific PDF fixture is available the
 * `refineHeader`/`refineStyles` hooks can encode layout peculiarities.
 */
class RebelMindsPdfPoStrategy extends AbstractClaudePdfStrategy
{
    public function key(): string { return 'rebel_minds.pdf.po'; }
    public function label(): string { return 'Rebel Minds PDF PO'; }
    public function buyerCode(): string { return 'RMS'; }
    public function supportsBuySheetReference(): bool { return false; }

    public function datePolicy(): DateCalculationPolicy
    {
        return new FobDatePolicy();
    }
}
