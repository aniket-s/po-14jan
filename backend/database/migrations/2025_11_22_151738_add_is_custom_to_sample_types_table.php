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
        Schema::table('sample_types', function (Blueprint $table) {
            $table->boolean('is_custom')->default(false)->after('is_active');
            $table->foreignId('created_by')->nullable()->after('is_custom')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sample_types', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn(['is_custom', 'created_by']);
        });
    }
};
