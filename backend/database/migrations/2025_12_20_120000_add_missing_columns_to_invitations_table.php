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
        Schema::table('invitations', function (Blueprint $table) {
            // Add missing columns that the model expects
            $table->foreignId('purchase_order_id')->nullable()->after('id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->string('invitation_type', 50)->nullable()->after('type');
            $table->foreignId('invited_by')->nullable()->after('invitation_type')->constrained('users')->cascadeOnDelete();
            $table->foreignId('invited_user_id')->nullable()->after('invited_by')->constrained('users')->nullOnDelete();
            $table->string('invited_email')->nullable()->after('invited_user_id');
            $table->string('invitation_token', 100)->nullable()->unique()->after('invited_email');
            $table->timestamp('accepted_at')->nullable()->after('responded_at');
            $table->timestamp('rejected_at')->nullable()->after('accepted_at');
            $table->text('message')->nullable()->after('data');
            $table->json('metadata')->nullable()->after('message');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn('purchase_order_id');
            $table->dropForeign(['invited_by']);
            $table->dropColumn('invited_by');
            $table->dropForeign(['invited_user_id']);
            $table->dropColumn('invited_user_id');
            $table->dropColumn([
                'invitation_type',
                'invited_email',
                'invitation_token',
                'accepted_at',
                'rejected_at',
                'message',
                'metadata',
            ]);
        });
    }
};
