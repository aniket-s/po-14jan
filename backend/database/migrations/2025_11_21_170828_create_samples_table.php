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
        Schema::create('samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('sample_type_id')->constrained('sample_types')->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->integer('version')->default(1);
            $table->string('status', 50)->default('submitted'); // submitted, approved_by_agency, rejected_by_agency, approved_by_importer, rejected_by_importer
            $table->json('images'); // Array of image URLs
            $table->text('submission_notes')->nullable();
            $table->string('courier_tracking')->nullable();
            $table->foreignId('agency_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('agency_reviewed_at')->nullable();
            $table->text('agency_feedback')->nullable();
            $table->foreignId('importer_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('importer_reviewed_at')->nullable();
            $table->text('importer_feedback')->nullable();
            $table->boolean('auto_approved')->default(false);
            $table->timestamps();

            $table->index('style_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('samples');
    }
};
