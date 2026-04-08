<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill retailer_id and season_id on styles from their linked POs.
     *
     * PDF-imported styles are linked to POs via the purchase_order_style pivot
     * table, but before commit d49c91f these fields were not propagated from
     * the PO header to the style record during import.
     */
    public function up(): void
    {
        // Backfill retailer_id from PO where style's retailer_id is null
        DB::statement("
            UPDATE styles s
            INNER JOIN purchase_order_style pos ON pos.style_id = s.id
            INNER JOIN purchase_orders po ON po.id = pos.purchase_order_id
            SET s.retailer_id = po.retailer_id
            WHERE s.retailer_id IS NULL
              AND po.retailer_id IS NOT NULL
        ");

        // Backfill season_id from PO where style's season_id is null
        DB::statement("
            UPDATE styles s
            INNER JOIN purchase_order_style pos ON pos.style_id = s.id
            INNER JOIN purchase_orders po ON po.id = pos.purchase_order_id
            SET s.season_id = po.season_id
            WHERE s.season_id IS NULL
              AND po.season_id IS NOT NULL
        ");

        $stylesUpdated = DB::table('styles')
            ->whereNotNull('retailer_id')
            ->whereIn('id', DB::table('purchase_order_style')->select('style_id'))
            ->count();

        echo "\n✓ Backfilled retailer_id/season_id on styles from linked POs ({$stylesUpdated} styles now have retailer_id)\n";
    }

    /**
     * Reverse is not practical — we can't distinguish which retailer_id values
     * were set by the original import vs this backfill.
     */
    public function down(): void
    {
        // No-op: cannot reliably reverse this data migration
    }
};
