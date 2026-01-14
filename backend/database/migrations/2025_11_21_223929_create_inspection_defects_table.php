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
        Schema::create('inspection_defects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quality_inspection_id')->constrained()->onDelete('cascade');
            $table->foreignId('defect_type_id')->constrained('defect_categories')->onDelete('cascade');
            $table->integer('quantity');
            $table->text('description')->nullable();
            $table->string('location')->nullable()->comment('e.g., Front pocket, Collar, Sleeve');
            $table->json('images')->nullable();
            $table->string('severity')->nullable()->comment('Denormalized from defect_type for quick access');
            $table->timestamps();

            $table->index(['quality_inspection_id', 'severity']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inspection_defects');
    }
};
