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
        Schema::create('trim_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 50)->unique();
            $table->text('description')->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        // Seed default trim types
        $trimTypes = [
            ['code' => 'main_label', 'name' => 'Main Label', 'display_order' => 1],
            ['code' => 'size_label', 'name' => 'Size Label', 'display_order' => 2],
            ['code' => 'tag_1', 'name' => 'Tag 1', 'display_order' => 3],
            ['code' => 'tag_2', 'name' => 'Tag 2', 'display_order' => 4],
            ['code' => 'wash_care_label', 'name' => 'Wash Care Label', 'display_order' => 5],
            ['code' => 'special_label', 'name' => 'Special Label', 'display_order' => 6],
            ['code' => 'special_tag', 'name' => 'Special Tag', 'display_order' => 7],
            ['code' => 'price_ticket', 'name' => 'Price Ticket', 'display_order' => 8],
            ['code' => 'hangtag', 'name' => 'Hangtag', 'display_order' => 9],
            ['code' => 'button', 'name' => 'Button', 'display_order' => 10],
            ['code' => 'zipper', 'name' => 'Zipper', 'display_order' => 11],
            ['code' => 'thread', 'name' => 'Thread', 'display_order' => 12],
        ];

        foreach ($trimTypes as $type) {
            \DB::table('trim_types')->insert(array_merge($type, [
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trim_types');
    }
};
