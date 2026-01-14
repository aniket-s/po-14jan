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
        Schema::create('production_stages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique(); // 'sampling', 'cutting', etc.
            $table->string('display_name', 100);
            $table->integer('weight_percentage'); // Must total 100% across all active stages
            $table->integer('typical_days')->default(5);
            $table->integer('display_order');
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable(); // Hex color for UI
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_stages');
    }
};
