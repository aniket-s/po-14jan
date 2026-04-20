<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buy_sheets', function (Blueprint $table) {
            $table->id();
            $table->string('buy_sheet_number', 50);
            $table->foreignId('buyer_id')->constrained('buyers')->cascadeOnDelete();
            $table->foreignId('retailer_id')->nullable()->constrained('retailers')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->constrained('seasons')->nullOnDelete();
            $table->string('name')->nullable();
            $table->date('date_submitted')->nullable();
            $table->enum('status', ['open', 'po_issued', 'closed', 'cancelled'])->default('open');
            $table->unsignedInteger('total_styles')->default(0);
            $table->unsignedInteger('total_quantity')->default(0);
            $table->decimal('total_value', 14, 2)->default(0);
            $table->boolean('tickets_required')->nullable();
            $table->boolean('buyer_approvals_required')->nullable();
            $table->string('source_file_path')->nullable();
            $table->string('strategy_key', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['buyer_id', 'buy_sheet_number'], 'buy_sheets_buyer_number_unique');
            $table->index('status');
        });

        Schema::create('buy_sheet_style', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buy_sheet_id')->constrained('buy_sheets')->cascadeOnDelete();
            $table->foreignId('style_id')->constrained('styles')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->json('size_breakdown')->nullable();
            $table->string('packing')->nullable();
            $table->string('label')->nullable();
            $table->string('ihd', 50)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['buy_sheet_id', 'style_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('buy_sheet_style');
        Schema::dropIfExists('buy_sheets');
    }
};
