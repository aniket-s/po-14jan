<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\InspectionType;

class InspectionTypeSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $types = [
            [
                'name' => 'Initial Production Check (IPC)',
                'code' => 'IPC',
                'description' => 'Inspection during initial production phase to check first pieces',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => false,
                'display_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'During Production Inspection (DUPRO)',
                'code' => 'DUPRO',
                'description' => 'Inspection during production when 10-30% is complete',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => false,
                'display_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => 'Pre-Shipment Inspection (PSI)',
                'code' => 'PSI',
                'description' => 'Final inspection when at least 80% of production is complete',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => true,
                'display_order' => 3,
                'is_active' => true,
            ],
            [
                'name' => 'Final Random Inspection (FRI)',
                'code' => 'FRI',
                'description' => 'Final inspection of packed cartons ready for shipment',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => true,
                'display_order' => 4,
                'is_active' => true,
            ],
            [
                'name' => 'Container Loading Check (CLC)',
                'code' => 'CLC',
                'description' => 'Inspection during container loading to ensure proper packing',
                'requires_sample_size' => false,
                'requires_aql_level' => false,
                'can_generate_certificate' => false,
                'display_order' => 5,
                'is_active' => true,
            ],
            [
                'name' => 'Third-Party Inspection',
                'code' => 'TPI',
                'description' => 'Independent third-party quality inspection',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => true,
                'display_order' => 6,
                'is_active' => true,
            ],
            [
                'name' => 'Internal Factory QC',
                'code' => 'IQC',
                'description' => 'Internal quality control by factory QC team',
                'requires_sample_size' => true,
                'requires_aql_level' => true,
                'can_generate_certificate' => false,
                'display_order' => 7,
                'is_active' => true,
            ],
        ];

        foreach ($types as $type) {
            InspectionType::create($type);
        }
    }
}
