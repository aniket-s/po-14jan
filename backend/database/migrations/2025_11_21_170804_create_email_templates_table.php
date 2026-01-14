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
        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique(); // Template slug like 'sample_submitted'
            $table->string('display_name')->nullable();
            $table->string('type', 50)->nullable(); // Category: sample, production, etc.
            $table->text('subject'); // Subject line with {{variables}}
            $table->longText('body_html'); // HTML body with {{variables}}
            $table->json('available_variables')->nullable(); // List of available variables
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_templates');
    }
};
