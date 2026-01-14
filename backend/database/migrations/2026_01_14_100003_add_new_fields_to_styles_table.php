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
            // New master data relationships
            $table->foreignId('buyer_id')->nullable()->after('brand_id')->constrained('buyers')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->after('buyer_id')->constrained('categories')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->after('category_id')->constrained('seasons')->nullOnDelete();
            $table->foreignId('color_id')->nullable()->after('color')->constrained('colors')->nullOnDelete();

            // Pricing fields
            $table->decimal('msrp', 10, 2)->nullable()->after('fob_price')->comment('Manufacturer Suggested Retail Price');
            $table->decimal('price_1', 10, 2)->nullable()->after('msrp')->comment('Price tier 1');
            $table->decimal('price_2', 10, 2)->nullable()->after('price_1')->comment('Price tier 2');
            $table->decimal('price_3', 10, 2)->nullable()->after('price_2')->comment('Price tier 3');
            $table->decimal('price_4', 10, 2)->nullable()->after('price_3')->comment('Price tier 4');
            $table->decimal('price_5', 10, 2)->nullable()->after('price_4')->comment('Price tier 5');

            // Status and audit fields
            $table->boolean('is_active')->default(true)->after('status')->comment('Whether this style is active');
            $table->foreignId('updated_by')->nullable()->after('is_active')->constrained('users')->nullOnDelete();

            // Indexes
            $table->index('buyer_id');
            $table->index('category_id');
            $table->index('season_id');
            $table->index('color_id');
            $table->index('is_active');
            $table->index('updated_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Drop foreign keys first
            $table->dropForeign(['buyer_id']);
            $table->dropForeign(['category_id']);
            $table->dropForeign(['season_id']);
            $table->dropForeign(['color_id']);
            $table->dropForeign(['updated_by']);

            // Drop indexes
            $table->dropIndex(['buyer_id']);
            $table->dropIndex(['category_id']);
            $table->dropIndex(['season_id']);
            $table->dropIndex(['color_id']);
            $table->dropIndex(['is_active']);
            $table->dropIndex(['updated_by']);

            // Drop columns
            $table->dropColumn([
                'buyer_id',
                'category_id',
                'season_id',
                'color_id',
                'msrp',
                'price_1',
                'price_2',
                'price_3',
                'price_4',
                'price_5',
                'is_active',
                'updated_by',
            ]);
        });
    }
};
