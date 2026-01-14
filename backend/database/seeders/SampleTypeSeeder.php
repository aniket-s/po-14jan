<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SampleTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            [
                'name' => 'lab_dip',
                'display_name' => 'Lab Dip',
                'description' => 'Color matching sample',
                'prerequisites' => json_encode([]),
                'required_for_production' => true,
                'parallel_submission_allowed' => true,
                'typical_days' => 5,
                'display_order' => 1,
                'max_images' => 5,
                'is_active' => true,
            ],
            [
                'name' => 'fit_sample',
                'display_name' => 'Fit Sample',
                'description' => 'Size and fit approval sample',
                'prerequisites' => json_encode([]),
                'required_for_production' => true,
                'parallel_submission_allowed' => true,
                'typical_days' => 7,
                'display_order' => 2,
                'max_images' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'trim_card',
                'display_name' => 'Trim Card',
                'description' => 'All trims and accessories sample',
                'prerequisites' => json_encode([]),
                'required_for_production' => true,
                'parallel_submission_allowed' => true,
                'typical_days' => 5,
                'display_order' => 3,
                'max_images' => 8,
                'is_active' => true,
            ],
            [
                'name' => 'print_embroidery',
                'display_name' => 'Print/Embroidery Sample',
                'description' => 'Print and embroidery approval',
                'prerequisites' => json_encode([]),
                'required_for_production' => false,
                'parallel_submission_allowed' => true,
                'typical_days' => 7,
                'display_order' => 4,
                'max_images' => 8,
                'is_active' => true,
            ],
            [
                'name' => 'pp_sample',
                'display_name' => 'PP Sample',
                'description' => 'Pre-production sample',
                'prerequisites' => json_encode([]),
                'required_for_production' => true,
                'parallel_submission_allowed' => true,
                'typical_days' => 10,
                'display_order' => 5,
                'max_images' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'top_sample',
                'display_name' => 'TOP Sample',
                'description' => 'Top of production - final approval before bulk',
                'prerequisites' => json_encode(['lab_dip', 'fit_sample', 'trim_card', 'pp_sample']),
                'required_for_production' => true,
                'parallel_submission_allowed' => false,
                'typical_days' => 3,
                'display_order' => 6,
                'max_images' => 10,
                'is_active' => true,
            ],
        ];

        foreach ($types as $type) {
            DB::table('sample_types')->insert(array_merge($type, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
