<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ship_options', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->integer('month');
            $table->integer('year');
            $table->date('etd');
            $table->date('eta');
            $table->date('cutoff_date');
            $table->string('vessel_name', 150)->nullable();
            $table->string('port_of_loading', 150)->nullable();
            $table->string('port_of_discharge', 150)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['month', 'year']);
            $table->index('etd');
            $table->index('cutoff_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ship_options');
    }
};
