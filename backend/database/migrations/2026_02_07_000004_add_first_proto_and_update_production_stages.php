<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add 1st Proto sample type (before PP Sample)
        $exists = DB::table('sample_types')->where('name', 'first_proto')->exists();
        if (!$exists) {
            DB::table('sample_types')->insert([
                'name' => 'first_proto',
                'display_name' => '1st Proto',
                'description' => 'First prototype sample - can be submitted anytime before PP Sample',
                'prerequisites' => json_encode([]),
                'required_for_production' => true,
                'parallel_submission_allowed' => true,
                'typical_days' => 7,
                'display_order' => 0,
                'max_images' => 10,
                'is_active' => true,
                'is_custom' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Update PP Sample to require first_proto as prerequisite
        DB::table('sample_types')
            ->where('name', 'pp_sample')
            ->update([
                'prerequisites' => json_encode(['first_proto']),
                'parallel_submission_allowed' => false,
            ]);

        // Deactivate old granular production stages
        DB::table('production_stages')
            ->whereIn('name', ['sampling', 'cutting', 'stitching', 'finishing', 'packing', 'dispatch'])
            ->update(['is_active' => false]);

        // Add new simplified production stages
        $newStages = [
            [
                'name' => 'submitted',
                'display_name' => 'Submitted',
                'weight_percentage' => 10,
                'typical_days' => 1,
                'display_order' => 100,
                'description' => 'Order acknowledged and submitted for production',
                'color' => '#3b82f6',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'in_production',
                'display_name' => 'In Production',
                'weight_percentage' => 60,
                'typical_days' => 30,
                'display_order' => 101,
                'description' => 'Goods are being manufactured',
                'color' => '#f59e0b',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'estimated_ex_factory',
                'display_name' => 'Estimated Ex-Factory',
                'weight_percentage' => 30,
                'typical_days' => 7,
                'display_order' => 102,
                'description' => 'Estimated ex-factory date set, pending shipping approval',
                'color' => '#10b981',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($newStages as $stage) {
            $stageExists = DB::table('production_stages')->where('name', $stage['name'])->exists();
            if (!$stageExists) {
                DB::table('production_stages')->insert($stage);
            }
        }
    }

    public function down(): void
    {
        // Reactivate old stages
        DB::table('production_stages')
            ->whereIn('name', ['sampling', 'cutting', 'stitching', 'finishing', 'packing', 'dispatch'])
            ->update(['is_active' => true]);

        // Deactivate new stages
        DB::table('production_stages')
            ->whereIn('name', ['submitted', 'in_production', 'estimated_ex_factory'])
            ->update(['is_active' => false]);

        // Remove first_proto sample type
        DB::table('sample_types')->where('name', 'first_proto')->delete();

        // Revert PP Sample prerequisites
        DB::table('sample_types')
            ->where('name', 'pp_sample')
            ->update([
                'prerequisites' => json_encode([]),
                'parallel_submission_allowed' => true,
            ]);
    }
};
