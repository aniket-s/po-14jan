<?php

namespace App\Policies;

use App\Models\Style;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class StylePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('style.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Style $style): bool
    {
        // Can view all styles
        if ($user->can('style.view')) {
            return true;
        }

        // Can view own styles only
        if ($user->can('style.view_own')) {
            // Factory can view styles assigned to them
            if ($user->hasRole('Factory')) {
                return $style->assigned_factory_id === $user->id;
            }

            // Agency can view styles they manage
            if ($user->hasRole('Agency')) {
                return $style->assigned_agency_id === $user->id;
            }

            // Importer can view styles from their POs
            if ($user->hasRole('Importer')) {
                return $style->purchaseOrder->created_by === $user->id;
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
            return $style->purchaseOrder->created_by === $user->id;
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
            return $style->purchaseOrder->created_by === $user->id &&
                   !$style->isAssigned();
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
            return $style->purchaseOrder->created_by === $user->id ||
                   $style->assigned_agency_id === $user->id;
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
