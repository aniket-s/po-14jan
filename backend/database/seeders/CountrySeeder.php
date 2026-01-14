<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Country;

class CountrySeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Sailing times are approximate days from country of origin to US ports (West/East Coast average)
     */
    public function run(): void
    {
        $countries = [
            // Major Asian Manufacturing Hubs
            ['name' => 'Bangladesh', 'code' => 'BGD', 'sailing_time_days' => 28, 'is_active' => true],
            ['name' => 'China', 'code' => 'CHN', 'sailing_time_days' => 18, 'is_active' => true],
            ['name' => 'Vietnam', 'code' => 'VNM', 'sailing_time_days' => 21, 'is_active' => true],
            ['name' => 'India', 'code' => 'IND', 'sailing_time_days' => 30, 'is_active' => true],
            ['name' => 'Pakistan', 'code' => 'PAK', 'sailing_time_days' => 32, 'is_active' => true],
            ['name' => 'Indonesia', 'code' => 'IDN', 'sailing_time_days' => 24, 'is_active' => true],
            ['name' => 'Thailand', 'code' => 'THA', 'sailing_time_days' => 22, 'is_active' => true],
            ['name' => 'Cambodia', 'code' => 'KHM', 'sailing_time_days' => 23, 'is_active' => true],
            ['name' => 'Sri Lanka', 'code' => 'LKA', 'sailing_time_days' => 31, 'is_active' => true],
            ['name' => 'Myanmar', 'code' => 'MMR', 'sailing_time_days' => 29, 'is_active' => true],

            // Other Manufacturing Countries
            ['name' => 'Turkey', 'code' => 'TUR', 'sailing_time_days' => 20, 'is_active' => true],
            ['name' => 'Egypt', 'code' => 'EGY', 'sailing_time_days' => 22, 'is_active' => true],
            ['name' => 'Mexico', 'code' => 'MEX', 'sailing_time_days' => 5, 'is_active' => true],
            ['name' => 'Honduras', 'code' => 'HND', 'sailing_time_days' => 7, 'is_active' => true],
            ['name' => 'El Salvador', 'code' => 'SLV', 'sailing_time_days' => 8, 'is_active' => true],
            ['name' => 'Guatemala', 'code' => 'GTM', 'sailing_time_days' => 8, 'is_active' => true],
            ['name' => 'Nicaragua', 'code' => 'NIC', 'sailing_time_days' => 8, 'is_active' => true],
            ['name' => 'Haiti', 'code' => 'HTI', 'sailing_time_days' => 6, 'is_active' => true],
            ['name' => 'Dominican Republic', 'code' => 'DOM', 'sailing_time_days' => 6, 'is_active' => true],

            // European Manufacturing
            ['name' => 'Portugal', 'code' => 'PRT', 'sailing_time_days' => 12, 'is_active' => true],
            ['name' => 'Italy', 'code' => 'ITA', 'sailing_time_days' => 14, 'is_active' => true],
            ['name' => 'Romania', 'code' => 'ROU', 'sailing_time_days' => 16, 'is_active' => true],
            ['name' => 'Poland', 'code' => 'POL', 'sailing_time_days' => 15, 'is_active' => true],

            // South American
            ['name' => 'Peru', 'code' => 'PER', 'sailing_time_days' => 12, 'is_active' => true],
            ['name' => 'Colombia', 'code' => 'COL', 'sailing_time_days' => 10, 'is_active' => true],
            ['name' => 'Brazil', 'code' => 'BRA', 'sailing_time_days' => 18, 'is_active' => true],

            // African
            ['name' => 'Morocco', 'code' => 'MAR', 'sailing_time_days' => 14, 'is_active' => true],
            ['name' => 'Tunisia', 'code' => 'TUN', 'sailing_time_days' => 16, 'is_active' => true],
            ['name' => 'Ethiopia', 'code' => 'ETH', 'sailing_time_days' => 26, 'is_active' => true],
            ['name' => 'Kenya', 'code' => 'KEN', 'sailing_time_days' => 28, 'is_active' => true],
        ];

        foreach ($countries as $country) {
            Country::updateOrCreate(
                ['code' => $country['code']],
                $country
            );
        }
    }
}
