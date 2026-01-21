<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PaymentTerm;

class PaymentTermSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Seeds default payment terms used in purchase orders.
     */
    public function run(): void
    {
        $paymentTerms = [
            [
                'name' => 'NET 30',
                'code' => 'NET30',
                'days' => 30,
                'requires_percentage' => false,
                'description' => 'Payment due 30 days after invoice date',
                'is_active' => true,
            ],
            [
                'name' => 'NET 60',
                'code' => 'NET60',
                'days' => 60,
                'requires_percentage' => false,
                'description' => 'Payment due 60 days after invoice date',
                'is_active' => true,
            ],
            [
                'name' => 'NET 90',
                'code' => 'NET90',
                'days' => 90,
                'requires_percentage' => false,
                'description' => 'Payment due 90 days after invoice date',
                'is_active' => true,
            ],
            [
                'name' => 'DP SIGHT',
                'code' => 'DP_SIGHT',
                'days' => null,
                'requires_percentage' => false,
                'description' => 'Documents against Payment at Sight',
                'is_active' => true,
            ],
            [
                'name' => 'LC (Letter of Credit)',
                'code' => 'LC',
                'days' => null,
                'requires_percentage' => false,
                'description' => 'Payment via Letter of Credit',
                'is_active' => true,
            ],
            [
                'name' => 'ADVANCE',
                'code' => 'ADVANCE',
                'days' => null,
                'requires_percentage' => true,
                'description' => 'Advance payment (requires percentage)',
                'is_active' => true,
            ],
            [
                'name' => 'TT (Telegraphic Transfer)',
                'code' => 'TT',
                'days' => null,
                'requires_percentage' => false,
                'description' => 'Telegraphic Transfer payment',
                'is_active' => true,
            ],
            [
                'name' => 'CAD (Cash Against Documents)',
                'code' => 'CAD',
                'days' => null,
                'requires_percentage' => false,
                'description' => 'Cash Against Documents',
                'is_active' => true,
            ],
        ];

        foreach ($paymentTerms as $term) {
            PaymentTerm::updateOrCreate(
                ['code' => $term['code']],
                $term
            );
        }
    }
}
