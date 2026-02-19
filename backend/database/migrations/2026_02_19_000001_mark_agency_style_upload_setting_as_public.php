<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('key', 'agency_style_upload_enabled')
            ->update(['is_public' => true]);
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'agency_style_upload_enabled')
            ->update(['is_public' => false]);
    }
};
