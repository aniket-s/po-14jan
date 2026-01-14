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
        Schema::create('trims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->onDelete('cascade');
            $table->enum('trim_type', [
                'main_label',
                'size_label',
                'tag_1',
                'tag_2',
                'wash_care_label',
                'special_label',
                'special_tag',
                'price_ticket'
            ]);
            $table->string('trim_code');
            $table->string('image_path')->nullable()->comment('Uploaded picture of the trim');
            $table->string('file_path')->nullable()->comment('Uploaded trim file/document');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index(['brand_id', 'trim_type']);
            $table->index('trim_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trims');
    }
};
