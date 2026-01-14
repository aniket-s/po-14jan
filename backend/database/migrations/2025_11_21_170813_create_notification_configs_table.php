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
        Schema::create('notification_configs', function (Blueprint $table) {
            $table->id();
            $table->string('event_name', 100)->unique(); // 'sample_submitted', etc.
            $table->string('category', 50)->nullable();
            $table->boolean('email_enabled')->default(true);
            $table->boolean('in_app_enabled')->default(true);
            $table->boolean('sms_enabled')->default(false);
            $table->json('recipients')->nullable(); // Role names or specific user logic
            $table->foreignId('email_template_id')->nullable()->constrained('email_templates')->nullOnDelete();
            $table->text('in_app_message')->nullable();
            $table->text('sms_message')->nullable();
            $table->integer('delay_minutes')->default(0);
            $table->string('priority', 20)->default('normal');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_configs');
    }
};
