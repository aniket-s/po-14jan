<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AQLLevelSeeder extends Seeder
{
    public function run(): void
    {
        $levels = [
            [
                'level' => '1.0',
                'name' => 'Luxury',
                'description' => 'Highest quality standard for luxury brands',
                'sample_size_table' => json_encode([
                    ['lot_size_min' => 2, 'lot_size_max' => 8, 'sample_size' => 2, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 9, 'lot_size_max' => 15, 'sample_size' => 3, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 16, 'lot_size_max' => 25, 'sample_size' => 5, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 26, 'lot_size_max' => 50, 'sample_size' => 8, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 51, 'lot_size_max' => 90, 'sample_size' => 13, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 91, 'lot_size_max' => 150, 'sample_size' => 20, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 151, 'lot_size_max' => 280, 'sample_size' => 32, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 281, 'lot_size_max' => 500, 'sample_size' => 50, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 501, 'lot_size_max' => 1200, 'sample_size' => 80, 'accept_point' => 2, 'reject_point' => 3],
                    ['lot_size_min' => 1201, 'lot_size_max' => 3200, 'sample_size' => 125, 'accept_point' => 3, 'reject_point' => 4],
                    ['lot_size_min' => 3201, 'lot_size_max' => 10000, 'sample_size' => 200, 'accept_point' => 5, 'reject_point' => 6],
                    ['lot_size_min' => 10001, 'lot_size_max' => 35000, 'sample_size' => 315, 'accept_point' => 7, 'reject_point' => 8],
                ]),
                'is_default' => false,
                'is_active' => true,
            ],
            [
                'level' => '2.5',
                'name' => 'Standard',
                'description' => 'Standard quality level for most garments',
                'sample_size_table' => json_encode([
                    ['lot_size_min' => 2, 'lot_size_max' => 8, 'sample_size' => 2, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 9, 'lot_size_max' => 15, 'sample_size' => 3, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 16, 'lot_size_max' => 25, 'sample_size' => 5, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 26, 'lot_size_max' => 50, 'sample_size' => 8, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 51, 'lot_size_max' => 90, 'sample_size' => 13, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 91, 'lot_size_max' => 150, 'sample_size' => 20, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 151, 'lot_size_max' => 280, 'sample_size' => 32, 'accept_point' => 2, 'reject_point' => 3],
                    ['lot_size_min' => 281, 'lot_size_max' => 500, 'sample_size' => 50, 'accept_point' => 3, 'reject_point' => 4],
                    ['lot_size_min' => 501, 'lot_size_max' => 1200, 'sample_size' => 80, 'accept_point' => 5, 'reject_point' => 6],
                    ['lot_size_min' => 1201, 'lot_size_max' => 3200, 'sample_size' => 125, 'accept_point' => 7, 'reject_point' => 8],
                    ['lot_size_min' => 3201, 'lot_size_max' => 10000, 'sample_size' => 200, 'accept_point' => 10, 'reject_point' => 11],
                    ['lot_size_min' => 10001, 'lot_size_max' => 35000, 'sample_size' => 315, 'accept_point' => 14, 'reject_point' => 15],
                ]),
                'is_default' => true,
                'is_active' => true,
            ],
            [
                'level' => '4.0',
                'name' => 'Basic',
                'description' => 'Basic quality level for mass production',
                'sample_size_table' => json_encode([
                    ['lot_size_min' => 2, 'lot_size_max' => 8, 'sample_size' => 2, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 9, 'lot_size_max' => 15, 'sample_size' => 3, 'accept_point' => 0, 'reject_point' => 1],
                    ['lot_size_min' => 16, 'lot_size_max' => 25, 'sample_size' => 5, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 26, 'lot_size_max' => 50, 'sample_size' => 8, 'accept_point' => 1, 'reject_point' => 2],
                    ['lot_size_min' => 51, 'lot_size_max' => 90, 'sample_size' => 13, 'accept_point' => 2, 'reject_point' => 3],
                    ['lot_size_min' => 91, 'lot_size_max' => 150, 'sample_size' => 20, 'accept_point' => 3, 'reject_point' => 4],
                    ['lot_size_min' => 151, 'lot_size_max' => 280, 'sample_size' => 32, 'accept_point' => 5, 'reject_point' => 6],
                    ['lot_size_min' => 281, 'lot_size_max' => 500, 'sample_size' => 50, 'accept_point' => 7, 'reject_point' => 8],
                    ['lot_size_min' => 501, 'lot_size_max' => 1200, 'sample_size' => 80, 'accept_point' => 10, 'reject_point' => 11],
                    ['lot_size_min' => 1201, 'lot_size_max' => 3200, 'sample_size' => 125, 'accept_point' => 14, 'reject_point' => 15],
                    ['lot_size_min' => 3201, 'lot_size_max' => 10000, 'sample_size' => 200, 'accept_point' => 21, 'reject_point' => 22],
                    ['lot_size_min' => 10001, 'lot_size_max' => 35000, 'sample_size' => 315, 'accept_point' => 21, 'reject_point' => 22],
                ]),
                'is_default' => false,
                'is_active' => true,
            ],
        ];

        foreach ($levels as $level) {
            DB::table('aql_levels')->insert(array_merge($level, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
