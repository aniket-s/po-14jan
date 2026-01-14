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
        Schema::table('styles', function (Blueprint $table) {
            // Change technical_file_path from string to JSON to support multiple files
            $table->json('technical_file_paths')->nullable()->after('technical_file_path');
        });

        // Migrate existing data
        DB::statement("UPDATE styles SET technical_file_paths = JSON_ARRAY(technical_file_path) WHERE technical_file_path IS NOT NULL");

        Schema::table('styles', function (Blueprint $table) {
            // Drop old column
            $table->dropColumn('technical_file_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Restore old column
            $table->string('technical_file_path')->nullable();
        });

        // Migrate data back (take first file from array)
        DB::statement("UPDATE styles SET technical_file_path = JSON_UNQUOTE(JSON_EXTRACT(technical_file_paths, '$[0]')) WHERE technical_file_paths IS NOT NULL");

        Schema::table('styles', function (Blueprint $table) {
            $table->dropColumn('technical_file_paths');
        });
    }
};
