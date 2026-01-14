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
        Schema::create('po_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('po_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->integer('revision_number');
            $table->foreignId('revised_by')->constrained('users')->cascadeOnDelete();
            $table->json('changes'); // {field: {old: value, new: value}}
            $table->text('reason')->nullable();
            $table->json('notified_parties')->nullable(); // [user_ids]
            $table->timestamp('revised_at');
            $table->timestamps();

            $table->index('po_id');
            $table->index('revised_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('po_revisions');
    }
};
