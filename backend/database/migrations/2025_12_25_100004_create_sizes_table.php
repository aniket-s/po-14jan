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
        Schema::create('sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gender_id')->constrained('genders')->cascadeOnDelete();
            $table->string('size_code', 20); // XS, S, M, L, XL, 2XL, etc.
            $table->string('size_name', 50); // Extra Small, Small, Medium, etc.
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['gender_id', 'size_code']);
            $table->index('is_active');
            $table->index('display_order');
        });

        // Seed default sizes for each gender
        $genders = DB::table('genders')->pluck('id', 'code');

        $sizes = [
            ['code' => 'XS', 'name' => 'Extra Small', 'order' => 1],
            ['code' => 'S', 'name' => 'Small', 'order' => 2],
            ['code' => 'M', 'name' => 'Medium', 'order' => 3],
            ['code' => 'L', 'name' => 'Large', 'order' => 4],
            ['code' => 'XL', 'name' => 'Extra Large', 'order' => 5],
            ['code' => '2XL', 'name' => '2X Large', 'order' => 6],
            ['code' => '3XL', 'name' => '3X Large', 'order' => 7],
            ['code' => '4XL', 'name' => '4X Large', 'order' => 8],
            ['code' => '5XL', 'name' => '5X Large', 'order' => 9],
            ['code' => '6XL', 'name' => '6X Large', 'order' => 10],
        ];

        foreach ($genders as $code => $genderId) {
            foreach ($sizes as $size) {
                DB::table('sizes')->insert([
                    'gender_id' => $genderId,
                    'size_code' => $size['code'],
                    'size_name' => $size['name'],
                    'description' => "{$size['name']} for {$code}",
                    'is_active' => true,
                    'display_order' => $size['order'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sizes');
    }
};
