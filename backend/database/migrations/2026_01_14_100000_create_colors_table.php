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
        Schema::create('colors', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('Color name (e.g., Black, White, Navy)');
            $table->string('code', 50)->unique()->comment('Unique color code');
            $table->string('pantone_code', 50)->nullable()->comment('Pantone/PTI reference code');
            $table->json('fabric_types')->nullable()->comment('Array of fabric types this color applies to');
            $table->boolean('is_active')->default(true)->comment('Whether this color is active');
            $table->integer('display_order')->default(0)->comment('Order for displaying in lists');
            $table->text('description')->nullable()->comment('Additional color details');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('is_active');
            $table->index('display_order');
            $table->index('created_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('colors');
    }
};
