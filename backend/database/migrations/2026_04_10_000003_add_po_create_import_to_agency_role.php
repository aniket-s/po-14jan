<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if (!$agency) {
            return;
        }

        // Ensure the permissions exist
        foreach (['po.create', 'po.import'] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // Give Agency the po.create and po.import permissions (additive, keeps existing)
        $agency->givePermissionTo(['po.create', 'po.import']);
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if ($agency) {
            $agency->revokePermissionTo(['po.create', 'po.import']);
        }
    }
};
