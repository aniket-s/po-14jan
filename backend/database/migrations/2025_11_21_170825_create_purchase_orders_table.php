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
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 100)->unique();
            $table->foreignId('importer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('agency_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->date('po_date');
            $table->string('retailer');
            $table->string('currency', 10)->default('USD');
            $table->decimal('exchange_rate', 10, 4)->default(1.0000);
            $table->string('status', 50)->default('draft');
            $table->text('terms_of_delivery')->nullable();
            $table->string('destination_country', 100)->nullable();
            $table->text('payment_terms')->nullable();
            $table->text('additional_notes')->nullable();
            $table->integer('total_styles')->default(0);
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_value', 15, 2)->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('importer_id');
            $table->index('agency_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
