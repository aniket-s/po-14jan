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
        Schema::table('purchase_order_style', function (Blueprint $table) {
            // Add price term for per-style pricing
            $table->enum('price_term', ['FOB', 'DDP'])->nullable()->after('unit_price_in_po')->comment('Free On Board or Delivered Duty Paid');

            // Add size breakdown as JSON
            $table->json('size_breakdown')->nullable()->after('price_term')->comment('Size quantities for this style in this PO');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->dropColumn(['price_term', 'size_breakdown']);
        });
    }
};
