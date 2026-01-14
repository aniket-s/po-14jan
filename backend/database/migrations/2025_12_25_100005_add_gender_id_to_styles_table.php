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
            $table->foreignId('gender_id')->nullable()->after('brand_id')->constrained('genders')->nullOnDelete();
            $table->index('gender_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropForeign(['gender_id']);
            $table->dropIndex(['gender_id']);
            $table->dropColumn('gender_id');
        });
    }
};
