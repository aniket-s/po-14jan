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
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->string('shipment_number', 100)->unique();
            $table->string('tracking_number')->nullable();
            $table->json('style_ids'); // Array of style IDs in this shipment
            $table->foreignId('factory_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('invoice_number');
            $table->integer('carton_count');
            $table->decimal('total_weight', 10, 2);
            $table->decimal('total_cbm', 10, 2)->nullable();
            $table->enum('shipping_mode', ['sea', 'air', 'road', 'courier']);
            $table->json('shipping_details')->nullable(); // Mode-specific: vessel, container, flight, truck, etc.
            $table->date('etd')->nullable(); // Estimated Time of Departure
            $table->date('eta')->nullable(); // Estimated Time of Arrival
            $table->date('actual_departure')->nullable();
            $table->date('actual_arrival')->nullable();
            $table->string('origin_port')->nullable();
            $table->string('destination_port')->nullable();
            $table->string('status', 50)->default('preparing'); // preparing, dispatched, in_transit, arrived, delivered
            $table->json('documents')->nullable(); // Invoice, packing list, BOL, etc. {type, path}
            $table->json('status_history')->nullable(); // Timeline of status changes
            $table->timestamps();

            $table->index('shipment_number');
            $table->index('tracking_number');
            $table->index('factory_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
