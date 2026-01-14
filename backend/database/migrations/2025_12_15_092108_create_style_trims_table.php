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
        Schema::create('style_trims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained()->onDelete('cascade');
            $table->foreignId('trim_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->nullable()->comment('Quantity of this trim per style unit');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Unique constraint: a style can't have the same trim twice
            $table->unique(['style_id', 'trim_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('style_trims');
    }
};
