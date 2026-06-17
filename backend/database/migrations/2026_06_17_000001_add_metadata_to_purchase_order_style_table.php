<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The PO/style pivot already carries size_breakdown + notes, but the bulk
 * multi-PO importer needs somewhere lossless to park the dozens of WIP /
 * status / comment columns a tracking sheet carries per row (TP status, sample
 * statuses, factory comments, ETD/ETA, etc.) without widening the schema for
 * every one. A single JSON bag mirrors how the BuySheet pivot already stores
 * its overflow metadata.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('purchase_order_style', 'metadata')) {
            Schema::table('purchase_order_style', function (Blueprint $table) {
                $table->json('metadata')->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_order_style', 'metadata')) {
            Schema::table('purchase_order_style', function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
