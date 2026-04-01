<?php

namespace App\Services;

use App\Models\User;
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

        // Check if user has permission to view own POs
        if ($user->hasPermissionTo('po.view_own')) {
            // User is the importer
            if ($po->importer_id === $user->id) {
                return true;
            }

            // User is the assigned agency
            if ($po->agency_id === $user->id) {
                return true;
            }

            // User is assigned factory for any style in this PO
            if ($po->styles()->where('purchase_order_style.assigned_factory_id', $user->id)->exists()) {
                return true;
            }
        }

        return false;
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

        // Factory assigned directly to this style
        if ($style->assigned_factory_id === $user->id) {
            return true;
        }

        // Agency assigned directly to this style
        if ($style->assigned_agency_id === $user->id) {
            return true;
        }

        // Check via direct PO relationship
        if ($style->purchaseOrder) {
            return $this->canAccessPO($user, $style->purchaseOrder);
        }

        // Check via many-to-many PO relationship (pivot table)
        if ($style->purchaseOrders()->exists()) {
            foreach ($style->purchaseOrders as $po) {
                if ($this->canAccessPO($user, $po)) {
                    return true;
                }
            }
        }

        // Style creator
        if ($style->created_by === $user->id) {
            return true;
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

        $poIds = [];

        if ($user->hasPermissionTo('po.view_own')) {
            // POs where user is importer
            $importerPOs = \App\Models\PurchaseOrder::where('importer_id', $user->id)->pluck('id')->toArray();

            // POs where user is agency
            $agencyPOs = \App\Models\PurchaseOrder::where('agency_id', $user->id)->pluck('id')->toArray();

            // POs where user is assigned factory
            $factoryPOs = \App\Models\PurchaseOrder::whereHas('styles', function ($query) use ($user) {
                $query->where('purchase_order_style.assigned_factory_id', $user->id);
            })->pluck('id')->toArray();

            $poIds = array_unique(array_merge($importerPOs, $agencyPOs, $factoryPOs));
        }

        return $poIds;
    }
}
