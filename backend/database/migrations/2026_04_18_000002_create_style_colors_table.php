<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('style_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->foreignId('color_id')->nullable()->constrained('colors')->nullOnDelete();
            $table->string('color_name')->nullable()->comment('Free-text colour name as it appeared on the PDF');
            $table->string('color_code', 50)->nullable()->comment('Optional supplier color code (e.g. "001")');
            $table->boolean('is_primary')->default(false)->comment('True for the colour mirrored onto styles.color_name');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['style_id', 'display_order']);
            $table->unique(['style_id', 'color_name'], 'style_colors_style_id_color_name_unique');
        });

        // Backfill: copy existing single-color values from styles into style_colors
        // so the new relation is populated for historical records.
        $styles = DB::table('styles')
            ->select('id', 'color_id', 'color_name', 'color', 'color_code', 'created_at', 'updated_at')
            ->get();

        $now = now();
        foreach ($styles as $style) {
            $name = $style->color_name ?: $style->color;
            if ($name === null && $style->color_id === null) {
                continue;
            }

            DB::table('style_colors')->insert([
                'style_id' => $style->id,
                'color_id' => $style->color_id,
                'color_name' => $name,
                'color_code' => $style->color_code,
                'is_primary' => true,
                'display_order' => 0,
                'created_at' => $style->created_at ?? $now,
                'updated_at' => $style->updated_at ?? $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('style_colors');
    }
};
