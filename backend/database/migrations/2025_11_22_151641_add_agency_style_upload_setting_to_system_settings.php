<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('system_settings')->insert([
            'key' => 'agency_style_upload_enabled',
            'value' => 'true',
            'type' => 'boolean',
            'group' => 'po',
            'description' => 'Allow agencies to upload/create styles',
            'is_public' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'agency_style_upload_enabled')
            ->delete();
    }
};
