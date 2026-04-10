<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if (!$agency) {
            return;
        }

        // Ensure the permission exists
        Permission::firstOrCreate(['name' => 'sample.agency_approve', 'guard_name' => 'web']);

        // Give Agency the correct permission that the controller checks
        $agency->givePermissionTo('sample.agency_approve');
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first();
        if ($agency) {
            $agency->revokePermissionTo('sample.agency_approve');
        }
    }
};
