<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Changes:
     * 1. Remove buyer_id foreign key and add retailer_id
     * 2. Add fabric_type_id and fabric_quality_id foreign keys
     * 3. Remove is_active column (no longer needed in UI)
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Add new foreign keys
            $table->foreignId('retailer_id')->nullable()->after('brand_id')->constrained('retailers')->nullOnDelete();
            $table->foreignId('fabric_type_id')->nullable()->after('fabric_type_name')->constrained('fabric_types')->nullOnDelete();
            $table->foreignId('fabric_quality_id')->nullable()->after('fabric_type_id')->constrained('fabric_qualities')->nullOnDelete();
        });

        // Migrate buyer_id data to retailer_id if possible (matching by name)
        // This is optional - you may want to manually map buyer to retailer
        // For now, we'll leave retailer_id null and let users update

        Schema::table('styles', function (Blueprint $table) {
            // Remove buyer_id foreign key constraint if exists
            // Note: This might fail if the constraint doesn't exist
            try {
                $table->dropForeign(['buyer_id']);
            } catch (\Exception $e) {
                // Constraint might not exist
            }

            // Remove buyer_id column
            if (Schema::hasColumn('styles', 'buyer_id')) {
                $table->dropColumn('buyer_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Add back buyer_id
            $table->foreignId('buyer_id')->nullable()->after('brand_id')->constrained('buyers')->nullOnDelete();

            // Remove new columns
            $table->dropForeign(['retailer_id']);
            $table->dropColumn('retailer_id');

            $table->dropForeign(['fabric_type_id']);
            $table->dropColumn('fabric_type_id');

            $table->dropForeign(['fabric_quality_id']);
            $table->dropColumn('fabric_quality_id');
        });
    }
};
