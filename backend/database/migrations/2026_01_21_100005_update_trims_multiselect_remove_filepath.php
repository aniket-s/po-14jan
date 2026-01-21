<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Changes:
     * 1. Change trim_type from string to JSON (for multiple selection)
     * 2. Remove file_path column (specification document)
     * 3. Update image_path accept types (now accepts PDF, AI, images)
     */
    public function up(): void
    {
        Schema::table('trims', function (Blueprint $table) {
            // Rename old trim_type to keep data
            $table->renameColumn('trim_type', 'trim_type_old');
        });

        Schema::table('trims', function (Blueprint $table) {
            // Add new JSON column for multiple trim types
            $table->json('trim_types')->nullable()->after('brand_id');
        });

        // Migrate existing data
        $trims = \DB::table('trims')->get();
        foreach ($trims as $trim) {
            if ($trim->trim_type_old) {
                \DB::table('trims')
                    ->where('id', $trim->id)
                    ->update([
                        'trim_types' => json_encode([$trim->trim_type_old])
                    ]);
            }
        }

        Schema::table('trims', function (Blueprint $table) {
            // Drop old column and file_path
            $table->dropColumn('trim_type_old');
            $table->dropColumn('file_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trims', function (Blueprint $table) {
            // Add back original columns
            $table->string('trim_type', 50)->nullable();
            $table->string('file_path')->nullable();
        });

        // Migrate data back (take first type)
        $trims = \DB::table('trims')->get();
        foreach ($trims as $trim) {
            if ($trim->trim_types) {
                $types = json_decode($trim->trim_types, true);
                \DB::table('trims')
                    ->where('id', $trim->id)
                    ->update([
                        'trim_type' => $types[0] ?? null
                    ]);
            }
        }

        Schema::table('trims', function (Blueprint $table) {
            $table->dropColumn('trim_types');
        });
    }
};
