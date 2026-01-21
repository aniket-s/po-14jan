<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds currency_id foreign key and ex_factory_date column to purchase_orders table.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Add currency_id foreign key for dynamic currency selection
            $table->foreignId('currency_id')->nullable()->after('currency')->constrained('currencies')->nullOnDelete();

            // Add ex_factory_date for FOB shipping term calculations
            // ETD = ex_factory_date + 7 days for FOB
            $table->date('ex_factory_date')->nullable()->after('etd_date');

            // Add shipping_term to store FOB/DDP at PO level
            $table->string('shipping_term', 10)->nullable()->after('ex_factory_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['currency_id']);
            $table->dropColumn(['currency_id', 'ex_factory_date', 'shipping_term']);
        });
    }
};
