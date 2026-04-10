<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->foreignId('assigned_importer_id')->nullable()->after('assigned_agency_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_importer_id');
        });
    }
};
