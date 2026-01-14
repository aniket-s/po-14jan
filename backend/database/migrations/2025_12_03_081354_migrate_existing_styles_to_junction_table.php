<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration migrates existing styles data to the new purchase_order_style junction table.
     * It copies PO-specific fields from styles table to the pivot table.
     */
    public function up(): void
    {
        // Check if there are any styles to migrate
        $stylesToMigrate = DB::table('styles')->whereNotNull('po_id')->count();

        if ($stylesToMigrate === 0) {
            echo "\n✓ No styles to migrate (all styles are already standalone or no styles exist)\n";
            return;
        }

        // Get column names from styles table to check what exists
        $columns = DB::getSchemaBuilder()->getColumnListing('styles');

        // Build dynamic SELECT based on available columns
        $hasAssignedAt = in_array('assigned_at', $columns);
        $hasAssignmentType = in_array('assignment_type', $columns);
        $hasAssignedFactoryId = in_array('assigned_factory_id', $columns);
        $hasAssignedAgencyId = in_array('assigned_agency_id', $columns);
        $hasTargetProductionDate = in_array('target_production_date', $columns);
        $hasTargetShipmentDate = in_array('target_shipment_date', $columns);
        $hasExFactoryDate = in_array('ex_factory_date', $columns);
        $hasStatus = in_array('status', $columns);

        // Migrate existing styles to purchase_order_style junction table
        // Use safe column selection (NULL if column doesn't exist)
        $sql = "
            INSERT INTO purchase_order_style (
                purchase_order_id,
                style_id,
                quantity_in_po,
                unit_price_in_po,
                assigned_factory_id,
                assigned_agency_id,
                assignment_type,
                assigned_at,
                target_production_date,
                target_shipment_date,
                ex_factory_date,
                status,
                notes,
                created_at,
                updated_at
            )
            SELECT
                po_id,
                id,
                total_quantity,
                unit_price,
                " . ($hasAssignedFactoryId ? "assigned_factory_id" : "NULL") . ",
                " . ($hasAssignedAgencyId ? "assigned_agency_id" : "NULL") . ",
                " . ($hasAssignmentType ? "assignment_type" : "NULL") . ",
                " . ($hasAssignedAt ? "assigned_at" : "NULL") . ",
                " . ($hasTargetProductionDate ? "target_production_date" : "NULL") . ",
                " . ($hasTargetShipmentDate ? "target_shipment_date" : "NULL") . ",
                " . ($hasExFactoryDate ? "ex_factory_date" : "NULL") . ",
                " . ($hasStatus ? "status" : "'pending'") . ",
                NULL as notes,
                created_at,
                updated_at
            FROM styles
            WHERE po_id IS NOT NULL
        ";

        DB::statement($sql);

        // Log migration results
        $migratedCount = DB::table('purchase_order_style')->count();
        echo "\n✓ Migrated {$migratedCount} style records to purchase_order_style junction table\n";

        if (!$hasAssignedAt || !$hasAssignmentType) {
            echo "  ⚠ Note: Some columns didn't exist in styles table, used NULL values\n";
        }
    }

    /**
     * Reverse the migrations.
     *
     * WARNING: This rollback will delete all junction table data!
     * Make sure you have a backup before rolling back.
     */
    public function down(): void
    {
        // Clear the junction table
        DB::table('purchase_order_style')->truncate();

        echo "\n✓ Cleared purchase_order_style junction table\n";
    }
};
