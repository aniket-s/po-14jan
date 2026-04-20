<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Idempotent seeder that grants the new buy-sheet permissions (and the reports
 * permissions that Agency previously lacked) to existing Agency and Importer roles.
 *
 * Safe to run on top of DefaultPermissionsSeeder + DefaultRolesSeeder - only
 * missing permissions are attached.
 */
class BuySheetImportPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $newBuySheetPerms = [
            'buy_sheet.view', 'buy_sheet.create', 'buy_sheet.edit',
            'buy_sheet.delete', 'buy_sheet.import',
        ];

        foreach ($newBuySheetPerms as $name) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                ['category' => 'Buy Sheets', 'description' => ucfirst(str_replace(['_', '.'], [' ', ' '], $name))]
            );
        }

        // Agency gains buy-sheet + reports parity with Importer
        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if ($agency) {
            $agency->givePermissionTo(array_merge($newBuySheetPerms, [
                'reports.view', 'reports.export',
                'po.delete', 'po.assign_agency',
                'style.create', 'style.delete',
                'sample.view', 'sample.create', 'sample.submit', 'sample.bulk_approve',
                'invitation.send_agency', 'invitation.view_all',
            ]));
        }

        // Importer gains buy-sheet perms
        $importer = Role::where('name', 'Importer')->where('guard_name', 'web')->first();
        if ($importer) {
            $importer->givePermissionTo($newBuySheetPerms);
        }

        // Super Admin inherits everything
        $superAdmin = Role::where('name', 'Super Admin')->where('guard_name', 'web')->first();
        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }
    }
}
