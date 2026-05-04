<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Buy-sheet permissions were only added to seeders, so existing production
 * databases never got the rows. Routes guarded by `permission:buy_sheet.view`
 * then throw PermissionDoesNotExist via Spatie. This migration creates the
 * permissions idempotently and grants them to the roles that BuySheetImport
 * PermissionsSeeder already targets.
 */
return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $perms = [
            'buy_sheet.view' => 'View buy sheets',
            'buy_sheet.create' => 'Create buy sheets',
            'buy_sheet.edit' => 'Edit buy sheets',
            'buy_sheet.delete' => 'Delete buy sheets',
            'buy_sheet.import' => 'Import buy sheet from PDF/Excel',
        ];

        $created = [];
        foreach ($perms as $name => $description) {
            $created[] = Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                ['category' => 'Buy Sheets', 'description' => $description]
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

        $names = ['buy_sheet.view', 'buy_sheet.create', 'buy_sheet.edit', 'buy_sheet.delete', 'buy_sheet.import'];

        foreach (['Super Admin', 'Importer', 'Agency'] as $roleName) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                foreach ($names as $name) {
                    if ($role->hasPermissionTo($name)) {
                        $role->revokePermissionTo($name);
                    }
                }
            }
        }

        Permission::whereIn('name', $names)->where('guard_name', 'web')->delete();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
