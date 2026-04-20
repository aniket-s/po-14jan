<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('buy_sheet_id')->nullable()->after('buyer_id')
                ->constrained('buy_sheets')->nullOnDelete();
            $table->string('buy_sheet_number', 50)->nullable()->after('buy_sheet_id')->index();
            $table->json('import_source')->nullable()->after('metadata');
            $table->date('fob_date')->nullable()->after('ex_factory_date');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['buy_sheet_id']);
            $table->dropColumn(['buy_sheet_id', 'buy_sheet_number', 'import_source', 'fob_date']);
        });
    }
};
