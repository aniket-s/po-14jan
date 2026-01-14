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
        Schema::table('styles', function (Blueprint $table) {
            // Master data foreign keys (can inherit from PO or override)
            $table->foreignId('brand_id')->nullable()->after('po_id')->constrained('brands')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->after('brand_id')->constrained('seasons')->nullOnDelete();
            $table->foreignId('division_id')->nullable()->after('season_id')->constrained('divisions')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->after('division_id')->constrained('customers')->nullOnDelete();
            $table->foreignId('agent_id')->nullable()->after('customer_id')->constrained('agents')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->after('agent_id')->constrained('vendors')->nullOnDelete();

            // Color split into code and name
            $table->string('color_code', 50)->nullable()->after('style_number'); // e.g., "H. Green"
            $table->string('color_name', 100)->nullable()->after('color_code'); // e.g., "Hunter Green"

            // Fabric details structured
            $table->string('fabric_name', 150)->nullable()->after('fabric'); // e.g., "Premium Cotton Fleece"
            $table->string('fabric_type', 100)->nullable()->after('fabric_name'); // e.g., "Jersey", "French Terry"
            $table->string('fabric_weight', 50)->nullable()->after('fabric_type'); // e.g., "320gsm", "180gsm"

            // Additional details
            $table->string('country_of_origin', 100)->nullable()->after('fabric_weight');
            $table->string('loading_port', 150)->nullable()->after('country_of_origin');
            $table->text('item_description')->nullable()->after('description'); // e.g., "S/S Men's Tee shirts"
            $table->text('packing_method')->nullable()->after('packing_details');

            // Creator/designer tracking
            $table->foreignId('created_by')->nullable()->after('po_id')->constrained('users')->nullOnDelete();
            $table->date('tp_date')->nullable()->after('created_by'); // Tech Pack date

            // Price and payment terms (can inherit from PO or override)
            $table->string('price_term', 50)->nullable()->after('fob_price'); // FOB, DDP, DP
            $table->string('payment_term', 100)->nullable()->after('price_term'); // DP, Net 15, Net 30, etc.

            // Current milestone tracking
            $table->string('current_milestone', 50)->nullable()->after('status'); // T/P, Proto, PP, SMS, TOP, Shipping, etc.
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropForeign(['season_id']);
            $table->dropForeign(['division_id']);
            $table->dropForeign(['customer_id']);
            $table->dropForeign(['agent_id']);
            $table->dropForeign(['vendor_id']);
            $table->dropForeign(['created_by']);

            $table->dropColumn([
                'brand_id',
                'season_id',
                'division_id',
                'customer_id',
                'agent_id',
                'vendor_id',
                'color_code',
                'color_name',
                'fabric_name',
                'fabric_type',
                'fabric_weight',
                'country_of_origin',
                'loading_port',
                'item_description',
                'packing_method',
                'created_by',
                'tp_date',
                'price_term',
                'payment_term',
                'current_milestone',
            ]);
        });
    }
};
