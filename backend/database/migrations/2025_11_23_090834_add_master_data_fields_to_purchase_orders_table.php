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
            // Master data foreign keys
            $table->foreignId('brand_id')->nullable()->after('po_number')->constrained('brands')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->after('brand_id')->constrained('seasons')->nullOnDelete();
            $table->foreignId('division_id')->nullable()->after('season_id')->constrained('divisions')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->after('division_id')->constrained('customers')->nullOnDelete();
            $table->foreignId('agent_id')->nullable()->after('customer_id')->constrained('agents')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->after('agent_id')->constrained('vendors')->nullOnDelete();

            // Price and payment terms
            $table->string('price_term', 50)->nullable()->after('currency'); // FOB, DDP, DP
            $table->string('payment_term', 100)->nullable()->after('price_term'); // DP, Net 15, Net 30, Net 45, Net 60, L/C

            // Additional shipping and manufacturing details
            $table->string('country_of_origin', 100)->nullable()->after('destination_country');
            $table->string('loading_port', 150)->nullable()->after('country_of_origin');
            $table->text('packing_method')->nullable()->after('packing_guidelines');
            $table->text('other_terms')->nullable()->after('packing_method');

            // Revision tracking
            $table->integer('revision_number')->default(1)->after('po_number');
            $table->foreignId('revised_by')->nullable()->after('creator_id')->constrained('users')->nullOnDelete();

            // Delivery date (rename from existing if needed)
            $table->date('delivery_date')->nullable()->after('po_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropForeign(['season_id']);
            $table->dropForeign(['division_id']);
            $table->dropForeign(['customer_id']);
            $table->dropForeign(['agent_id']);
            $table->dropForeign(['vendor_id']);
            $table->dropForeign(['revised_by']);

            $table->dropColumn([
                'brand_id',
                'season_id',
                'division_id',
                'customer_id',
                'agent_id',
                'vendor_id',
                'price_term',
                'payment_term',
                'country_of_origin',
                'loading_port',
                'packing_method',
                'other_terms',
                'revision_number',
                'revised_by',
                'delivery_date',
            ]);
        });
    }
};
