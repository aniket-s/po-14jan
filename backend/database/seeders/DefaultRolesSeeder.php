<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DefaultRolesSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Super Admin - Full system access
        // Spatie's Role::create() throws if the role already exists,
        // so we must check manually instead of using firstOrCreate().
        $superAdmin = Role::where('name', 'Super Admin')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Super Admin', 'guard_name' => 'web']);
        $superAdmin->syncPermissions(Permission::all());

        // Importer - Create POs, assign factories/agencies, approve samples
        $importer = Role::where('name', 'Importer')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Importer', 'guard_name' => 'web']);
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

        // Agency - Manage POs, assign factories, review samples
        $agency = Role::where('name', 'Agency')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Agency', 'guard_name' => 'web']);
        $agency->syncPermissions([
            // PO Permissions
            'po.view_own',
            'po.create',
            'po.edit',
            'po.assign_factory',
            'po.bulk_assign',
            'po.import',
            'po.export',
            // Style Permissions
            'style.view_own',
            'style.edit',
            'style.assign_factory',
            'style.bulk_assign',
            // Invitation Permissions
            'invitation.send',
            'invitation.send_factory',
            'invitation.send_importer',
            'invitation.respond',
            'invitation.cancel',
            // Sample Permissions
            'sample.view_own',
            'sample.agency_approve',
            'sample.approve_agency',
            'sample.approve_as_importer_on_behalf',
            'sample.reject',
            // Production Permissions
            'production.view_own',
            // Quality Permissions
            'quality.view_inspection',
            // Shipment Permissions
            'shipment.view_own',
            'shipment.track',
        ]);

        // Factory - Submit samples, manage production, create shipments
        $factory = Role::where('name', 'Factory')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Factory', 'guard_name' => 'web']);
        $factory->syncPermissions([
            // PO Permissions
            'po.view_own',
            // Style Permissions
            'style.view_own',
            // Invitation Permissions
            'invitation.respond',
            // Sample Permissions
            'sample.create',
            'sample.submit',
            'sample.view_own',
            // Production Permissions
            'production.initialize',
            'production.view_own',
            'production.update',
            'production.complete_stage',
            // Quality Permissions
            'quality.view_inspection',
            // Shipment Permissions
            'shipment.create',
            'shipment.view_own',
            'shipment.update',
            'shipment.mark_dispatched',
        ]);

        // Quality Inspector - Conduct inspections, generate certificates
        $inspector = Role::where('name', 'Quality Inspector')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Quality Inspector', 'guard_name' => 'web']);
        $inspector->syncPermissions([
            // PO Permissions
            'po.view',
            // Style Permissions
            'style.view',
            // Production Permissions
            'production.view',
            // Quality Permissions
            'quality.create_inspection',
            'quality.view_inspection',
            'quality.view_all_inspections',
            'quality.generate_certificate',
            'quality.pass_inspection',
            'quality.fail_inspection',
            // Shipment Permissions
            'shipment.view',
        ]);

        // Viewer - Read-only access
        $viewer = Role::where('name', 'Viewer')->where('guard_name', 'web')->first()
            ?? Role::create(['name' => 'Viewer', 'guard_name' => 'web']);
        $viewer->syncPermissions([
            'po.view',
            'style.view',
            'sample.view',
            'production.view',
            'quality.view_inspection',
            'shipment.view',
            'shipment.track',
        ]);
    }
}
