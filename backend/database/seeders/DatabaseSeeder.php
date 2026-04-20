<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed configuration data first
        $this->call([
            SystemStatusSeeder::class,
            SampleTypeSeeder::class,
            ProductionStageSeeder::class,
            AQLLevelSeeder::class,
            DefectCategorySeeder::class,
            InspectionTypeSeeder::class,
            EmailTemplateSeeder::class,
            SystemSettingsSeeder::class,
            DefaultPermissionsSeeder::class,
            DefaultRolesSeeder::class,
            AgencyDelegatedPermissionsSeeder::class,
            BuySheetImportPermissionsSeeder::class,
        ]);

        // Create a super admin user for testing
        $user = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        // Assign super admin role
        $user->assignRole('Super Admin');
    }
}
