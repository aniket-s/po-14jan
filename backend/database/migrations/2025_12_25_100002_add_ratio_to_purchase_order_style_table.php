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
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->json('ratio')->nullable()->after('size_breakdown')->comment('Size ratio for this style in PO');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->dropColumn('ratio');
        });
    }
};
