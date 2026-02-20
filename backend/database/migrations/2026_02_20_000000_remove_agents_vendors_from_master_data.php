<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Remove agents and vendors from master data.
     * Agencies and factories are now managed exclusively as Users
     * with "Agency" and "Factory" roles via the invitation system.
     */
    public function up(): void
    {
        // Drop agent_id and vendor_id foreign keys and columns from purchase_orders
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'agent_id')) {
                $table->dropForeign(['agent_id']);
                $table->dropColumn('agent_id');
            }
            if (Schema::hasColumn('purchase_orders', 'vendor_id')) {
                $table->dropForeign(['vendor_id']);
                $table->dropColumn('vendor_id');
            }
        });

        // Drop agent_id and vendor_id foreign keys and columns from styles
        Schema::table('styles', function (Blueprint $table) {
            if (Schema::hasColumn('styles', 'agent_id')) {
                $table->dropForeign(['agent_id']);
                $table->dropColumn('agent_id');
            }
            if (Schema::hasColumn('styles', 'vendor_id')) {
                $table->dropForeign(['vendor_id']);
                $table->dropColumn('vendor_id');
            }
        });

        // Drop the agents and vendors tables entirely
        Schema::dropIfExists('agents');
        Schema::dropIfExists('vendors');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate agents table
        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('company_name', 200);
            $table->string('contact_person', 100)->nullable();
            $table->string('email', 100)->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('country', 100)->nullable();
            $table->string('payment_terms', 100)->nullable();
            $table->decimal('account_balance', 15, 2)->default(0);
            $table->json('additional_info')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('user_id');
            $table->index('is_active');
        });

        // Recreate vendors table
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('company_name', 200);
            $table->string('contact_person', 100)->nullable();
            $table->string('email', 100)->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('country', 100)->nullable();
            $table->string('country_of_origin', 100)->nullable();
            $table->json('specializations')->nullable();
            $table->string('payment_terms', 100)->nullable();
            $table->decimal('account_balance', 15, 2)->default(0);
            $table->json('additional_info')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('user_id');
            $table->index('is_active');
        });

        // Re-add agent_id and vendor_id to purchase_orders
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('agent_id')->nullable()->constrained('agents')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
        });

        // Re-add agent_id and vendor_id to styles
        Schema::table('styles', function (Blueprint $table) {
            $table->foreignId('agent_id')->nullable()->constrained('agents')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
        });
    }
};
