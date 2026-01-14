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
            $table->dropColumn([
                'price_ticket_spec',
                'labels_hangtags',
                'price_ticket_info',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('styles', function (Blueprint $table) {
            $table->text('price_ticket_spec')->nullable();
            $table->text('labels_hangtags')->nullable();
            $table->text('price_ticket_info')->nullable();
        });
    }
};
