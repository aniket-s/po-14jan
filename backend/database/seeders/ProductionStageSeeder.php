<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductionStageSeeder extends Seeder
{
    public function run(): void
    {
        $stages = [
            [
                'name' => 'sampling',
                'display_name' => 'Sampling',
                'weight_percentage' => 10,
                'typical_days' => 7,
                'display_order' => 1,
                'description' => 'Sample development and approval',
                'color' => '#8b5cf6',
                'is_active' => true,
            ],
            [
                'name' => 'cutting',
                'display_name' => 'Cutting',
                'weight_percentage' => 15,
                'typical_days' => 5,
                'display_order' => 2,
                'description' => 'Fabric cutting',
                'color' => '#3b82f6',
                'is_active' => true,
            ],
            [
                'name' => 'stitching',
                'display_name' => 'Stitching',
                'weight_percentage' => 40,
                'typical_days' => 15,
                'display_order' => 3,
                'description' => 'Main sewing process',
                'color' => '#10b981',
                'is_active' => true,
            ],
            [
                'name' => 'finishing',
                'display_name' => 'Finishing',
                'weight_percentage' => 15,
                'typical_days' => 5,
                'display_order' => 4,
                'description' => 'Finishing touches and quality check',
                'color' => '#f59e0b',
                'is_active' => true,
            ],
            [
                'name' => 'packing',
                'display_name' => 'Packing',
                'weight_percentage' => 10,
                'typical_days' => 3,
                'display_order' => 5,
                'description' => 'Packing and carton preparation',
                'color' => '#ec4899',
                'is_active' => true,
            ],
            [
                'name' => 'dispatch',
                'display_name' => 'Dispatch',
                'weight_percentage' => 10,
                'typical_days' => 2,
                'display_order' => 6,
                'description' => 'Ready for shipment',
                'color' => '#6366f1',
                'is_active' => true,
            ],
        ];

        foreach ($stages as $stage) {
            DB::table('production_stages')->insert(array_merge($stage, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
