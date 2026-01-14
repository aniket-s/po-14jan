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
        Schema::table('shipments', function (Blueprint $table) {
            // Add new date columns that align with the Shipment model
            $table->date('estimated_dispatch_date')->nullable()->after('status');
            $table->date('actual_dispatch_date')->nullable()->after('estimated_dispatch_date');
            $table->date('estimated_arrival_date')->nullable()->after('actual_dispatch_date');
            $table->date('actual_arrival_date')->nullable()->after('estimated_arrival_date');
            $table->date('estimated_delivery_date')->nullable()->after('actual_arrival_date');
            $table->date('actual_delivery_date')->nullable()->after('estimated_delivery_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'estimated_dispatch_date',
                'actual_dispatch_date',
                'estimated_arrival_date',
                'actual_arrival_date',
                'estimated_delivery_date',
                'actual_delivery_date',
            ]);
        });
    }
};
