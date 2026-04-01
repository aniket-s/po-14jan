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

        $permission = Permission::where('name', 'sample.create')->where('guard_name', 'web')->first();
        if (!$permission) {
            $permission = Permission::create([
                'name' => 'sample.create',
                'guard_name' => 'web',
            ]);
        }

        $factory = Role::where('name', 'Factory')->where('guard_name', 'web')->first();
        if ($factory && !$factory->hasPermissionTo('sample.create')) {
            $factory->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $factory = Role::where('name', 'Factory')->where('guard_name', 'web')->first();
        if ($factory) {
            $factory->revokePermissionTo('sample.create');
        }
    }
};
