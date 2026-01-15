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
            // Add wholesale_price column
            if (!Schema::hasColumn('styles', 'wholesale_price')) {
                $table->decimal('wholesale_price', 10, 2)->nullable()->after('msrp')->comment('Wholesale price for bulk customers');
            }

            // Drop price tier columns (price_1 through price_5)
            $columnsToDrop = [];
            if (Schema::hasColumn('styles', 'price_1')) {
                $columnsToDrop[] = 'price_1';
            }
            if (Schema::hasColumn('styles', 'price_2')) {
                $columnsToDrop[] = 'price_2';
            }
            if (Schema::hasColumn('styles', 'price_3')) {
                $columnsToDrop[] = 'price_3';
            }
            if (Schema::hasColumn('styles', 'price_4')) {
                $columnsToDrop[] = 'price_4';
            }
            if (Schema::hasColumn('styles', 'price_5')) {
                $columnsToDrop[] = 'price_5';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Drop wholesale_price
            if (Schema::hasColumn('styles', 'wholesale_price')) {
                $table->dropColumn('wholesale_price');
            }

            // Re-add price tier columns
            if (!Schema::hasColumn('styles', 'price_1')) {
                $table->decimal('price_1', 10, 2)->nullable()->after('msrp')->comment('Price tier 1');
            }
            if (!Schema::hasColumn('styles', 'price_2')) {
                $table->decimal('price_2', 10, 2)->nullable()->after('price_1')->comment('Price tier 2');
            }
            if (!Schema::hasColumn('styles', 'price_3')) {
                $table->decimal('price_3', 10, 2)->nullable()->after('price_2')->comment('Price tier 3');
            }
            if (!Schema::hasColumn('styles', 'price_4')) {
                $table->decimal('price_4', 10, 2)->nullable()->after('price_3')->comment('Price tier 4');
            }
            if (!Schema::hasColumn('styles', 'price_5')) {
                $table->decimal('price_5', 10, 2)->nullable()->after('price_4')->comment('Price tier 5');
            }
        });
    }
};
