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
        Schema::create('styles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->string('style_number', 100);
            $table->string('color', 100);
            $table->text('description')->nullable();
            $table->string('fabric')->nullable();
            $table->string('fit', 100)->nullable();
            $table->json('size_breakup'); // {S: 100, M: 200, L: 150}
            $table->integer('total_quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('fob_price', 10, 2);
            $table->date('ex_factory_date');
            $table->string('destination_port')->nullable();
            $table->json('images')->nullable(); // Array of image URLs
            $table->json('packing_details')->nullable();
            $table->enum('assignment_type', ['via_agency', 'direct_to_factory'])->nullable();
            $table->foreignId('assigned_agency_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_factory_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 50)->default('pending');
            $table->timestamps();
            $table->softDeletes();

            $table->index('po_id');
            $table->index('assigned_factory_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('styles');
    }
};
