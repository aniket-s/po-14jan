<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Grants the Agency role two capabilities it was missing in production:
 *
 * - sample.approve_as_importer_on_behalf — lets an agency finalise importer
 *   approval when the Importer isn't available.
 * - style.create — lets an agency upload styles via the Excel importer
 *   (the /styles/import/* routes are gated by this permission).
 *
 * Idempotent: safe to run repeatedly. Uses givePermissionTo so existing
 * Agency permissions are preserved rather than replaced.
 */
class AgencyDelegatedPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        Permission::firstOrCreate(
            ['name' => 'sample.approve_as_importer_on_behalf', 'guard_name' => 'web'],
            ['category' => 'Samples', 'description' => 'Approve samples on behalf of the importer (agency delegation)']
        );

        Permission::firstOrCreate(
            ['name' => 'style.create', 'guard_name' => 'web'],
            ['category' => 'Styles', 'description' => 'Create styles']
        );

        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();

        if (!$agency) {
            $this->command->warn('Agency role not found — skipping. Run DefaultRolesSeeder first.');
            return;
        }

        $agency->givePermissionTo([
            'sample.approve_as_importer_on_behalf',
            'style.create',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->command->info('Agency granted sample.approve_as_importer_on_behalf and style.create.');
    }
}
