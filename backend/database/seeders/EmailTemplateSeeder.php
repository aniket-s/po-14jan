<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EmailTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            // Invitation Templates
            [
                'name' => 'invitation_to_agency',
                'display_name' => 'Invitation to Agency',
                'type' => 'invitation',
                'subject' => 'You have been invited to manage PO {{po_number}}',
                'body_html' => $this->getInvitationToAgencyTemplate(),
                'available_variables' => json_encode(['importer_name', 'importer_company', 'po_number', 'style_count', 'total_quantity', 'invitation_url', 'message']),
                'description' => 'Sent when importer invites an agency to manage a PO',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_to_factory',
                'display_name' => 'Invitation to Factory',
                'type' => 'invitation',
                'subject' => 'Production invitation for {{style_count}} styles',
                'body_html' => $this->getInvitationToFactoryTemplate(),
                'available_variables' => json_encode(['sender_name', 'sender_company', 'style_count', 'total_quantity', 'total_value', 'invitation_url', 'message']),
                'description' => 'Sent when factory is invited to produce styles',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_to_factory_direct',
                'display_name' => 'Invitation to Factory (Direct)',
                'type' => 'invitation',
                'subject' => 'You have been invited to produce for PO {{po_number}}',
                'body_html' => $this->getInvitationToFactoryDirectTemplate(),
                'available_variables' => json_encode(['inviter_name', 'inviter_company', 'po_number', 'brand_name', 'invitation_url', 'expires_at', 'custom_message']),
                'description' => 'Sent when importer invites factory directly',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_to_factory_via_agency',
                'display_name' => 'Invitation to Factory (via Agency)',
                'type' => 'invitation',
                'subject' => 'Production invitation from {{inviter_company}} - PO {{po_number}}',
                'body_html' => $this->getInvitationToFactoryViaAgencyTemplate(),
                'available_variables' => json_encode(['inviter_name', 'inviter_company', 'po_number', 'brand_name', 'invitation_url', 'expires_at', 'custom_message']),
                'description' => 'Sent when agency invites factory',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_to_inspector',
                'display_name' => 'Invitation to Quality Inspector',
                'type' => 'invitation',
                'subject' => 'Quality inspection invitation - PO {{po_number}}',
                'body_html' => $this->getInvitationToInspectorTemplate(),
                'available_variables' => json_encode(['inviter_name', 'inviter_company', 'po_number', 'brand_name', 'invitation_url', 'expires_at', 'custom_message']),
                'description' => 'Sent when inspector is invited for quality inspection',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_accepted',
                'display_name' => 'Invitation Accepted',
                'type' => 'invitation',
                'subject' => '{{recipient_name}} accepted your invitation',
                'body_html' => $this->getInvitationAcceptedTemplate(),
                'available_variables' => json_encode(['recipient_name', 'recipient_company', 'po_number', 'style_count']),
                'description' => 'Sent when invitation is accepted',
                'is_active' => true,
            ],
            [
                'name' => 'invitation_rejected',
                'display_name' => 'Invitation Rejected',
                'type' => 'invitation',
                'subject' => '{{recipient_name}} declined your invitation',
                'body_html' => $this->getInvitationRejectedTemplate(),
                'available_variables' => json_encode(['recipient_name', 'recipient_company', 'po_number', 'rejection_reason']),
                'description' => 'Sent when invitation is rejected',
                'is_active' => true,
            ],

            // Sample Templates
            [
                'name' => 'sample_submitted',
                'display_name' => 'Sample Submitted',
                'type' => 'sample',
                'subject' => 'New {{sample_type}} submitted for {{style_number}}',
                'body_html' => $this->getSampleSubmittedTemplate(),
                'available_variables' => json_encode(['sample_type', 'style_number', 'style_color', 'po_number', 'factory_name', 'action_url']),
                'description' => 'Sent when factory submits a sample',
                'is_active' => true,
            ],
            [
                'name' => 'sample_approved_by_agency',
                'display_name' => 'Sample Approved by Agency',
                'type' => 'sample',
                'subject' => '{{sample_type}} approved by agency - {{style_number}}',
                'body_html' => $this->getSampleApprovedAgencyTemplate(),
                'available_variables' => json_encode(['sample_type', 'style_number', 'agency_name', 'feedback', 'action_url']),
                'description' => 'Sent when agency approves a sample',
                'is_active' => true,
            ],
            [
                'name' => 'sample_rejected',
                'display_name' => 'Sample Rejected',
                'type' => 'sample',
                'subject' => '{{sample_type}} rejected - {{style_number}}',
                'body_html' => $this->getSampleRejectedTemplate(),
                'available_variables' => json_encode(['sample_type', 'style_number', 'rejected_by', 'rejection_reason', 'action_url']),
                'description' => 'Sent when sample is rejected',
                'is_active' => true,
            ],
            [
                'name' => 'sample_approved_final',
                'display_name' => 'Sample Final Approval',
                'type' => 'sample',
                'subject' => '{{sample_type}} approved - {{style_number}}',
                'body_html' => $this->getSampleApprovedFinalTemplate(),
                'available_variables' => json_encode(['sample_type', 'style_number', 'po_number', 'importer_name', 'action_url']),
                'description' => 'Sent when importer gives final sample approval',
                'is_active' => true,
            ],

            // Production Templates
            [
                'name' => 'production_initialized',
                'display_name' => 'Production Started',
                'type' => 'production',
                'subject' => 'Production started for {{style_number}}',
                'body_html' => $this->getProductionInitializedTemplate(),
                'available_variables' => json_encode(['style_number', 'po_number', 'factory_name', 'planned_completion_date', 'action_url']),
                'description' => 'Sent when production is initialized',
                'is_active' => true,
            ],
            [
                'name' => 'production_delayed',
                'display_name' => 'Production Delayed',
                'type' => 'production',
                'subject' => 'ALERT: Production delayed - {{style_number}}',
                'body_html' => $this->getProductionDelayedTemplate(),
                'available_variables' => json_encode(['style_number', 'po_number', 'delay_days', 'current_stage', 'action_url']),
                'description' => 'Sent when production is delayed',
                'is_active' => true,
            ],
            [
                'name' => 'production_completed',
                'display_name' => 'Production Completed',
                'type' => 'production',
                'subject' => 'Production completed - {{style_number}}',
                'body_html' => $this->getProductionCompletedTemplate(),
                'available_variables' => json_encode(['style_number', 'po_number', 'total_quantity', 'completion_date', 'action_url']),
                'description' => 'Sent when production is completed',
                'is_active' => true,
            ],

            // Quality Templates
            [
                'name' => 'inspection_passed',
                'display_name' => 'Quality Inspection Passed',
                'type' => 'quality',
                'subject' => 'Quality inspection passed - {{style_number}}',
                'body_html' => $this->getInspectionPassedTemplate(),
                'available_variables' => json_encode(['style_number', 'inspection_certificate_number', 'aql_level', 'lot_size', 'action_url']),
                'description' => 'Sent when quality inspection passes',
                'is_active' => true,
            ],
            [
                'name' => 'inspection_failed',
                'display_name' => 'Quality Inspection Failed',
                'type' => 'quality',
                'subject' => 'ALERT: Quality inspection failed - {{style_number}}',
                'body_html' => $this->getInspectionFailedTemplate(),
                'available_variables' => json_encode(['style_number', 'critical_defects', 'major_defects', 'minor_defects', 'action_url']),
                'description' => 'Sent when quality inspection fails',
                'is_active' => true,
            ],

            // Shipment Templates
            [
                'name' => 'shipment_dispatched',
                'display_name' => 'Shipment Dispatched',
                'type' => 'shipment',
                'subject' => 'Shipment dispatched - {{shipment_reference}}',
                'body_html' => $this->getShipmentDispatchedTemplate(),
                'available_variables' => json_encode(['shipment_reference', 'tracking_number', 'shipment_method', 'estimated_dispatch_date', 'estimated_delivery_date', 'tracking_url']),
                'description' => 'Sent when shipment is dispatched',
                'is_active' => true,
            ],
            [
                'name' => 'shipment_delivered',
                'display_name' => 'Shipment Delivered',
                'type' => 'shipment',
                'subject' => 'Shipment delivered - {{shipment_reference}}',
                'body_html' => $this->getShipmentDeliveredTemplate(),
                'available_variables' => json_encode(['shipment_reference', 'delivery_date', 'total_cartons', 'action_url']),
                'description' => 'Sent when shipment is delivered',
                'is_active' => true,
            ],

            // User Templates
            [
                'name' => 'user_welcome',
                'display_name' => 'Welcome Email',
                'type' => 'user',
                'subject' => 'Welcome to {{company_name}}',
                'body_html' => $this->getUserWelcomeTemplate(),
                'available_variables' => json_encode(['user_name', 'user_email', 'company_name', 'login_url']),
                'description' => 'Sent to new users',
                'is_active' => true,
            ],
        ];

        foreach ($templates as $template) {
            DB::table('email_templates')->insertOrIgnore(array_merge($template, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    private function getInvitationToAgencyTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Purchase Order Assignment</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>{{importer_name}} from {{importer_company}} has invited you to manage their purchase order.</p>
            <h3>PO Details:</h3>
            <ul>
                <li><strong>PO Number:</strong> {{po_number}}</li>
                <li><strong>Total Styles:</strong> {{style_count}}</li>
                <li><strong>Total Quantity:</strong> {{total_quantity}} pieces</li>
            </ul>
            {{#if message}}
            <p><strong>Message from importer:</strong><br>{{message}}</p>
            {{/if}}
            <a href="{{invitation_url}}" class="button">Accept Invitation</a>
        </div>
        <div class="footer">
            <p>This invitation expires in 7 days.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }

    private function getInvitationToFactoryTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#10b981;color:white;padding:20px;text-align:center}.content{background:#f9fafb;padding:30px;border-radius:5px;margin:20px 0}.button{display:inline-block;padding:12px 30px;background:#10b981;color:white;text-decoration:none;border-radius:5px;margin:20px 0}</style></head>
<body>
    <div class="container">
        <div class="header"><h1>Production Invitation</h1></div>
        <div class="content">
            <p>Hello,</p>
            <p>{{sender_name}} from {{sender_company}} has invited you to produce garments.</p>
            <h3>Order Details:</h3>
            <ul>
                <li><strong>Styles:</strong> {{style_count}}</li>
                <li><strong>Total Quantity:</strong> {{total_quantity}} pieces</li>
                <li><strong>Total Value:</strong> ${{total_value}}</li>
            </ul>
            <a href="{{invitation_url}}" class="button">View Details & Accept</a>
        </div>
    </div>
</body>
</html>
HTML;
    }

    private function getInvitationAcceptedTemplate(): string
    {
        return '<html><body><p>Good news! {{recipient_name}} from {{recipient_company}} has accepted your invitation for PO {{po_number}}.</p></body></html>';
    }

    private function getInvitationRejectedTemplate(): string
    {
        return '<html><body><p>{{recipient_name}} from {{recipient_company}} has declined your invitation for PO {{po_number}}.</p><p>Reason: {{rejection_reason}}</p></body></html>';
    }

    private function getSampleSubmittedTemplate(): string
    {
        return '<html><body><h2>New Sample Submitted</h2><p>{{factory_name}} has submitted {{sample_type}} for style {{style_number}} ({{style_color}}).</p><p>PO: {{po_number}}</p><a href="{{action_url}}">Review Sample</a></body></html>';
    }

    private function getSampleApprovedAgencyTemplate(): string
    {
        return '<html><body><h2>Sample Approved by Agency</h2><p>{{agency_name}} has approved {{sample_type}} for style {{style_number}}.</p><p>Feedback: {{feedback}}</p><a href="{{action_url}}">View Details</a></body></html>';
    }

    private function getSampleRejectedTemplate(): string
    {
        return '<html><body><h2>Sample Rejected</h2><p>{{sample_type}} for style {{style_number}} has been rejected by {{rejected_by}}.</p><p>Reason: {{rejection_reason}}</p><a href="{{action_url}}">View & Resubmit</a></body></html>';
    }

    private function getSampleApprovedFinalTemplate(): string
    {
        return '<html><body><h2>Sample Approved - Ready for Production</h2><p>{{importer_name}} has given final approval for {{sample_type}} - Style {{style_number}}.</p><p>You can now proceed with production.</p><a href="{{action_url}}">Start Production</a></body></html>';
    }

    private function getProductionInitializedTemplate(): string
    {
        return '<html><body><h2>Production Started</h2><p>{{factory_name}} has started production for style {{style_number}}.</p><p>PO: {{po_number}}</p><p>Planned Completion: {{planned_completion_date}}</p><a href="{{action_url}}">Track Progress</a></body></html>';
    }

    private function getProductionDelayedTemplate(): string
    {
        return '<html><body><h2 style="color:#ef4444">Production Delayed</h2><p>Style {{style_number}} (PO {{po_number}}) is delayed by {{delay_days}} days.</p><p>Current Stage: {{current_stage}}</p><a href="{{action_url}}">View Details</a></body></html>';
    }

    private function getProductionCompletedTemplate(): string
    {
        return '<html><body><h2>Production Completed</h2><p>Production completed for style {{style_number}} ({{total_quantity}} pieces).</p><p>Completion Date: {{completion_date}}</p><a href="{{action_url}}">View Details</a></body></html>';
    }

    private function getInspectionPassedTemplate(): string
    {
        return '<html><body><h2 style="color:#22c55e">Quality Inspection Passed</h2><p>Style {{style_number}} passed quality inspection (AQL {{aql_level}}).</p><p>Certificate: {{inspection_certificate_number}}</p><p>Lot Size: {{lot_size}}</p><a href="{{action_url}}">Download Certificate</a></body></html>';
    }

    private function getInspectionFailedTemplate(): string
    {
        return '<html><body><h2 style="color:#ef4444">Quality Inspection Failed</h2><p>Style {{style_number}} failed quality inspection.</p><p>Defects Found:</p><ul><li>Critical: {{critical_defects}}</li><li>Major: {{major_defects}}</li><li>Minor: {{minor_defects}}</li></ul><a href="{{action_url}}">View Report</a></body></html>';
    }

    private function getShipmentDispatchedTemplate(): string
    {
        return '<html><body><h2>Shipment Dispatched</h2><p>Shipment {{shipment_reference}} has been dispatched via {{shipment_method}}.</p><p>Tracking: {{tracking_number}}</p><p>Estimated Dispatch: {{estimated_dispatch_date}} | Estimated Delivery: {{estimated_delivery_date}}</p><a href="{{tracking_url}}">Track Shipment</a></body></html>';
    }

    private function getShipmentDeliveredTemplate(): string
    {
        return '<html><body><h2>Shipment Delivered</h2><p>Shipment {{shipment_reference}} has been delivered.</p><p>Delivery Date: {{delivery_date}}</p><p>Cartons: {{total_cartons}}</p><a href="{{action_url}}">View Details</a></body></html>';
    }

    private function getUserWelcomeTemplate(): string
    {
        return '<html><body><h2>Welcome to {{company_name}}</h2><p>Hello {{user_name}},</p><p>Your account has been created successfully.</p><p>Email: {{user_email}}</p><a href="{{login_url}}">Login Now</a></body></html>';
    }

    private function getInvitationToFactoryDirectTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Production Invitation</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>{{inviter_name}} from {{inviter_company}} has invited you to produce garments for their purchase order.</p>
            <h3>PO Details:</h3>
            <ul>
                <li><strong>PO Number:</strong> {{po_number}}</li>
                <li><strong>Brand:</strong> {{brand_name}}</li>
            </ul>
            {{#if custom_message}}
            <p><strong>Message:</strong><br>{{custom_message}}</p>
            {{/if}}
            <a href="{{invitation_url}}" class="button">View Details & Accept</a>
        </div>
        <div class="footer">
            <p>This invitation expires on {{expires_at}}.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }

    private function getInvitationToFactoryViaAgencyTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        .badge { display: inline-block; padding: 4px 8px; background: #fbbf24; color: #78350f; border-radius: 3px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Production Invitation</h1>
            <span class="badge">Via Agency</span>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>{{inviter_name}} from {{inviter_company}} (Agency) has invited you to produce garments for their client's purchase order.</p>
            <h3>PO Details:</h3>
            <ul>
                <li><strong>PO Number:</strong> {{po_number}}</li>
                <li><strong>Brand:</strong> {{brand_name}}</li>
                <li><strong>Managing Agency:</strong> {{inviter_company}}</li>
            </ul>
            {{#if custom_message}}
            <p><strong>Message:</strong><br>{{custom_message}}</p>
            {{/if}}
            <a href="{{invitation_url}}" class="button">View Details & Accept</a>
        </div>
        <div class="footer">
            <p>This invitation expires on {{expires_at}}.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }

    private function getInvitationToInspectorTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Quality Inspection Invitation</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>{{inviter_name}} from {{inviter_company}} has invited you to perform quality inspections for their purchase order.</p>
            <h3>PO Details:</h3>
            <ul>
                <li><strong>PO Number:</strong> {{po_number}}</li>
                <li><strong>Brand:</strong> {{brand_name}}</li>
            </ul>
            {{#if custom_message}}
            <p><strong>Message:</strong><br>{{custom_message}}</p>
            {{/if}}
            <p>As a quality inspector, you will be responsible for conducting inspections and ensuring products meet quality standards.</p>
            <a href="{{invitation_url}}" class="button">View Details & Accept</a>
        </div>
        <div class="footer">
            <p>This invitation expires on {{expires_at}}.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }
}
