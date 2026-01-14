<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DefectCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'critical',
                'severity' => 'critical',
                'description' => 'Defects that make the product completely unusable or unsafe',
                'examples' => 'Sharp objects, safety hazards, broken zippers, missing parts',
                'auto_fail' => true,
                'color' => '#dc2626',
                'display_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'major',
                'severity' => 'major',
                'description' => 'Defects that significantly affect usability or appearance',
                'examples' => 'Fabric holes, color variation, crooked seams, loose buttons',
                'auto_fail' => false,
                'color' => '#f59e0b',
                'display_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => 'minor',
                'severity' => 'minor',
                'description' => 'Small defects that do not significantly affect quality',
                'examples' => 'Loose threads, minor stitching irregularities, small marks',
                'auto_fail' => false,
                'color' => '#3b82f6',
                'display_order' => 3,
                'is_active' => true,
            ],
        ];

        foreach ($categories as $category) {
            DB::table('defect_categories')->insert(array_merge($category, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
