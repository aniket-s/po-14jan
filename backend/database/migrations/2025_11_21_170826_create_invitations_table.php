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
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50); // 'importer_to_agency', 'factory_assignment', 'agency_to_importer'
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('to_email');
            $table->string('token', 100)->unique();
            $table->timestamp('expires_at');
            $table->string('status', 50)->default('pending'); // pending, accepted, rejected, expired
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('responded_at')->nullable();
            $table->json('data')->nullable(); // PO IDs, style IDs, message, etc.
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('token');
            $table->index('status');
            $table->index('to_email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
