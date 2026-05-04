<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Reports permissions are listed for both Agency and Importer in the
 * DefaultRolesSeeder, but production databases seeded before those entries
 * were added (and that have only had migrate run since) may have an Agency
 * role without reports.view / reports.export. Without it, the /reports route
 * 403s for Agency users and the sidebar item is hidden.
 *
 * Idempotently ensures the two permissions exist and grants them to Agency
 * and Importer so both roles get access. Super Admin already inherits all
 * permissions via the role-permission seeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $perms = [
            'reports.view' => 'View reports & analytics',
            'reports.export' => 'Export reports to CSV / Excel',
        ];

        foreach ($perms as $name => $description) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                ['category' => 'Reports', 'description' => $description]
            );
        }

        $names = array_keys($perms);

        foreach (['Super Admin', 'Importer', 'Agency'] as $roleName) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                $role->givePermissionTo($names);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Down only revokes from Agency - reports were always intended for
        // Importer/Super Admin, so leave their grants in place.
        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if ($agency) {
            foreach (['reports.view', 'reports.export'] as $name) {
                if ($agency->hasPermissionTo($name)) {
                    $agency->revokePermissionTo($name);
                }
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
