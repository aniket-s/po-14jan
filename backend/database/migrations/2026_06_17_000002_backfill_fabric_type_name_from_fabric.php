<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The style list / detail / PO grid all display fabric from `fabric_type_name`,
 * but the Excel importers only ever wrote the plain `fabric` column - so
 * imported styles showed a blank fabric. The importer is fixed going forward;
 * this backfills the display column for existing rows where it's missing.
 *
 * Non-destructive: only fills rows where fabric_type_name is empty and `fabric`
 * has a value, so manually-set fabric types are untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('styles', 'fabric_type_name') || !Schema::hasColumn('styles', 'fabric')) {
            return;
        }

        DB::table('styles')
            ->whereNull('fabric_type_name')
            ->whereNotNull('fabric')
            ->where('fabric', '!=', '')
            ->update(['fabric_type_name' => DB::raw('fabric')]);
    }

    public function down(): void
    {
        // No-op: we can't tell which values were backfilled vs original.
    }
};
