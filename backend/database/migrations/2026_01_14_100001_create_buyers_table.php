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
        Schema::create('buyers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('Buyer name (e.g., Rebel Minds, R3bel Denim)');
            $table->string('code', 50)->unique()->comment('Unique buyer code');
            $table->text('description')->nullable()->comment('Additional buyer details');
            $table->boolean('is_active')->default(true)->comment('Whether this buyer is active');
            $table->integer('display_order')->default(0)->comment('Order for displaying in lists');
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
        Schema::dropIfExists('buyers');
    }
};
