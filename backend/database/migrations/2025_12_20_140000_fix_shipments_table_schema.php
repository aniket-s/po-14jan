<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            // Rename columns to match the code expectations
            $table->renameColumn('shipping_mode', 'shipment_method');
            $table->renameColumn('carton_count', 'total_cartons');
            $table->renameColumn('total_cbm', 'total_volume');
            $table->renameColumn('origin_port', 'port_of_loading');
            $table->renameColumn('destination_port', 'port_of_discharge');
            $table->renameColumn('shipment_number', 'shipment_reference');
            $table->renameColumn('etd', 'temp_etd');
            $table->renameColumn('eta', 'temp_eta');
            $table->renameColumn('actual_departure', 'temp_actual_departure');
            $table->renameColumn('actual_arrival', 'temp_actual_arrival');
        });

        Schema::table('shipments', function (Blueprint $table) {
            // Add purchase_order_id as a foreign key (CRITICAL)
            $table->foreignId('purchase_order_id')->nullable()->after('id')->constrained('purchase_orders')->cascadeOnDelete();

            // Add tracking token for public tracking
            $table->string('tracking_token', 32)->nullable()->unique()->after('tracking_number');

            // Add carrier information
            $table->string('carrier_name')->nullable()->after('tracking_token');
            $table->string('carrier_tracking_url', 500)->nullable()->after('carrier_name');

            // Add shipment type
            $table->string('shipment_type', 50)->nullable()->after('shipment_method')->comment('full, partial');

            // Add shipping details that were missing
            $table->string('container_number')->nullable()->after('shipment_type');
            $table->string('seal_number')->nullable()->after('container_number');
            $table->string('vessel_name')->nullable()->after('seal_number');
            $table->string('voyage_number')->nullable()->after('vessel_name');

            // Add final_destination
            $table->string('final_destination')->nullable()->after('port_of_discharge');

            // Add notes and metadata
            $table->text('notes')->nullable()->after('documents');
            $table->json('metadata')->nullable()->after('notes');

            // Add last_updated_by
            $table->foreignId('last_updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();

            // Drop temp columns and recreate as nullable date columns
            // (estimated_dispatch_date, actual_dispatch_date already added by previous migration)
            // (estimated_arrival_date, actual_arrival_date already added by previous migration)
            // (estimated_delivery_date, actual_delivery_date already added by previous migration)
        });

        // Drop the temporary renamed columns and unused columns from old schema
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'temp_etd',
                'temp_eta',
                'temp_actual_departure',
                'temp_actual_arrival',
                'style_ids', // No longer used, replaced by shipment_items table
                'shipping_details', // No longer used, specific fields added instead
                'status_history', // Can be recreated if needed via shipment_updates table
            ]);
        });

        // Update factory_id to be nullable since we now have purchase_order_id
        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('factory_id')->nullable()->change();
        });

        // Update invoice_number to be nullable
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('invoice_number')->nullable()->change();
        });

        // Update shipment_method enum to match expected values
        Schema::table('shipments', function (Blueprint $table) {
            // Change from enum to string to allow air, sea, courier, road
            $table->string('shipment_method', 50)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            // Reverse the column renames
            $table->renameColumn('shipment_method', 'shipping_mode');
            $table->renameColumn('total_cartons', 'carton_count');
            $table->renameColumn('total_volume', 'total_cbm');
            $table->renameColumn('port_of_loading', 'origin_port');
            $table->renameColumn('port_of_discharge', 'destination_port');
            $table->renameColumn('shipment_reference', 'shipment_number');
        });

        Schema::table('shipments', function (Blueprint $table) {
            // Drop added columns
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn([
                'purchase_order_id',
                'tracking_token',
                'carrier_name',
                'carrier_tracking_url',
                'shipment_type',
                'container_number',
                'seal_number',
                'vessel_name',
                'voyage_number',
                'final_destination',
                'notes',
                'metadata',
            ]);

            $table->dropForeign(['last_updated_by']);
            $table->dropColumn('last_updated_by');
        });

        Schema::table('shipments', function (Blueprint $table) {
            // Recreate the old date columns
            $table->date('etd')->nullable();
            $table->date('eta')->nullable();
            $table->date('actual_departure')->nullable();
            $table->date('actual_arrival')->nullable();

            // Recreate old columns
            $table->json('style_ids')->nullable();
            $table->json('shipping_details')->nullable();
            $table->json('status_history')->nullable();
        });

        // Revert factory_id to non-nullable
        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('factory_id')->nullable(false)->change();
        });

        // Revert invoice_number to non-nullable
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('invoice_number')->nullable(false)->change();
        });
    }
};
