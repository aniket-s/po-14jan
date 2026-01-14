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
        Schema::create('prepack_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique(); // A, B, C, D, etc.
            $table->string('name', 100); // Standard Pack A, Large Pack B
            $table->string('size_range', 50); // S-XL, M-3XL, XS-2XL
            $table->string('ratio', 50); // 2-2-1-1, 1-2-2-1, 1-2-1-1-1-1
            $table->json('sizes'); // {S: 2, M: 2, L: 1, XL: 1} or {M: 1, L: 2, XL: 1, XXL: 1, XXXL: 1, 3XL: 1}
            $table->integer('total_pieces_per_pack'); // Sum of ratio (6, 6, 6)
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('prepack_codes');
    }
};
