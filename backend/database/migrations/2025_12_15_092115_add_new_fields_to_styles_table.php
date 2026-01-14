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
        Schema::table('styles', function (Blueprint $table) {
            // Add buyer/trim detail fields
            $table->text('price_ticket_spec')->nullable()->after('technical_file_path');
            $table->text('labels_hangtags')->nullable()->after('price_ticket_spec');
            $table->text('price_ticket_info')->nullable()->after('labels_hangtags');

            // Make price fields nullable (price will be set at PO level)
            $table->decimal('unit_price', 10, 2)->nullable()->change();
            $table->decimal('fob_price', 10, 2)->nullable()->change();

            // Drop division_id and customer_id (no longer needed at style level)
            $table->dropForeign(['division_id']);
            $table->dropColumn('division_id');
            $table->dropForeign(['customer_id']);
            $table->dropColumn('customer_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            // Remove new fields
            $table->dropColumn(['price_ticket_spec', 'labels_hangtags', 'price_ticket_info']);

            // Restore old fields
            $table->foreignId('division_id')->nullable()->after('season_id')->constrained()->onDelete('set null');
            $table->foreignId('customer_id')->nullable()->after('division_id')->constrained()->onDelete('set null');

            // Restore price field requirements
            $table->decimal('unit_price', 10, 2)->nullable(false)->change();
            $table->decimal('fob_price', 10, 2)->nullable(false)->change();
        });
    }
};
