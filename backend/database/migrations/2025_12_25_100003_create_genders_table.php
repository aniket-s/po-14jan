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
        Schema::create('genders', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique(); // Men, Women, Boys, Girls, Unisex
            $table->string('code', 20)->unique(); // MEN, WOMEN, BOYS, GIRLS, UNISEX
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
            $table->index('display_order');
        });

        // Seed default genders
        DB::table('genders')->insert([
            ['name' => 'Men', 'code' => 'MEN', 'description' => 'Men\'s clothing', 'is_active' => true, 'display_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Women', 'code' => 'WOMEN', 'description' => 'Women\'s clothing', 'is_active' => true, 'display_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Boys', 'code' => 'BOYS', 'description' => 'Boys\' clothing', 'is_active' => true, 'display_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Girls', 'code' => 'GIRLS', 'description' => 'Girls\' clothing', 'is_active' => true, 'display_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Unisex', 'code' => 'UNISEX', 'description' => 'Unisex clothing', 'is_active' => true, 'display_order' => 5, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('genders');
    }
};
