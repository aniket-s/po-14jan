<?php

namespace App\Policies;

use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PurchaseOrderPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('po.view') || $user->can('po.view_all');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, PurchaseOrder $purchaseOrder): bool
    {
        // Can view all POs
        if ($user->can('po.view_all')) {
            return true;
        }

        // Can view own POs
        if ($user->can('po.view_own')) {
            return $purchaseOrder->creator_id === $user->id;
        }

        // General view permission
        if ($user->can('po.view')) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('po.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, PurchaseOrder $purchaseOrder): bool
    {
        if (!$user->can('po.edit')) {
            return false;
        }

        // Additional check: only importer can edit their own POs
        if ($user->hasRole('Importer')) {
            return $purchaseOrder->creator_id === $user->id;
        }

        return true;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, PurchaseOrder $purchaseOrder): bool
    {
        if (!$user->can('po.delete')) {
            return false;
        }

        // Additional check: only importer can delete their own POs
        if ($user->hasRole('Importer')) {
            return $purchaseOrder->creator_id === $user->id;
        }

        return true;
    }

    /**
     * Determine whether the user can assign agency to PO
     */
    public function assignAgency(User $user, PurchaseOrder $purchaseOrder): bool
    {
        if (!$user->can('po.assign_agency')) {
            return false;
        }

        // Only the PO creator can assign agency
        return $purchaseOrder->creator_id === $user->id;
    }

    /**
     * Determine whether the user can assign factory to PO
     */
    public function assignFactory(User $user, PurchaseOrder $purchaseOrder): bool
    {
        if (!$user->can('po.assign_factory')) {
            return false;
        }

        // Importer or agency can assign factory
        if ($user->hasRole(['Importer', 'Agency'])) {
            return $purchaseOrder->creator_id === $user->id ||
                   $purchaseOrder->assigned_agency_id === $user->id;
        }

        return true;
    }

    /**
     * Determine whether the user can bulk assign
     */
    public function bulkAssign(User $user): bool
    {
        return $user->can('po.bulk_assign');
    }

    /**
     * Determine whether the user can import POs
     */
    public function import(User $user): bool
    {
        return $user->can('po.import');
    }

    /**
     * Determine whether the user can export POs
     */
    public function export(User $user): bool
    {
        return $user->can('po.export');
    }

    /**
     * Determine whether the user can send invitations
     */
    public function invite(User $user, PurchaseOrder $purchaseOrder): bool
    {
        if (!$user->can('po.invite')) {
            return false;
        }

        // Only PO creator or assigned agency can send invitations
        return $purchaseOrder->creator_id === $user->id ||
               $purchaseOrder->assigned_agency_id === $user->id;
    }
}
