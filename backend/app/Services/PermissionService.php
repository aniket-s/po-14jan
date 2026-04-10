<?php

namespace App\Services;

use App\Models\User;
use App\Models\FactoryAssignment;
use Illuminate\Database\Eloquent\Model;

class PermissionService
{
    /**
     * Check if user can access a specific PO
     */
    public function canAccessPO(User $user, $po): bool
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Check if user has permission to view all POs
        if ($user->hasPermissionTo('po.view_all')) {
            return true;
        }

        // Read-only view permission (Viewer, Quality Inspector) — can see all POs
        if ($user->hasPermissionTo('po.view')) {
            return true;
        }

        // Check if user has permission to view own POs
        if ($user->hasPermissionTo('po.view_own')) {
            // User is the importer
            if ($po->importer_id === $user->id) {
                return true;
            }

            // User is the PO creator
            if ($po->creator_id === $user->id) {
                return true;
            }

            // User is the assigned agency
            if ($po->agency_id === $user->id) {
                return true;
            }

            // User is assigned factory for any style in this PO (via pivot)
            if ($po->styles()->where('purchase_order_style.assigned_factory_id', $user->id)->exists()) {
                return true;
            }

            // User has an accepted factory assignment for this PO (via invitation)
            if ($po->factoryAssignments()->where('factory_id', $user->id)->where('status', 'accepted')->exists()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Alias for canAccessPO() - used by Production, Shipment, and QualityInspection controllers.
     */
    public function canAccessPurchaseOrder(User $user, $po): bool
    {
        return $this->canAccessPO($user, $po);
    }

    /**
     * Check if user can access a specific style
     */
    public function canAccessStyle(User $user, $style): bool
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Read-only view permission (Viewer, Quality Inspector) — can see all styles
        if ($user->hasPermissionTo('style.view')) {
            return true;
        }

        // Factory assigned directly to this style
        if ($style->assigned_factory_id === $user->id) {
            return true;
        }

        // Agency assigned directly to this style
        if ($style->assigned_agency_id === $user->id) {
            return true;
        }

        // Style creator
        if ($style->created_by === $user->id) {
            return true;
        }

        // Check via direct PO relationship
        if ($style->purchaseOrder) {
            if ($this->canAccessPO($user, $style->purchaseOrder)) {
                return true;
            }
        }

        // Check via many-to-many PO relationship (pivot table)
        if ($style->purchaseOrders()->exists()) {
            foreach ($style->purchaseOrders as $po) {
                if ($this->canAccessPO($user, $po)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if user can access a specific sample
     */
    public function canAccessSample(User $user, $sample): bool
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Check if user has permission to view all samples
        if ($user->hasPermissionTo('sample.view')) {
            return $this->canAccessStyle($user, $sample->style);
        }

        // Factory who submitted
        if ($sample->submitted_by === $user->id) {
            return true;
        }

        return false;
    }

    /**
     * Check if user can access production tracking
     */
    public function canAccessProduction(User $user, $production): bool
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Check if user has permission to view all production
        if ($user->hasPermissionTo('production.view_all')) {
            return true;
        }

        // Check via style access
        if ($user->hasPermissionTo('production.view_own')) {
            return $this->canAccessStyle($user, $production->style);
        }

        return false;
    }

    /**
     * Check if user can access shipment
     */
    public function canAccessShipment(User $user, $shipment): bool
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Check if user has permission to view all shipments
        if ($user->hasPermissionTo('shipment.view_all')) {
            return true;
        }

        // Factory who created the shipment
        if ($shipment->factory_id === $user->id) {
            return true;
        }

        // Check if user can access any of the styles in this shipment
        if ($user->hasPermissionTo('shipment.view_own')) {
            // Get style IDs from shipment items
            $shipmentItems = $shipment->items()->with('style')->get();
            foreach ($shipmentItems as $item) {
                if ($item->style && $this->canAccessStyle($user, $item->style)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get list of accessible PO IDs for a user
     */
    public function getAccessiblePOIds(User $user): array
    {
        // Super admin can access everything
        if ($user->hasRole('Super Admin') || $user->hasPermissionTo('po.view_all')) {
            return \App\Models\PurchaseOrder::pluck('id')->toArray();
        }

        // Read-only view permission (Viewer, Quality Inspector) — can see all POs
        if ($user->hasPermissionTo('po.view')) {
            return \App\Models\PurchaseOrder::pluck('id')->toArray();
        }

        $poIds = [];

        if ($user->hasPermissionTo('po.view_own')) {
            // POs where user is importer
            $importerPOs = \App\Models\PurchaseOrder::where('importer_id', $user->id)->pluck('id')->toArray();

            // POs where user is creator
            $creatorPOs = \App\Models\PurchaseOrder::where('creator_id', $user->id)->pluck('id')->toArray();

            // POs where user is agency
            $agencyPOs = \App\Models\PurchaseOrder::where('agency_id', $user->id)->pluck('id')->toArray();

            // POs where user is assigned factory (via pivot table)
            $factoryPOs = \App\Models\PurchaseOrder::whereHas('styles', function ($query) use ($user) {
                $query->where('purchase_order_style.assigned_factory_id', $user->id);
            })->pluck('id')->toArray();

            // POs where user has an accepted factory assignment (via invitation)
            $factoryAssignmentPOs = FactoryAssignment::where('factory_id', $user->id)
                ->where('status', 'accepted')
                ->pluck('purchase_order_id')
                ->toArray();

            $poIds = array_unique(array_merge($importerPOs, $creatorPOs, $agencyPOs, $factoryPOs, $factoryAssignmentPOs));
        }

        return $poIds;
    }
}
