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
            // Add technical file path for tech pack uploads
            $table->string('technical_file_path')->nullable()->after('images');

            // Make fields nullable for standalone styles (not attached to PO yet)
            $table->string('color', 100)->nullable()->change();
            $table->json('size_breakup')->nullable()->change();
            $table->decimal('fob_price', 10, 2)->nullable()->change();
            $table->date('ex_factory_date')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropColumn('technical_file_path');

            // Note: Not reverting nullable changes as it would break standalone styles
            // If you need to revert, manually change these fields back to required:
            // - color, size_breakup, fob_price, ex_factory_date
        });
    }
};
