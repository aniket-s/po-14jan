<?php

namespace App\Policies;

use App\Models\Shipment;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ShipmentPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('shipment.view') || $user->can('shipment.view_all');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Shipment $shipment): bool
    {
        // Can view all shipments
        if ($user->can('shipment.view_all')) {
            return true;
        }

        // Can view own shipments
        if ($user->can('shipment.view') || $user->can('shipment.view_own')) {
            // Factory can view shipments they created
            if ($user->hasRole('Factory')) {
                return $shipment->created_by === $user->id;
            }

            // Importer can view shipments for their POs
            if ($user->hasRole('Importer')) {
                return $shipment->purchaseOrder->created_by === $user->id;
            }

            // Agency can view shipments for POs they manage
            if ($user->hasRole('Agency')) {
                return $shipment->purchaseOrder->assigned_agency_id === $user->id;
            }
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        // Only factory can create shipments
        return $user->can('shipment.create') && $user->hasRole('Factory');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Shipment $shipment): bool
    {
        if (!$user->can('shipment.edit') && !$user->can('shipment.update')) {
            return false;
        }

        // Factory can update their own shipments before dispatch
        if ($user->hasRole('Factory')) {
            return $shipment->created_by === $user->id &&
                   $shipment->status !== 'dispatched' &&
                   $shipment->status !== 'delivered';
        }

        return true;
    }

    /**
     * Determine whether the user can track the shipment.
     */
    public function track(User $user, Shipment $shipment): bool
    {
        // Anyone with track permission can track any shipment
        return $user->can('shipment.track');
    }

    /**
     * Determine whether the user can mark shipment as dispatched.
     */
    public function markDispatched(User $user, Shipment $shipment): bool
    {
        if (!$user->can('shipment.mark_dispatched')) {
            return false;
        }

        // Only factory that created the shipment can mark as dispatched
        return $user->hasRole('Factory') &&
               $shipment->created_by === $user->id &&
               $shipment->status === 'pending';
    }

    /**
     * Determine whether the user can mark shipment as delivered.
     */
    public function markDelivered(User $user, Shipment $shipment): bool
    {
        if (!$user->can('shipment.mark_delivered')) {
            return false;
        }

        // Importer or logistics can mark as delivered
        if ($user->hasRole('Importer')) {
            return $shipment->purchaseOrder->created_by === $user->id &&
                   $shipment->status === 'dispatched';
        }

        // Admin or logistics role can mark any shipment as delivered
        return $shipment->status === 'dispatched';
    }
}
