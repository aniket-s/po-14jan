<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->date('estimated_ex_factory_date')->nullable()->after('ex_factory_date');
            $table->string('production_status', 30)->default('pending')->after('status');
            $table->string('shipping_approval_status', 30)->default('pending')->after('production_status');
            $table->timestamp('shipping_approval_requested_at')->nullable();
            $table->unsignedBigInteger('shipping_approval_requested_by')->nullable();
            $table->unsignedBigInteger('shipping_approval_agency_by')->nullable();
            $table->timestamp('shipping_approval_agency_at')->nullable();
            $table->unsignedBigInteger('shipping_approval_importer_by')->nullable();
            $table->timestamp('shipping_approval_importer_at')->nullable();
            $table->text('shipping_approval_notes')->nullable();
            $table->string('shipping_approval_rejection_reason', 500)->nullable();
            $table->unsignedBigInteger('suggested_ship_option_id')->nullable();

            $table->foreign('shipping_approval_requested_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('shipping_approval_agency_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('shipping_approval_importer_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_style', function (Blueprint $table) {
            $table->dropForeign(['shipping_approval_requested_by']);
            $table->dropForeign(['shipping_approval_agency_by']);
            $table->dropForeign(['shipping_approval_importer_by']);

            $table->dropColumn([
                'estimated_ex_factory_date',
                'production_status',
                'shipping_approval_status',
                'shipping_approval_requested_at',
                'shipping_approval_requested_by',
                'shipping_approval_agency_by',
                'shipping_approval_agency_at',
                'shipping_approval_importer_by',
                'shipping_approval_importer_at',
                'shipping_approval_notes',
                'shipping_approval_rejection_reason',
                'suggested_ship_option_id',
            ]);
        });
    }
};
