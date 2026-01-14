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
        Schema::table('email_templates', function (Blueprint $table) {
            $table->string('from_email')->nullable()->after('body_html');
            $table->string('from_name')->nullable()->after('from_email');
            $table->string('reply_to')->nullable()->after('from_name');
            $table->string('cc')->nullable()->after('reply_to');
            $table->string('bcc')->nullable()->after('cc');
            $table->longText('body_text')->nullable()->after('bcc');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('email_templates', function (Blueprint $table) {
            $table->dropColumn(['from_email', 'from_name', 'reply_to', 'cc', 'bcc', 'body_text']);
        });
    }
};
