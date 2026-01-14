<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Makes total_quantity and unit_price nullable in styles table.
     * Per new requirements: Quantity & Pricing are now added at PO creation, not style creation.
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Make total_quantity and unit_price nullable
            // These fields are now provided during PO creation, not style creation
            $table->integer('total_quantity')->nullable()->change();
            $table->decimal('unit_price', 10, 2)->nullable()->change();
        });

        echo "\n✓ Made styles.total_quantity and styles.unit_price nullable\n";
        echo "  Quantity and pricing are now captured at PO creation instead of style creation\n";
    }

    /**
     * Reverse the migrations.
     *
     * WARNING: This will make total_quantity and unit_price required again!
     * Styles without these values will cause errors.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Revert to required fields
            $table->integer('total_quantity')->nullable(false)->change();
            $table->decimal('unit_price', 10, 2)->nullable(false)->change();
        });

        echo "\n✓ Reverted styles.total_quantity and styles.unit_price to required\n";
    }
};
