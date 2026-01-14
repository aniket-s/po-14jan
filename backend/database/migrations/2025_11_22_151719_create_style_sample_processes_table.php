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
        Schema::create('style_sample_processes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('sample_type_id')->constrained('sample_types')->cascadeOnDelete();
            $table->integer('priority')->default(0); // Lower number = higher priority
            $table->boolean('is_required')->default(true);
            $table->enum('status', ['pending', 'in_progress', 'approved', 'rejected', 'skipped'])->default('pending');
            $table->timestamps();

            // Ensure unique combination of style and sample type
            $table->unique(['style_id', 'sample_type_id']);

            // Index for quick lookups
            $table->index(['style_id', 'priority']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('style_sample_processes');
    }
};
