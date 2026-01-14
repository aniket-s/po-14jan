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
        Schema::create('style_prepacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('prepack_code_id')->constrained('prepack_codes')->cascadeOnDelete();
            $table->integer('quantity'); // Number of prepacks (e.g., 100 packs)
            $table->integer('total_pieces'); // Auto-calculated: quantity * total_pieces_per_pack
            $table->json('piece_breakdown'); // {S: 200, M: 200, L: 100, XL: 100}
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('style_id');
            $table->index('prepack_code_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('style_prepacks');
    }
};
