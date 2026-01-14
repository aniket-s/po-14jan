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
        Schema::table('samples', function (Blueprint $table) {
            // Add missing fields for enhanced sample management
            $table->string('sample_reference', 100)->nullable()->after('sample_type_id');
            $table->date('submission_date')->nullable()->after('sample_reference');
            $table->integer('quantity')->nullable()->after('submission_date');
            $table->json('attachment_paths')->nullable()->after('images');
            $table->text('notes')->nullable()->after('attachment_paths');

            // Add factory approval fields
            $table->string('factory_status', 50)->default('pending')->after('notes');
            $table->foreignId('factory_approved_by')->nullable()->after('factory_status')->constrained('users')->nullOnDelete();
            $table->timestamp('factory_approved_at')->nullable()->after('factory_approved_by');
            $table->text('factory_rejection_reason')->nullable()->after('factory_approved_at');

            // Add importer approval fields
            $table->string('importer_status', 50)->default('pending')->after('factory_rejection_reason');
            $table->foreignId('importer_approved_by')->nullable()->after('importer_status')->constrained('users')->nullOnDelete();
            $table->timestamp('importer_approved_at')->nullable()->after('importer_approved_by');
            $table->text('importer_rejection_reason')->nullable()->after('importer_approved_at');

            // Add final status
            $table->string('final_status', 50)->default('pending')->after('importer_rejection_reason');

            // Add metadata for extensibility
            $table->json('metadata')->nullable()->after('final_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->dropColumn([
                'sample_reference',
                'submission_date',
                'quantity',
                'attachment_paths',
                'notes',
                'factory_status',
                'factory_approved_by',
                'factory_approved_at',
                'factory_rejection_reason',
                'importer_status',
                'importer_approved_by',
                'importer_approved_at',
                'importer_rejection_reason',
                'final_status',
                'metadata',
            ]);
        });
    }
};
