<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // New master data relationships
            if (!Schema::hasColumn('styles', 'buyer_id')) {
                $table->foreignId('buyer_id')->nullable()->after('brand_id')->constrained('buyers')->nullOnDelete();
            }
            if (!Schema::hasColumn('styles', 'category_id')) {
                $table->foreignId('category_id')->nullable()->after('buyer_id')->constrained('categories')->nullOnDelete();
            }
            // Note: season_id already exists from 2025_11_23_090911_add_master_data_fields_to_styles_table.php
            if (!Schema::hasColumn('styles', 'color_id')) {
                $table->foreignId('color_id')->nullable()->after('color')->constrained('colors')->nullOnDelete();
            }

            // Pricing fields
            if (!Schema::hasColumn('styles', 'msrp')) {
                $table->decimal('msrp', 10, 2)->nullable()->after('fob_price')->comment('Manufacturer Suggested Retail Price');
            }
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

            // Status and audit fields
            if (!Schema::hasColumn('styles', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('status')->comment('Whether this style is active');
            }
            if (!Schema::hasColumn('styles', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('is_active')->constrained('users')->nullOnDelete();
            }
        });

        // Add indexes in a separate Schema::table call to avoid issues
        // Use raw SQL to check for index existence since Doctrine DBAL is removed in Laravel 12
        Schema::table('styles', function (Blueprint $table) {
            $connection = Schema::getConnection();
            $tableName = $connection->getTablePrefix() . 'styles';

            // Get existing indexes
            $indexes = $connection->select("SHOW INDEX FROM `{$tableName}`");
            $existingIndexes = array_column($indexes, 'Key_name');

            if (!in_array('styles_buyer_id_index', $existingIndexes)) {
                $table->index('buyer_id');
            }
            if (!in_array('styles_category_id_index', $existingIndexes)) {
                $table->index('category_id');
            }
            // Note: season_id index already exists from previous migration
            if (!in_array('styles_color_id_index', $existingIndexes)) {
                $table->index('color_id');
            }
            if (!in_array('styles_is_active_index', $existingIndexes)) {
                $table->index('is_active');
            }
            if (!in_array('styles_updated_by_index', $existingIndexes)) {
                $table->index('updated_by');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Drop foreign keys first (only if columns exist)
            if (Schema::hasColumn('styles', 'buyer_id')) {
                $table->dropForeign(['buyer_id']);
            }
            if (Schema::hasColumn('styles', 'category_id')) {
                $table->dropForeign(['category_id']);
            }
            // Note: season_id not dropped as it wasn't added by this migration
            if (Schema::hasColumn('styles', 'color_id')) {
                $table->dropForeign(['color_id']);
            }
            if (Schema::hasColumn('styles', 'updated_by')) {
                $table->dropForeign(['updated_by']);
            }
        });

        Schema::table('styles', function (Blueprint $table) {
            // Drop indexes using raw SQL check
            $connection = Schema::getConnection();
            $tableName = $connection->getTablePrefix() . 'styles';

            // Get existing indexes
            $indexes = $connection->select("SHOW INDEX FROM `{$tableName}`");
            $existingIndexes = array_column($indexes, 'Key_name');

            if (in_array('styles_buyer_id_index', $existingIndexes)) {
                $table->dropIndex(['buyer_id']);
            }
            if (in_array('styles_category_id_index', $existingIndexes)) {
                $table->dropIndex(['category_id']);
            }
            // Note: season_id index not dropped as it wasn't added by this migration
            if (in_array('styles_color_id_index', $existingIndexes)) {
                $table->dropIndex(['color_id']);
            }
            if (in_array('styles_is_active_index', $existingIndexes)) {
                $table->dropIndex(['is_active']);
            }
            if (in_array('styles_updated_by_index', $existingIndexes)) {
                $table->dropIndex(['updated_by']);
            }
        });

        Schema::table('styles', function (Blueprint $table) {
            // Drop columns (only if they exist)
            $columnsToDrop = [];

            if (Schema::hasColumn('styles', 'buyer_id')) {
                $columnsToDrop[] = 'buyer_id';
            }
            if (Schema::hasColumn('styles', 'category_id')) {
                $columnsToDrop[] = 'category_id';
            }
            // Note: season_id not dropped as it wasn't added by this migration
            if (Schema::hasColumn('styles', 'color_id')) {
                $columnsToDrop[] = 'color_id';
            }
            if (Schema::hasColumn('styles', 'msrp')) {
                $columnsToDrop[] = 'msrp';
            }
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
            if (Schema::hasColumn('styles', 'is_active')) {
                $columnsToDrop[] = 'is_active';
            }
            if (Schema::hasColumn('styles', 'updated_by')) {
                $columnsToDrop[] = 'updated_by';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
