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
        Schema::create('quality_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('inspector_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('aql_level_id')->constrained('aql_levels')->cascadeOnDelete();
            $table->string('inspection_number', 100)->unique();
            $table->integer('lot_size');
            $table->integer('sample_size');
            $table->integer('accept_point');
            $table->integer('reject_point');
            $table->integer('critical_defects')->default(0);
            $table->integer('major_defects')->default(0);
            $table->integer('minor_defects')->default(0);
            $table->json('defect_details')->nullable(); // Array of {category, description, quantity, images}
            $table->json('measurements')->nullable(); // Actual vs spec measurements
            $table->json('images')->nullable(); // Inspection photos
            $table->string('result', 20); // 'passed', 'failed'
            $table->text('inspector_notes')->nullable();
            $table->string('certificate_number')->nullable()->unique();
            $table->string('certificate_path')->nullable(); // PDF path
            $table->timestamp('inspected_at');
            $table->timestamps();

            $table->index('style_id');
            $table->index('result');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quality_inspections');
    }
};
