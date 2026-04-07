<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Remove the global unique constraint on style_number.
     * The same style number can exist with different colors (e.g., SAT301SBCX in BLACK, WHITE, etc.)
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropUnique('unique_style_number');
        });
    }

    /**
     * Restore the unique constraint on style_number.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->unique('style_number', 'unique_style_number');
        });
    }
};
