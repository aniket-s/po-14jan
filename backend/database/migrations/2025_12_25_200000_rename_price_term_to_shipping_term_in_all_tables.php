<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Rename price_term column to shipping_term across all tables
     */
    public function up(): void
    {
        // Rename in styles table
        if (Schema::hasColumn('styles', 'price_term')) {
            Schema::table('styles', function (Blueprint $table) {
                $table->renameColumn('price_term', 'shipping_term');
            });
        }

        // Rename in purchase_order_style pivot table (most important)
        if (Schema::hasColumn('purchase_order_style', 'price_term')) {
            Schema::table('purchase_order_style', function (Blueprint $table) {
                $table->renameColumn('price_term', 'shipping_term');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert in purchase_order_style pivot table
        if (Schema::hasColumn('purchase_order_style', 'shipping_term')) {
            Schema::table('purchase_order_style', function (Blueprint $table) {
                $table->renameColumn('shipping_term', 'price_term');
            });
        }

        // Revert in styles table
        if (Schema::hasColumn('styles', 'shipping_term')) {
            Schema::table('styles', function (Blueprint $table) {
                $table->renameColumn('shipping_term', 'price_term');
            });
        }
    }
};
