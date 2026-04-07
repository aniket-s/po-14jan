<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Make the legacy retailer string column nullable.
     * POs now use retailer_id (FK) instead, but the old column still exists.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('retailer')->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('retailer')->nullable(false)->default(null)->change();
        });
    }
};
