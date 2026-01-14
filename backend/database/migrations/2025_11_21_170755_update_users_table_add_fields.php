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
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('company')->nullable()->after('phone');
            $table->string('country', 100)->nullable()->after('company');
            $table->text('internal_notes')->nullable()->after('country');
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->after('internal_notes');
            $table->timestamp('last_login_at')->nullable()->after('status');
            $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'company',
                'country',
                'internal_notes',
                'status',
                'last_login_at',
                'last_login_ip',
            ]);
        });
    }
};
