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
        Schema::create('system_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50)->index(); // 'po_status', 'sample_status', 'production_status', etc.
            $table->string('value', 50); // 'draft', 'active', 'completed', etc.
            $table->string('label', 100); // Display name
            $table->string('color', 20)->nullable(); // Hex color code
            $table->string('icon', 50)->nullable(); // Icon name
            $table->integer('display_order')->default(0);
            $table->json('transition_rules')->nullable(); // Valid next statuses
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Unique constraint on type + value
            $table->unique(['type', 'value']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_statuses');
    }
};
