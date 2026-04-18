<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds per-pivot factory pricing and ex-factory fields so an Agency can
 * record its cost to the factory (distinct from unit_price_in_po, which is
 * the agency → importer price) and an earlier factory ex-factory target
 * than the PO-level ex_factory_date to bake in a delivery buffer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->decimal('factory_unit_price', 10, 2)->nullable()->after('unit_price_in_po');
            $table->date('factory_ex_factory_date')->nullable()->after('ex_factory_date');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->dropColumn(['factory_unit_price', 'factory_ex_factory_date']);
        });
    }
};
