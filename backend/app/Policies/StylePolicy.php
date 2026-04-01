<?php

namespace App\Policies;

use App\Models\Style;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class StylePolicy
{
    /**
     * Super Admin bypasses all policy checks.
     */
    public function before(User $user, string $ability): bool|null
    {
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('style.view') || $user->can('style.view_own');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Style $style): bool
    {
        // Read-only roles (Viewer, Quality Inspector) can view all styles
        if ($user->can('style.view')) {
            return true;
        }

        // Can view own styles only
        if ($user->can('style.view_own')) {
            // Style creator can always view
            if ($style->created_by === $user->id) {
                return true;
            }

            // Factory can view styles assigned to them (direct or via pivot)
            if ($user->hasRole('Factory')) {
                if ($style->assigned_factory_id === $user->id) {
                    return true;
                }
                // Check via pivot table
                if ($style->purchaseOrders()->where('purchase_order_style.assigned_factory_id', $user->id)->exists()) {
                    return true;
                }
                return false;
            }

            // Agency can view styles assigned to them (direct or via PO)
            if ($user->hasRole('Agency')) {
                if ($style->assigned_agency_id === $user->id) {
                    return true;
                }
                // Check via pivot table
                if ($style->purchaseOrders()->where('purchase_order_style.assigned_agency_id', $user->id)->exists()) {
                    return true;
                }
                // Check via PO agency_id
                if ($style->purchaseOrder && $style->purchaseOrder->agency_id === $user->id) {
                    return true;
                }
                if ($style->purchaseOrders()->where('agency_id', $user->id)->exists()) {
                    return true;
                }
                return false;
            }

            // Importer can view styles from their POs
            if ($user->hasRole('Importer')) {
                if ($style->purchaseOrder && $style->purchaseOrder->importer_id === $user->id) {
                    return true;
                }
                if ($style->purchaseOrders()->where('importer_id', $user->id)->exists()) {
                    return true;
                }
                return false;
            }
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('style.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Style $style): bool
    {
        if (!$user->can('style.edit')) {
            return false;
        }

        // Importer can edit styles from their POs
        if ($user->hasRole('Importer')) {
            if ($style->purchaseOrder && $style->purchaseOrder->importer_id === $user->id) {
                return true;
            }
            return $style->purchaseOrders()->where('importer_id', $user->id)->exists();
        }

        return true;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Style $style): bool
    {
        if (!$user->can('style.delete')) {
            return false;
        }

        // Importer can delete styles from their POs (if not yet assigned)
        if ($user->hasRole('Importer')) {
            $isOwnStyle = false;
            if ($style->purchaseOrder && $style->purchaseOrder->importer_id === $user->id) {
                $isOwnStyle = true;
            } elseif ($style->purchaseOrders()->where('importer_id', $user->id)->exists()) {
                $isOwnStyle = true;
            }
            return $isOwnStyle && !$style->isAssigned();
        }

        return true;
    }

    /**
     * Determine whether the user can assign factory to style.
     */
    public function assignFactory(User $user, Style $style): bool
    {
        if (!$user->can('style.assign_factory')) {
            return false;
        }

        // Importer or agency can assign factory
        if ($user->hasRole(['Importer', 'Agency'])) {
            // Check via direct PO relationship
            if ($style->purchaseOrder) {
                if ($style->purchaseOrder->importer_id === $user->id ||
                    $style->purchaseOrder->agency_id === $user->id) {
                    return true;
                }
            }
            // Check via many-to-many PO relationship
            return $style->purchaseOrders()
                ->where(function ($q) use ($user) {
                    $q->where('importer_id', $user->id)
                      ->orWhere('agency_id', $user->id);
                })->exists();
        }

        return true;
    }

    /**
     * Determine whether the user can bulk assign styles.
     */
    public function bulkAssign(User $user): bool
    {
        return $user->can('style.bulk_assign');
    }
}
