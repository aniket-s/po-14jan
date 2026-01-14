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
            // Add new foreign keys
            $table->foreignId('retailer_id')->nullable()->after('vendor_id')->constrained()->onDelete('set null');
            $table->foreignId('country_id')->nullable()->after('retailer_id')->constrained()->onDelete('set null');
            $table->foreignId('warehouse_id')->nullable()->after('country_id')->constrained()->onDelete('set null');

            // Add new date fields
            $table->date('in_warehouse_date')->nullable()->after('eta_date')->comment('ETA + 4 working days');

            // Modify payment_terms to be JSON
            $table->json('payment_terms_structured')->nullable()->after('payment_terms')->comment('{"term": "NET30", "percentage": 50}');

            // Drop old fields we no longer need
            // First drop foreign key constraints
            if (Schema::hasColumn('purchase_orders', 'division_id')) {
                $table->dropForeign(['division_id']);
            }
            if (Schema::hasColumn('purchase_orders', 'customer_id')) {
                $table->dropForeign(['customer_id']);
            }

            // Then drop the columns
            $table->dropColumn([
                'division_id',
                'customer_id',
                'price_term',
                'ship_from',
                'manufacturer'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Remove new fields
            $table->dropForeign(['retailer_id']);
            $table->dropColumn('retailer_id');

            $table->dropForeign(['country_id']);
            $table->dropColumn('country_id');

            $table->dropForeign(['warehouse_id']);
            $table->dropColumn('warehouse_id');

            $table->dropColumn(['in_warehouse_date', 'payment_terms_structured']);

            // Restore old fields
            $table->foreignId('division_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('customer_id')->nullable()->constrained()->onDelete('set null');
            $table->string('price_term')->nullable();
            $table->string('ship_from')->nullable();
            $table->string('manufacturer')->nullable();
        });
    }
};
