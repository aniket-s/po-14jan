<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->renameColumn('factory_status', 'agency_status');
            $table->renameColumn('factory_approved_by', 'agency_approved_by');
            $table->renameColumn('factory_approved_at', 'agency_approved_at');
            $table->renameColumn('factory_rejection_reason', 'agency_rejection_reason');
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->renameColumn('agency_status', 'factory_status');
            $table->renameColumn('agency_approved_by', 'factory_approved_by');
            $table->renameColumn('agency_approved_at', 'factory_approved_at');
            $table->renameColumn('agency_rejection_reason', 'factory_rejection_reason');
        });
    }
};
