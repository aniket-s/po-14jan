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
        $settings = [
            [
                'key' => 'email_from_address',
                'value' => 'noreply@garmentplatform.com',
                'type' => 'string',
                'group' => 'email',
                'description' => 'Default sender email address',
                'is_public' => false,
                'label' => 'Email From Address',
            ],
            [
                'key' => 'email_from_name',
                'value' => 'Garment Supply Chain Platform',
                'type' => 'string',
                'group' => 'email',
                'description' => 'Default sender name',
                'is_public' => false,
                'label' => 'Email From Name',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->insertOrIgnore(array_merge($setting, [
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
        DB::table('system_settings')->whereIn('key', ['email_from_address', 'email_from_name'])->delete();
    }
};
