<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $importer = Role::where('name', 'Importer')->where('guard_name', 'web')->first();
        if (!$importer) {
            return;
        }

        // Reset Importer role to the correct scoped permissions.
        // The live DB had view_all/view permissions which bypass all filtering,
        // allowing importers to see all POs and styles instead of only their own.
        $importer->syncPermissions([
            // PO Permissions
            'po.view_own',
            'po.create',
            'po.edit',
            'po.delete',
            'po.assign_agency',
            'po.assign_factory',
            'po.bulk_assign',
            'po.import',
            'po.export',
            // Style Permissions
            'style.view_own',
            'style.create',
            'style.edit',
            'style.delete',
            'style.assign_factory',
            'style.bulk_assign',
            // Invitation Permissions
            'invitation.send',
            'invitation.send_agency',
            'invitation.send_factory',
            'invitation.respond',
            'invitation.cancel',
            'invitation.view_all',
            // Sample Permissions
            'sample.view',
            'sample.approve_final',
            'sample.reject',
            'sample.create_auto_rule',
            'sample.bulk_approve',
            // Production Permissions
            'production.view_own',
            // Quality Permissions
            'quality.view_inspection',
            // Shipment Permissions
            'shipment.view_own',
            'shipment.track',
            // Report Permissions
            'reports.view',
            'reports.export',
        ]);
    }

    public function down(): void
    {
        // No rollback — the previous state was incorrect
    }
};
