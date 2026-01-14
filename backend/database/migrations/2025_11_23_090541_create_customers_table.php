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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150); // RM Stock, Citi Trends, Burlington
            $table->string('code', 50)->unique(); // RMSTK, CITI, BURL
            $table->json('contact_info')->nullable(); // {email, phone, contact_person}
            $table->text('billing_address')->nullable();
            $table->text('shipping_address')->nullable();
            $table->string('payment_terms', 100)->nullable(); // Net 30, Net 60, etc.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
