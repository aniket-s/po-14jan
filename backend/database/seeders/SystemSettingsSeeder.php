<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // General Settings
            ['key' => 'company_name', 'value' => 'Garment Supply Chain Platform', 'type' => 'string', 'group' => 'general', 'description' => 'Company name', 'is_public' => true],
            ['key' => 'company_logo', 'value' => null, 'type' => 'string', 'group' => 'general', 'description' => 'Company logo URL', 'is_public' => true],
            ['key' => 'contact_email', 'value' => 'contact@example.com', 'type' => 'string', 'group' => 'general', 'description' => 'Contact email', 'is_public' => true],
            ['key' => 'support_email', 'value' => 'support@example.com', 'type' => 'string', 'group' => 'general', 'description' => 'Support email', 'is_public' => true],
            ['key' => 'company_phone', 'value' => null, 'type' => 'string', 'group' => 'general', 'description' => 'Company phone', 'is_public' => true],
            ['key' => 'company_address', 'value' => null, 'type' => 'string', 'group' => 'general', 'description' => 'Company address', 'is_public' => true],
            ['key' => 'company_website', 'value' => null, 'type' => 'string', 'group' => 'general', 'description' => 'Company website', 'is_public' => true],

            // System Settings
            ['key' => 'timezone', 'value' => 'UTC', 'type' => 'string', 'group' => 'system', 'description' => 'System timezone', 'is_public' => false],
            ['key' => 'date_format', 'value' => 'Y-m-d', 'type' => 'string', 'group' => 'system', 'description' => 'Date format', 'is_public' => true],
            ['key' => 'time_format', 'value' => 'H:i:s', 'type' => 'string', 'group' => 'system', 'description' => 'Time format', 'is_public' => true],
            ['key' => 'currency', 'value' => 'USD', 'type' => 'string', 'group' => 'system', 'description' => 'Default currency', 'is_public' => true],
            ['key' => 'language', 'value' => 'en', 'type' => 'string', 'group' => 'system', 'description' => 'Default language', 'is_public' => true],

            // Application Settings
            ['key' => 'app_name', 'value' => 'Garment Supply Chain Platform', 'type' => 'string', 'group' => 'app', 'description' => 'Application name', 'is_public' => true],
            ['key' => 'app_url', 'value' => 'http://localhost:8000', 'type' => 'string', 'group' => 'app', 'description' => 'Application URL', 'is_public' => false],
            ['key' => 'maintenance_mode', 'value' => 'false', 'type' => 'boolean', 'group' => 'app', 'description' => 'Maintenance mode enabled', 'is_public' => false],
            ['key' => 'registration_enabled', 'value' => 'true', 'type' => 'boolean', 'group' => 'app', 'description' => 'User registration enabled', 'is_public' => true],
            ['key' => 'email_verification_required', 'value' => 'true', 'type' => 'boolean', 'group' => 'app', 'description' => 'Email verification required', 'is_public' => false],
            ['key' => 'session_timeout', 'value' => '120', 'type' => 'number', 'group' => 'app', 'description' => 'Session timeout in minutes', 'is_public' => false],

            // PO Configuration
            ['key' => 'po_number_prefix', 'value' => 'ST', 'type' => 'string', 'group' => 'po', 'description' => 'PO number prefix', 'is_public' => false],
            ['key' => 'po_number_format', 'value' => 'YYYYMM', 'type' => 'string', 'group' => 'po', 'description' => 'PO number date format', 'is_public' => false],
            ['key' => 'po_sequence_length', 'value' => '4', 'type' => 'number', 'group' => 'po', 'description' => 'PO sequence number length', 'is_public' => false],
            ['key' => 'po_reset_frequency', 'value' => 'monthly', 'type' => 'string', 'group' => 'po', 'description' => 'PO number reset frequency', 'is_public' => false],
            ['key' => 'po_default_currency', 'value' => 'USD', 'type' => 'string', 'group' => 'po', 'description' => 'Default PO currency', 'is_public' => false],
            ['key' => 'po_max_styles', 'value' => '10000', 'type' => 'number', 'group' => 'po', 'description' => 'Maximum styles per PO', 'is_public' => false],
            ['key' => 'po_enable_excel_import', 'value' => 'true', 'type' => 'boolean', 'group' => 'po', 'description' => 'Enable Excel import', 'is_public' => false],
            ['key' => 'po_enable_direct_factory', 'value' => 'true', 'type' => 'boolean', 'group' => 'po', 'description' => 'Enable direct factory assignment', 'is_public' => false],
            ['key' => 'po_enable_mixed_assignments', 'value' => 'true', 'type' => 'boolean', 'group' => 'po', 'description' => 'Enable mixed assignment types in same PO', 'is_public' => false],
            ['key' => 'agency_style_upload_enabled', 'value' => 'true', 'type' => 'boolean', 'group' => 'po', 'description' => 'Allow agencies to upload/create styles', 'is_public' => true],

            // Sample Configuration
            ['key' => 'sample_enable_parallel', 'value' => 'true', 'type' => 'boolean', 'group' => 'sample', 'description' => 'Enable parallel sample submission', 'is_public' => false],
            ['key' => 'sample_max_versions', 'value' => '10', 'type' => 'number', 'group' => 'sample', 'description' => 'Maximum sample versions', 'is_public' => false],
            ['key' => 'sample_auto_reject_days', 'value' => '30', 'type' => 'number', 'group' => 'sample', 'description' => 'Auto-reject samples after days', 'is_public' => false],
            ['key' => 'sample_enable_auto_approval', 'value' => 'true', 'type' => 'boolean', 'group' => 'sample', 'description' => 'Enable auto-approval rules', 'is_public' => false],
            ['key' => 'sample_max_images', 'value' => '10', 'type' => 'number', 'group' => 'sample', 'description' => 'Maximum images per sample', 'is_public' => false],
            ['key' => 'sample_max_image_size', 'value' => '10240', 'type' => 'number', 'group' => 'sample', 'description' => 'Max image size in KB', 'is_public' => false],

            // Production Configuration
            ['key' => 'production_require_samples', 'value' => 'true', 'type' => 'boolean', 'group' => 'production', 'description' => 'Require samples approved before production', 'is_public' => false],
            ['key' => 'production_stages_in_order', 'value' => 'true', 'type' => 'boolean', 'group' => 'production', 'description' => 'Stages must be completed in order', 'is_public' => false],
            ['key' => 'production_allow_overlapping', 'value' => 'false', 'type' => 'boolean', 'group' => 'production', 'description' => 'Allow overlapping stages', 'is_public' => false],
            ['key' => 'production_require_daily_updates', 'value' => 'true', 'type' => 'boolean', 'group' => 'production', 'description' => 'Require daily production updates', 'is_public' => false],
            ['key' => 'production_alert_delay_days', 'value' => '3', 'type' => 'number', 'group' => 'production', 'description' => 'Alert when production delayed by days', 'is_public' => false],

            // Quality Configuration
            ['key' => 'quality_default_aql', 'value' => '2.5', 'type' => 'string', 'group' => 'quality', 'description' => 'Default AQL level', 'is_public' => false],
            ['key' => 'quality_enable_certificate_auto', 'value' => 'true', 'type' => 'boolean', 'group' => 'quality', 'description' => 'Auto-generate certificates', 'is_public' => false],
            ['key' => 'quality_certificate_prefix', 'value' => 'QC', 'type' => 'string', 'group' => 'quality', 'description' => 'Certificate number prefix', 'is_public' => false],

            // Shipment Configuration
            ['key' => 'shipment_number_prefix', 'value' => 'SH', 'type' => 'string', 'group' => 'shipment', 'description' => 'Shipment number prefix', 'is_public' => false],
            ['key' => 'shipment_enable_public_tracking', 'value' => 'true', 'type' => 'boolean', 'group' => 'shipment', 'description' => 'Enable public shipment tracking', 'is_public' => true],
            ['key' => 'shipment_notify_on_dispatch', 'value' => 'true', 'type' => 'boolean', 'group' => 'shipment', 'description' => 'Notify on shipment dispatch', 'is_public' => false],
            ['key' => 'shipment_notify_on_delivery', 'value' => 'true', 'type' => 'boolean', 'group' => 'shipment', 'description' => 'Notify on shipment delivery', 'is_public' => false],

            // File Storage
            ['key' => 'storage_max_file_size', 'value' => '10240', 'type' => 'number', 'group' => 'storage', 'description' => 'Max file size in KB', 'is_public' => false],
            ['key' => 'storage_max_files_per_upload', 'value' => '10', 'type' => 'number', 'group' => 'storage', 'description' => 'Max files per upload', 'is_public' => false],
            ['key' => 'storage_allowed_image_types', 'value' => 'jpg,jpeg,png,gif', 'type' => 'string', 'group' => 'storage', 'description' => 'Allowed image types', 'is_public' => false],
            ['key' => 'storage_allowed_document_types', 'value' => 'pdf,docx,xlsx,csv', 'type' => 'string', 'group' => 'storage', 'description' => 'Allowed document types', 'is_public' => false],

            // Invitation Configuration
            ['key' => 'invitation_expiry_days', 'value' => '7', 'type' => 'number', 'group' => 'invitation', 'description' => 'Invitation expiry in days', 'is_public' => false],

            // Email Configuration
            ['key' => 'email_from_address', 'value' => 'noreply@garmentplatform.com', 'type' => 'string', 'group' => 'email', 'description' => 'Default sender email address', 'is_public' => false],
            ['key' => 'email_from_name', 'value' => 'Garment Supply Chain Platform', 'type' => 'string', 'group' => 'email', 'description' => 'Default sender name', 'is_public' => false],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->insertOrIgnore(array_merge($setting, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
