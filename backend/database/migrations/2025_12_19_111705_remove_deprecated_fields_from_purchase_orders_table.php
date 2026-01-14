<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Remove deprecated fields from purchase_orders table:
     * - division_id (replaced by brand-specific logic)
     * - customer_id (replaced by retailer_id)
     * - price_term (moved to purchase_order_style pivot table)
     * - manufacturer (no longer needed)
     * - ship_from (no longer needed, using country of origin)
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Drop foreign keys first if they exist
            if (Schema::hasColumn('purchase_orders', 'division_id')) {
                $table->dropForeign(['division_id']);
                $table->dropColumn('division_id');
            }

            if (Schema::hasColumn('purchase_orders', 'customer_id')) {
                $table->dropForeign(['customer_id']);
                $table->dropColumn('customer_id');
            }

            // Drop regular columns
            if (Schema::hasColumn('purchase_orders', 'price_term')) {
                $table->dropColumn('price_term');
            }

            if (Schema::hasColumn('purchase_orders', 'manufacturer')) {
                $table->dropColumn('manufacturer');
            }

            if (Schema::hasColumn('purchase_orders', 'ship_from')) {
                $table->dropColumn('ship_from');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Restore columns in reverse order
            $table->string('ship_from', 100)->nullable();
            $table->string('manufacturer', 255)->nullable();
            $table->string('price_term', 50)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('division_id')->nullable();

            // Restore foreign keys (assuming these tables exist)
            // $table->foreign('division_id')->references('id')->on('divisions')->onDelete('set null');
            // $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
        });
    }
};
