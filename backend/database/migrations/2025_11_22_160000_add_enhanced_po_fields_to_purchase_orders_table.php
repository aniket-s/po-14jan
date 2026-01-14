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
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Date fields
            $table->date('revision_date')->nullable()->after('po_date');
            $table->date('etd_date')->nullable()->after('revision_date');
            $table->date('eta_date')->nullable()->after('etd_date');

            // Shipping information
            $table->string('ship_from', 100)->nullable()->after('destination_country');
            $table->string('ship_to', 100)->nullable()->after('ship_from');
            $table->string('manufacturer', 255)->nullable()->after('retailer');
            $table->text('ship_to_address')->nullable()->after('ship_to');

            // Sample schedule (JSON)
            $table->json('sample_schedule')->nullable()->after('additional_notes');

            // Buyer/trim details (JSON)
            $table->json('buyer_details')->nullable()->after('sample_schedule');

            // Packing guidelines
            $table->text('packing_guidelines')->nullable()->after('buyer_details');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'revision_date',
                'etd_date',
                'eta_date',
                'ship_from',
                'ship_to',
                'manufacturer',
                'ship_to_address',
                'sample_schedule',
                'buyer_details',
                'packing_guidelines',
            ]);
        });
    }
};
