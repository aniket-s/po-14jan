<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('system_settings', function (Blueprint $table) {
            $table->string('label')->nullable()->after('key');
            $table->text('options')->nullable()->after('type');
            $table->string('validation_rules')->nullable()->after('options');
            $table->integer('display_order')->default(0)->after('validation_rules');
        });

        // Update existing records to generate labels from keys
        $settings = DB::table('system_settings')->get();
        foreach ($settings as $setting) {
            $label = ucwords(str_replace('_', ' ', $setting->key));
            DB::table('system_settings')
                ->where('id', $setting->id)
                ->update(['label' => $label]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('system_settings', function (Blueprint $table) {
            $table->dropColumn(['label', 'options', 'validation_rules', 'display_order']);
        });
    }
};
