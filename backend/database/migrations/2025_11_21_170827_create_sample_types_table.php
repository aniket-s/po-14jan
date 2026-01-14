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
        Schema::create('sample_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique(); // 'lab_dip', 'fit_sample', etc.
            $table->string('display_name', 100);
            $table->text('description')->nullable();
            $table->json('prerequisites')->nullable(); // Array of sample_type names that must be approved first
            $table->boolean('required_for_production')->default(true);
            $table->boolean('parallel_submission_allowed')->default(true);
            $table->integer('typical_days')->default(7);
            $table->integer('display_order')->default(0);
            $table->integer('max_images')->default(10);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sample_types');
    }
};
