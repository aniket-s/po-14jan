<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factory_assignments', function (Blueprint $table) {
            $table->foreignId('purchase_order_id')
                ->nullable()
                ->after('id')
                ->constrained('purchase_orders')
                ->cascadeOnDelete();

            $table->foreignId('assigned_by')
                ->nullable()
                ->after('invitation_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('assigned_at')
                ->nullable()
                ->after('assigned_by');

            $table->text('notes')
                ->nullable()
                ->after('special_instructions');

            $table->index('purchase_order_id');
            $table->index('assigned_by');
        });
    }

    public function down(): void
    {
        Schema::table('factory_assignments', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropForeign(['assigned_by']);
            $table->dropIndex(['purchase_order_id']);
            $table->dropIndex(['assigned_by']);
            $table->dropColumn(['purchase_order_id', 'assigned_by', 'assigned_at', 'notes']);
        });
    }
};
