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
        Schema::create('purchase_order_style', function (Blueprint $table) {
            $table->id();

            // Foreign keys
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();

            // PO-specific overrides
            $table->integer('quantity_in_po'); // Quantity for THIS specific PO
            $table->decimal('unit_price_in_po', 10, 2)->nullable(); // Override style's base price (optional)

            // PO-specific factory assignment
            $table->foreignId('assigned_factory_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_agency_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('assignment_type', ['via_agency', 'direct_to_factory'])->nullable();
            $table->datetime('assigned_at')->nullable();

            // PO-specific dates
            $table->date('target_production_date')->nullable();
            $table->date('target_shipment_date')->nullable();
            $table->date('ex_factory_date')->nullable();

            // PO-specific status
            $table->string('status', 50)->default('pending');
            $table->text('notes')->nullable();

            $table->timestamps();

            // Unique constraint: a style can only be added once to a PO
            $table->unique(['purchase_order_id', 'style_id'], 'unique_po_style');

            // Indexes for performance
            $table->index('purchase_order_id', 'idx_po');
            $table->index('style_id', 'idx_style');
            $table->index('assigned_factory_id', 'idx_factory');
            $table->index('status', 'idx_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_order_style');
    }
};
