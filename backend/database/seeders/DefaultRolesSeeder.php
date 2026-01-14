<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DefaultRolesSeeder extends Seeder
{
    public function run(): void
    {
        // Super Admin - Full system access
        $superAdmin = Role::create(['name' => 'Super Admin']);
        $superAdmin->givePermissionTo(Permission::all());

        // Importer - Create POs, assign factories/agencies, approve samples
        $importer = Role::create(['name' => 'Importer']);
        $importer->givePermissionTo([
            // PO Permissions
            'po.view_all',
            'po.create',
            'po.edit',
            'po.delete',
            'po.assign_agency',
            'po.assign_factory',
            'po.bulk_assign',
            'po.import',
            'po.export',
            // Style Permissions
            'style.view',
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
            'production.view_all',
            // Quality Permissions
            'quality.view_all_inspections',
            // Shipment Permissions
            'shipment.view_all',
            'shipment.track',
        ]);

        // Agency - Manage POs, assign factories, review samples
        $agency = Role::create(['name' => 'Agency']);
        $agency->givePermissionTo([
            // PO Permissions
            'po.view_own',
            'po.edit',
            'po.assign_factory',
            'po.bulk_assign',
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
            'sample.approve_agency',
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
        $factory = Role::create(['name' => 'Factory']);
        $factory->givePermissionTo([
            // PO Permissions
            'po.view_own',
            // Style Permissions
            'style.view_own',
            // Invitation Permissions
            'invitation.respond',
            // Sample Permissions
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
        $inspector = Role::create(['name' => 'Quality Inspector']);
        $inspector->givePermissionTo([
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
        $viewer = Role::create(['name' => 'Viewer']);
        $viewer->givePermissionTo([
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
