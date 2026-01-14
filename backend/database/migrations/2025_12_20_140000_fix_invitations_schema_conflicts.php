<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration fixes critical schema conflicts between the original
     * migration and the actual application code. The original migration
     * created required columns (from_user_id, to_email, token) that are
     * never used by the application, causing database errors.
     */
    public function up(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            // Drop foreign key constraint on from_user_id before making it nullable
            $table->dropForeign(['from_user_id']);

            // Drop unique constraint on token before making it nullable
            $table->dropUnique(['token']);
        });

        Schema::table('invitations', function (Blueprint $table) {
            // Make old unused columns nullable to prevent "doesn't have a default value" errors
            // These columns are from the original migration but are never used by the application
            $table->foreignId('from_user_id')->nullable()->change();
            $table->string('to_email')->nullable()->change();
            $table->string('token', 100)->nullable()->change();

            // Add invited_name column - searched in indexAll() but never created
            $table->string('invited_name')->nullable()->after('invited_email');
        });

        Schema::table('invitations', function (Blueprint $table) {
            // Re-add foreign key constraint (now nullable)
            $table->foreign('from_user_id')->references('id')->on('users')->nullOnDelete();

            // Add index on invitation_token for faster lookups (used in accept/reject)
            $table->index('invitation_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            // Drop added index
            $table->dropIndex(['invitation_token']);

            // Drop foreign key constraint
            $table->dropForeign(['from_user_id']);

            // Drop invited_name column
            $table->dropColumn('invited_name');
        });

        Schema::table('invitations', function (Blueprint $table) {
            // Revert columns to non-nullable (WARNING: Will fail if NULL values exist)
            $table->foreignId('from_user_id')->nullable(false)->change();
            $table->string('to_email')->nullable(false)->change();
            $table->string('token', 100)->nullable(false)->change();
        });

        Schema::table('invitations', function (Blueprint $table) {
            // Re-add constraints
            $table->foreign('from_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique('token');
        });
    }
};
