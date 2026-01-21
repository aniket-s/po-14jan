<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Creates payment_terms master data table for dynamic payment term selection.
     */
    public function up(): void
    {
        Schema::create('payment_terms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100); // Display name, e.g., "NET 30"
            $table->string('code', 50)->unique(); // Code for storage, e.g., "NET30"
            $table->integer('days')->nullable(); // Days for NET terms (30, 60, 90)
            $table->boolean('requires_percentage')->default(false); // True for ADVANCE payments
            $table->text('description')->nullable(); // Optional description
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Add payment_term_id foreign key to purchase_orders table
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('payment_term_id')->nullable()->after('payment_terms_structured')->constrained('payment_terms')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['payment_term_id']);
            $table->dropColumn('payment_term_id');
        });

        Schema::dropIfExists('payment_terms');
    }
};
