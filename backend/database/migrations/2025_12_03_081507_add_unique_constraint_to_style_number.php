<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Makes style_number unique globally.
     * Handles duplicates by appending -PO{id} suffix to make them unique.
     */
    public function up(): void
    {
        // Find duplicate style_numbers
        $duplicates = DB::select("
            SELECT style_number, COUNT(*) as count
            FROM styles
            GROUP BY style_number
            HAVING count > 1
        ");

        $renamedCount = 0;

        // Rename duplicates by appending -PO{id} suffix
        foreach ($duplicates as $duplicate) {
            $styles = DB::table('styles')
                ->where('style_number', $duplicate->style_number)
                ->orderBy('id')
                ->get();

            // Keep first occurrence as-is, rename the rest
            foreach ($styles->skip(1) as $style) {
                $newStyleNumber = $style->style_number . '-PO' . $style->po_id;

                DB::table('styles')
                    ->where('id', $style->id)
                    ->update(['style_number' => $newStyleNumber]);

                $renamedCount++;
            }
        }

        if ($renamedCount > 0) {
            echo "\n✓ Renamed {$renamedCount} duplicate style numbers to make them unique\n";
        } else {
            echo "\n✓ No duplicate style numbers found\n";
        }

        // Now add unique constraint
        Schema::table('styles', function (Blueprint $table) {
            $table->unique('style_number', 'unique_style_number');
        });

        echo "✓ Added unique constraint to style_number\n";
    }

    /**
     * Reverse the migrations.
     *
     * Removes the unique constraint from style_number.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropUnique('unique_style_number');
        });

        echo "\n✓ Removed unique constraint from style_number\n";
    }
};
