<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add fabric_type_name field to styles table
     * This replaces the separate 'fabric' and 'fabric_name' fields with a single combined field
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->string('fabric_type_name', 255)->nullable()->after('fabric_name')->comment('Combined fabric type and name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->dropColumn('fabric_type_name');
        });
    }
};
