<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class DefaultPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Purchase Order Permissions
            ['name' => 'po.view', 'category' => 'Purchase Orders', 'description' => 'View purchase orders'],
            ['name' => 'po.view_own', 'category' => 'Purchase Orders', 'description' => 'View own purchase orders only'],
            ['name' => 'po.view_all', 'category' => 'Purchase Orders', 'description' => 'View all purchase orders'],
            ['name' => 'po.create', 'category' => 'Purchase Orders', 'description' => 'Create purchase orders'],
            ['name' => 'po.edit', 'category' => 'Purchase Orders', 'description' => 'Edit purchase orders'],
            ['name' => 'po.delete', 'category' => 'Purchase Orders', 'description' => 'Delete purchase orders'],
            ['name' => 'po.assign_agency', 'category' => 'Purchase Orders', 'description' => 'Assign agency to PO'],
            ['name' => 'po.assign_factory', 'category' => 'Purchase Orders', 'description' => 'Assign factory to PO'],
            ['name' => 'po.bulk_assign', 'category' => 'Purchase Orders', 'description' => 'Bulk assign styles to factories'],
            ['name' => 'po.import', 'category' => 'Purchase Orders', 'description' => 'Import PO from Excel'],
            ['name' => 'po.export', 'category' => 'Purchase Orders', 'description' => 'Export PO to Excel'],
            ['name' => 'po.invite', 'category' => 'Purchase Orders', 'description' => 'Send invitations for PO'],

            // Style Permissions
            ['name' => 'style.view', 'category' => 'Styles', 'description' => 'View styles'],
            ['name' => 'style.view_own', 'category' => 'Styles', 'description' => 'View own styles only'],
            ['name' => 'style.create', 'category' => 'Styles', 'description' => 'Create styles'],
            ['name' => 'style.edit', 'category' => 'Styles', 'description' => 'Edit styles'],
            ['name' => 'style.delete', 'category' => 'Styles', 'description' => 'Delete styles'],
            ['name' => 'style.assign_factory', 'category' => 'Styles', 'description' => 'Assign factory to style'],
            ['name' => 'style.bulk_assign', 'category' => 'Styles', 'description' => 'Bulk assign styles'],

            // Invitation Permissions
            ['name' => 'invitation.send', 'category' => 'Invitations', 'description' => 'Send invitations'],
            ['name' => 'invitation.send_agency', 'category' => 'Invitations', 'description' => 'Send invitation to agency'],
            ['name' => 'invitation.send_factory', 'category' => 'Invitations', 'description' => 'Send invitation to factory'],
            ['name' => 'invitation.send_importer', 'category' => 'Invitations', 'description' => 'Send invitation to importer'],
            ['name' => 'invitation.respond', 'category' => 'Invitations', 'description' => 'Respond to invitations'],
            ['name' => 'invitation.cancel', 'category' => 'Invitations', 'description' => 'Cancel invitations'],
            ['name' => 'invitation.view_all', 'category' => 'Invitations', 'description' => 'View all invitations'],

            // Sample Permissions
            ['name' => 'sample.create', 'category' => 'Samples', 'description' => 'Create samples'],
            ['name' => 'sample.submit', 'category' => 'Samples', 'description' => 'Submit samples'],
            ['name' => 'sample.view', 'category' => 'Samples', 'description' => 'View samples'],
            ['name' => 'sample.view_own', 'category' => 'Samples', 'description' => 'View own samples only'],
            ['name' => 'sample.factory_approve', 'category' => 'Samples', 'description' => 'Approve samples as agency (legacy name)'],
            ['name' => 'sample.agency_approve', 'category' => 'Samples', 'description' => 'Approve samples as agency'],
            ['name' => 'sample.approve_agency', 'category' => 'Samples', 'description' => 'Approve samples as agency (alt)'],
            ['name' => 'sample.approve_final', 'category' => 'Samples', 'description' => 'Final sample approval as importer'],
            ['name' => 'sample.reject', 'category' => 'Samples', 'description' => 'Reject samples'],
            ['name' => 'sample.create_auto_rule', 'category' => 'Samples', 'description' => 'Create auto-approval rules'],
            ['name' => 'sample.bulk_approve', 'category' => 'Samples', 'description' => 'Bulk approve samples'],

            // Production Permissions
            ['name' => 'production.initialize', 'category' => 'Production', 'description' => 'Initialize production'],
            ['name' => 'production.submit', 'category' => 'Production', 'description' => 'Submit production updates'],
            ['name' => 'production.view', 'category' => 'Production', 'description' => 'View production'],
            ['name' => 'production.view_own', 'category' => 'Production', 'description' => 'View own production only'],
            ['name' => 'production.view_all', 'category' => 'Production', 'description' => 'View all production'],
            ['name' => 'production.edit', 'category' => 'Production', 'description' => 'Edit production tracking'],
            ['name' => 'production.update', 'category' => 'Production', 'description' => 'Update production progress'],
            ['name' => 'production.delete', 'category' => 'Production', 'description' => 'Delete production records'],
            ['name' => 'production.complete_stage', 'category' => 'Production', 'description' => 'Complete production stages'],

            // Quality Inspection Permissions
            ['name' => 'quality_inspection.view', 'category' => 'Quality Inspections', 'description' => 'View quality inspections'],
            ['name' => 'quality_inspection.create', 'category' => 'Quality Inspections', 'description' => 'Create quality inspections'],
            ['name' => 'quality_inspection.edit', 'category' => 'Quality Inspections', 'description' => 'Edit quality inspections'],
            ['name' => 'quality_inspection.approve', 'category' => 'Quality Inspections', 'description' => 'Approve quality inspections'],
            ['name' => 'quality.create_inspection', 'category' => 'Quality Inspections', 'description' => 'Create quality inspections (legacy)'],
            ['name' => 'quality.view_inspection', 'category' => 'Quality Inspections', 'description' => 'View quality inspections (legacy)'],
            ['name' => 'quality.view_all_inspections', 'category' => 'Quality Inspections', 'description' => 'View all inspections (legacy)'],
            ['name' => 'quality.generate_certificate', 'category' => 'Quality Inspections', 'description' => 'Generate quality certificates'],
            ['name' => 'quality.pass_inspection', 'category' => 'Quality Inspections', 'description' => 'Pass quality inspection'],
            ['name' => 'quality.fail_inspection', 'category' => 'Quality Inspections', 'description' => 'Fail quality inspection'],

            // Shipment Permissions
            ['name' => 'shipment.create', 'category' => 'Shipments', 'description' => 'Create shipments'],
            ['name' => 'shipment.view', 'category' => 'Shipments', 'description' => 'View shipments'],
            ['name' => 'shipment.view_own', 'category' => 'Shipments', 'description' => 'View own shipments only'],
            ['name' => 'shipment.view_all', 'category' => 'Shipments', 'description' => 'View all shipments'],
            ['name' => 'shipment.edit', 'category' => 'Shipments', 'description' => 'Edit shipments'],
            ['name' => 'shipment.update', 'category' => 'Shipments', 'description' => 'Update shipments'],
            ['name' => 'shipment.track', 'category' => 'Shipments', 'description' => 'Track shipments'],
            ['name' => 'shipment.mark_dispatched', 'category' => 'Shipments', 'description' => 'Mark shipment as dispatched'],
            ['name' => 'shipment.mark_delivered', 'category' => 'Shipments', 'description' => 'Mark shipment as delivered'],

            // Admin - User Management
            ['name' => 'admin.users.view', 'category' => 'Admin - Users', 'description' => 'View users in admin panel'],
            ['name' => 'admin.users.create', 'category' => 'Admin - Users', 'description' => 'Create users in admin panel'],
            ['name' => 'admin.users.edit', 'category' => 'Admin - Users', 'description' => 'Edit users in admin panel'],
            ['name' => 'admin.users.delete', 'category' => 'Admin - Users', 'description' => 'Delete users in admin panel'],
            ['name' => 'user.create', 'category' => 'Admin - Users', 'description' => 'Create users (legacy)'],
            ['name' => 'user.edit', 'category' => 'Admin - Users', 'description' => 'Edit users (legacy)'],
            ['name' => 'user.delete', 'category' => 'Admin - Users', 'description' => 'Delete users (legacy)'],
            ['name' => 'user.assign_role', 'category' => 'Admin - Users', 'description' => 'Assign roles to users'],
            ['name' => 'user.impersonate', 'category' => 'Admin - Users', 'description' => 'Impersonate users'],

            // Admin - Role Management
            ['name' => 'admin.roles.view', 'category' => 'Admin - Roles', 'description' => 'View roles in admin panel'],
            ['name' => 'admin.roles.create', 'category' => 'Admin - Roles', 'description' => 'Create roles in admin panel'],
            ['name' => 'admin.roles.edit', 'category' => 'Admin - Roles', 'description' => 'Edit roles in admin panel'],
            ['name' => 'admin.roles.delete', 'category' => 'Admin - Roles', 'description' => 'Delete roles in admin panel'],
            ['name' => 'role.create', 'category' => 'Admin - Roles', 'description' => 'Create roles (legacy)'],
            ['name' => 'role.edit', 'category' => 'Admin - Roles', 'description' => 'Edit roles (legacy)'],
            ['name' => 'role.delete', 'category' => 'Admin - Roles', 'description' => 'Delete roles (legacy)'],
            ['name' => 'role.assign', 'category' => 'Admin - Roles', 'description' => 'Assign roles to users'],

            // Admin - Permission Management
            ['name' => 'admin.permissions.view', 'category' => 'Admin - Permissions', 'description' => 'View permissions in admin panel'],
            ['name' => 'admin.permissions.create', 'category' => 'Admin - Permissions', 'description' => 'Create permissions in admin panel'],
            ['name' => 'admin.permissions.edit', 'category' => 'Admin - Permissions', 'description' => 'Edit permissions in admin panel'],
            ['name' => 'admin.permissions.delete', 'category' => 'Admin - Permissions', 'description' => 'Delete permissions in admin panel'],
            ['name' => 'permission.create', 'category' => 'Admin - Permissions', 'description' => 'Create permissions (legacy)'],
            ['name' => 'permission.assign', 'category' => 'Admin - Permissions', 'description' => 'Assign permissions (legacy)'],

            // Admin - Settings
            ['name' => 'admin.settings.view', 'category' => 'Admin - Settings', 'description' => 'View system settings'],
            ['name' => 'admin.settings.edit', 'category' => 'Admin - Settings', 'description' => 'Edit system settings'],
            ['name' => 'settings.edit', 'category' => 'Admin - Settings', 'description' => 'Edit system settings (legacy)'],
            ['name' => 'settings.manage_status', 'category' => 'Admin - Settings', 'description' => 'Manage status configurations'],

            // Admin - Status Management
            ['name' => 'admin.statuses.view', 'category' => 'Admin - Statuses', 'description' => 'View status configurations'],
            ['name' => 'admin.statuses.create', 'category' => 'Admin - Statuses', 'description' => 'Create status configurations'],
            ['name' => 'admin.statuses.edit', 'category' => 'Admin - Statuses', 'description' => 'Edit status configurations'],
            ['name' => 'admin.statuses.delete', 'category' => 'Admin - Statuses', 'description' => 'Delete status configurations'],

            // Admin - Email Templates
            ['name' => 'admin.email_templates.view', 'category' => 'Admin - Email Templates', 'description' => 'View email templates'],
            ['name' => 'admin.email_templates.create', 'category' => 'Admin - Email Templates', 'description' => 'Create email templates'],
            ['name' => 'admin.email_templates.edit', 'category' => 'Admin - Email Templates', 'description' => 'Edit email templates'],
            ['name' => 'admin.email_templates.delete', 'category' => 'Admin - Email Templates', 'description' => 'Delete email templates'],

            // Admin - Activity Logs
            ['name' => 'admin.activity_logs.view', 'category' => 'Admin - Activity Logs', 'description' => 'View activity logs'],
            ['name' => 'log.view_all', 'category' => 'Admin - Activity Logs', 'description' => 'View all activity logs (legacy)'],

            // Admin - Configuration Management
            ['name' => 'admin.configuration.view', 'category' => 'Admin - Configuration', 'description' => 'View system configuration (Sample Types, Production Stages, AQL Levels, etc.)'],
            ['name' => 'admin.configuration.create', 'category' => 'Admin - Configuration', 'description' => 'Create system configuration items'],
            ['name' => 'admin.configuration.edit', 'category' => 'Admin - Configuration', 'description' => 'Edit system configuration items'],
            ['name' => 'admin.configuration.delete', 'category' => 'Admin - Configuration', 'description' => 'Delete system configuration items'],

            // Admin - Notification Management
            ['name' => 'admin.notifications.view', 'category' => 'Admin - Notifications', 'description' => 'View notification configurations'],
            ['name' => 'admin.notifications.create', 'category' => 'Admin - Notifications', 'description' => 'Create notification configurations'],
            ['name' => 'admin.notifications.edit', 'category' => 'Admin - Notifications', 'description' => 'Edit notification configurations'],
            ['name' => 'admin.notifications.delete', 'category' => 'Admin - Notifications', 'description' => 'Delete notification configurations'],

            // Reports & Analytics
            ['name' => 'reports.view', 'category' => 'Reports', 'description' => 'View reports and analytics'],
            ['name' => 'reports.export', 'category' => 'Reports', 'description' => 'Export reports'],
            ['name' => 'reports.schedule', 'category' => 'Reports', 'description' => 'Schedule automated reports'],
            ['name' => 'report.generate', 'category' => 'Reports', 'description' => 'Generate reports (legacy)'],
        ];

        foreach ($permissions as $permission) {
            // Spatie's Permission::create() throws if the permission already exists,
            // so we must check manually instead of using firstOrCreate().
            if (!Permission::where('name', $permission['name'])->where('guard_name', 'web')->exists()) {
                Permission::create(array_merge($permission, ['guard_name' => 'web']));
            }
        }
    }
}
