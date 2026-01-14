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
        Schema::create('defect_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique(); // 'critical', 'major', 'minor'
            $table->string('severity', 20); // 'critical', 'major', 'minor'
            $table->text('description')->nullable();
            $table->text('examples')->nullable();
            $table->boolean('auto_fail')->default(false); // If true, any defect = fail
            $table->string('color', 20)->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('defect_categories');
    }
};
