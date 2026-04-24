<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Idempotent: a prior attempt may have partially added columns before
        // failing on `after('metadata')`. Guard each add so a retry succeeds.
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'buy_sheet_id')) {
                $table->foreignId('buy_sheet_id')->nullable()->after('buyer_id')
                    ->constrained('buy_sheets')->nullOnDelete();
            }
            if (!Schema::hasColumn('purchase_orders', 'buy_sheet_number')) {
                $table->string('buy_sheet_number', 50)->nullable()->after('buy_sheet_id')->index();
            }
            // `additional_notes` is a known-present column on every deployment; the
            // PurchaseOrder model's $fillable lists `metadata` but no migration
            // actually creates that column, so we cannot anchor against it.
            if (!Schema::hasColumn('purchase_orders', 'import_source')) {
                $table->json('import_source')->nullable()->after('additional_notes');
            }
            if (!Schema::hasColumn('purchase_orders', 'fob_date')) {
                $table->date('fob_date')->nullable()->after('ex_factory_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'buy_sheet_id')) {
                $table->dropForeign(['buy_sheet_id']);
            }
            $columns = array_filter(
                ['buy_sheet_id', 'buy_sheet_number', 'import_source', 'fob_date'],
                fn ($c) => Schema::hasColumn('purchase_orders', $c)
            );
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
