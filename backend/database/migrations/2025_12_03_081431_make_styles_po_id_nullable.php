<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Makes po_id nullable in styles table to allow standalone styles.
     * Drops the foreign key constraint with cascade delete.
     */
    public function up(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Drop the foreign key constraint first
            $table->dropForeign(['po_id']);

            // Make po_id nullable
            $table->foreignId('po_id')->nullable()->change();

            // Re-add foreign key without cascade delete (just nullOnDelete for backward compatibility)
            $table->foreign('po_id')
                  ->references('id')
                  ->on('purchase_orders')
                  ->nullOnDelete();
        });

        echo "\n✓ Made styles.po_id nullable - styles can now exist independently\n";
    }

    /**
     * Reverse the migrations.
     *
     * WARNING: This will make po_id required again!
     * Styles without po_id will cause errors.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Drop the nullable foreign key
            $table->dropForeign(['po_id']);

            // Make po_id required again with cascade delete
            $table->foreignId('po_id')->change();
            $table->foreign('po_id')
                  ->references('id')
                  ->on('purchase_orders')
                  ->cascadeOnDelete();
        });

        echo "\n✓ Reverted styles.po_id to required with cascade delete\n";
    }
};
