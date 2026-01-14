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
        Schema::create('aql_levels', function (Blueprint $table) {
            $table->id();
            $table->string('level', 20)->unique(); // '1.0', '2.5', '4.0'
            $table->string('name', 100); // 'Luxury', 'Standard', 'Basic'
            $table->text('description')->nullable();
            $table->json('sample_size_table'); // {lot_size_min, lot_size_max, sample_size, accept_point, reject_point}
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('aql_levels');
    }
};
