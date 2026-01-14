<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemStatusSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $statuses = [
            // Purchase Order Statuses
            ['type' => 'po_status', 'value' => 'draft', 'label' => 'Draft', 'color' => '#94a3b8', 'icon' => 'file-text', 'display_order' => 1, 'transition_rules' => json_encode(['pending_agency', 'pending_factory', 'pending_assignments']), 'description' => 'PO is being created'],
            ['type' => 'po_status', 'value' => 'pending_agency', 'label' => 'Pending Agency', 'color' => '#fbbf24', 'icon' => 'clock', 'display_order' => 2, 'transition_rules' => json_encode(['active', 'cancelled']), 'description' => 'Waiting for agency assignment'],
            ['type' => 'po_status', 'value' => 'pending_factory', 'label' => 'Pending Factory', 'color' => '#fbbf24', 'icon' => 'clock', 'display_order' => 3, 'transition_rules' => json_encode(['active', 'cancelled']), 'description' => 'Waiting for factory assignments'],
            ['type' => 'po_status', 'value' => 'pending_assignments', 'label' => 'Pending Assignments', 'color' => '#f97316', 'icon' => 'alert-circle', 'display_order' => 4, 'transition_rules' => json_encode(['active', 'cancelled']), 'description' => 'Some styles still unassigned'],
            ['type' => 'po_status', 'value' => 'active', 'label' => 'Active', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 5, 'transition_rules' => json_encode(['completed', 'cancelled']), 'description' => 'PO is active and in production'],
            ['type' => 'po_status', 'value' => 'completed', 'label' => 'Completed', 'color' => '#6366f1', 'icon' => 'check-circle-2', 'display_order' => 6, 'transition_rules' => json_encode([]), 'description' => 'PO fully completed'],
            ['type' => 'po_status', 'value' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444', 'icon' => 'x-circle', 'display_order' => 7, 'transition_rules' => json_encode([]), 'description' => 'PO cancelled'],

            // Sample Statuses
            ['type' => 'sample_status', 'value' => 'submitted', 'label' => 'Submitted', 'color' => '#3b82f6', 'icon' => 'upload', 'display_order' => 1, 'transition_rules' => json_encode(['approved_by_agency', 'rejected_by_agency', 'approved_by_importer', 'rejected_by_importer']), 'description' => 'Sample submitted by factory'],
            ['type' => 'sample_status', 'value' => 'approved_by_agency', 'label' => 'Approved by Agency', 'color' => '#10b981', 'icon' => 'check', 'display_order' => 2, 'transition_rules' => json_encode(['approved_by_importer', 'rejected_by_importer']), 'description' => 'Agency approved sample'],
            ['type' => 'sample_status', 'value' => 'rejected_by_agency', 'label' => 'Rejected by Agency', 'color' => '#ef4444', 'icon' => 'x', 'display_order' => 3, 'transition_rules' => json_encode(['submitted']), 'description' => 'Agency rejected sample'],
            ['type' => 'sample_status', 'value' => 'approved_by_importer', 'label' => 'Approved', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 4, 'transition_rules' => json_encode([]), 'description' => 'Importer approved sample'],
            ['type' => 'sample_status', 'value' => 'rejected_by_importer', 'label' => 'Rejected', 'color' => '#dc2626', 'icon' => 'x-circle', 'display_order' => 5, 'transition_rules' => json_encode(['submitted']), 'description' => 'Importer rejected sample'],

            // Production Statuses
            ['type' => 'production_status', 'value' => 'not_started', 'label' => 'Not Started', 'color' => '#94a3b8', 'icon' => 'circle', 'display_order' => 1, 'transition_rules' => json_encode(['in_progress']), 'description' => 'Production not yet started'],
            ['type' => 'production_status', 'value' => 'in_progress', 'label' => 'In Progress', 'color' => '#3b82f6', 'icon' => 'play-circle', 'display_order' => 2, 'transition_rules' => json_encode(['completed', 'on_hold', 'delayed']), 'description' => 'Production ongoing'],
            ['type' => 'production_status', 'value' => 'on_hold', 'label' => 'On Hold', 'color' => '#f59e0b', 'icon' => 'pause-circle', 'display_order' => 3, 'transition_rules' => json_encode(['in_progress', 'cancelled']), 'description' => 'Production paused'],
            ['type' => 'production_status', 'value' => 'delayed', 'label' => 'Delayed', 'color' => '#f97316', 'icon' => 'alert-triangle', 'display_order' => 4, 'transition_rules' => json_encode(['in_progress', 'completed']), 'description' => 'Production behind schedule'],
            ['type' => 'production_status', 'value' => 'completed', 'label' => 'Completed', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 5, 'transition_rules' => json_encode([]), 'description' => 'Production finished'],
            ['type' => 'production_status', 'value' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444', 'icon' => 'x-circle', 'display_order' => 6, 'transition_rules' => json_encode([]), 'description' => 'Production cancelled'],

            // Factory Assignment Statuses
            ['type' => 'assignment_status', 'value' => 'invited', 'label' => 'Invited', 'color' => '#fbbf24', 'icon' => 'mail', 'display_order' => 1, 'transition_rules' => json_encode(['accepted', 'rejected']), 'description' => 'Factory invited'],
            ['type' => 'assignment_status', 'value' => 'accepted', 'label' => 'Accepted', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 2, 'transition_rules' => json_encode([]), 'description' => 'Factory accepted'],
            ['type' => 'assignment_status', 'value' => 'rejected', 'label' => 'Rejected', 'color' => '#ef4444', 'icon' => 'x-circle', 'display_order' => 3, 'transition_rules' => json_encode(['invited']), 'description' => 'Factory rejected'],

            // Shipment Statuses
            ['type' => 'shipment_status', 'value' => 'preparing', 'label' => 'Preparing', 'color' => '#94a3b8', 'icon' => 'package', 'display_order' => 1, 'transition_rules' => json_encode(['dispatched']), 'description' => 'Shipment being prepared'],
            ['type' => 'shipment_status', 'value' => 'dispatched', 'label' => 'Dispatched', 'color' => '#3b82f6', 'icon' => 'truck', 'display_order' => 2, 'transition_rules' => json_encode(['in_transit']), 'description' => 'Shipment dispatched'],
            ['type' => 'shipment_status', 'value' => 'in_transit', 'label' => 'In Transit', 'color' => '#f59e0b', 'icon' => 'navigation', 'display_order' => 3, 'transition_rules' => json_encode(['arrived']), 'description' => 'Shipment in transit'],
            ['type' => 'shipment_status', 'value' => 'arrived', 'label' => 'Arrived', 'color' => '#10b981', 'icon' => 'map-pin', 'display_order' => 4, 'transition_rules' => json_encode(['delivered']), 'description' => 'Shipment arrived at destination'],
            ['type' => 'shipment_status', 'value' => 'delivered', 'label' => 'Delivered', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 5, 'transition_rules' => json_encode([]), 'description' => 'Shipment delivered'],

            // Quality Inspection Statuses
            ['type' => 'inspection_status', 'value' => 'pending', 'label' => 'Pending', 'color' => '#fbbf24', 'icon' => 'clock', 'display_order' => 1, 'transition_rules' => json_encode(['in_progress']), 'description' => 'Inspection pending'],
            ['type' => 'inspection_status', 'value' => 'in_progress', 'label' => 'In Progress', 'color' => '#3b82f6', 'icon' => 'search', 'display_order' => 2, 'transition_rules' => json_encode(['passed', 'failed']), 'description' => 'Inspection ongoing'],
            ['type' => 'inspection_status', 'value' => 'passed', 'label' => 'Passed', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 3, 'transition_rules' => json_encode([]), 'description' => 'Inspection passed'],
            ['type' => 'inspection_status', 'value' => 'failed', 'label' => 'Failed', 'color' => '#ef4444', 'icon' => 'x-circle', 'display_order' => 4, 'transition_rules' => json_encode(['in_progress']), 'description' => 'Inspection failed'],

            // Invitation Statuses
            ['type' => 'invitation_status', 'value' => 'pending', 'label' => 'Pending', 'color' => '#fbbf24', 'icon' => 'clock', 'display_order' => 1, 'transition_rules' => json_encode(['accepted', 'rejected', 'expired']), 'description' => 'Invitation pending'],
            ['type' => 'invitation_status', 'value' => 'accepted', 'label' => 'Accepted', 'color' => '#22c55e', 'icon' => 'check-circle', 'display_order' => 2, 'transition_rules' => json_encode([]), 'description' => 'Invitation accepted'],
            ['type' => 'invitation_status', 'value' => 'rejected', 'label' => 'Rejected', 'color' => '#ef4444', 'icon' => 'x-circle', 'display_order' => 3, 'transition_rules' => json_encode([]), 'description' => 'Invitation rejected'],
            ['type' => 'invitation_status', 'value' => 'expired', 'label' => 'Expired', 'color' => '#94a3b8', 'icon' => 'clock', 'display_order' => 4, 'transition_rules' => json_encode([]), 'description' => 'Invitation expired'],
        ];

        foreach ($statuses as $status) {
            DB::table('system_statuses')->insert(array_merge($status, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
