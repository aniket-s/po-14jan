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
        Schema::create('production_trackings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('production_stage_id')->constrained('production_stages')->cascadeOnDelete();
            $table->date('tracking_date');
            $table->integer('quantity_produced')->default(0);
            $table->integer('quantity_rejected')->default(0);
            $table->integer('quantity_reworked')->default(0);
            $table->integer('cumulative_quantity')->default(0);
            $table->decimal('completion_percentage', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->json('images')->nullable();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Indexes for better query performance
            $table->index('style_id');
            $table->index('production_stage_id');
            $table->index('tracking_date');
            $table->index('submitted_by');

            // Unique constraint to prevent duplicate entries for same style/stage/date
            $table->unique(['style_id', 'production_stage_id', 'tracking_date'], 'prod_track_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_trackings');
    }
};
