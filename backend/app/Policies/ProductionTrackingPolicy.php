<?php

namespace App\Policies;

use App\Models\ProductionTracking;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ProductionTrackingPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('production.view') || $user->can('production.view_all');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ProductionTracking $productionTracking): bool
    {
        // Can view all production tracking
        if ($user->can('production.view_all')) {
            return true;
        }

        // Can view own production tracking
        if ($user->can('production.view') || $user->can('production.view_own')) {
            // Factory can view production for their assigned styles
            if ($user->hasRole('Factory')) {
                return $productionTracking->style->assigned_factory_id === $user->id;
            }

            // Agency can view production for styles they manage
            if ($user->hasRole('Agency')) {
                return $productionTracking->style->assigned_agency_id === $user->id;
            }

            // Importer can view production for their POs
            if ($user->hasRole('Importer')) {
                return $productionTracking->style->purchaseOrder->created_by === $user->id;
            }
        }

        return false;
    }

    /**
     * Determine whether the user can initialize production.
     */
    public function initialize(User $user): bool
    {
        // Only factory can initialize production
        return $user->can('production.initialize') && $user->hasRole('Factory');
    }

    /**
     * Determine whether the user can submit production updates.
     */
    public function submit(User $user, ProductionTracking $productionTracking): bool
    {
        if (!$user->can('production.submit')) {
            return false;
        }

        // Only factory assigned to the style can submit updates
        return $user->hasRole('Factory') &&
               $productionTracking->style->assigned_factory_id === $user->id;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ProductionTracking $productionTracking): bool
    {
        if (!$user->can('production.edit') && !$user->can('production.update')) {
            return false;
        }

        // Only factory assigned to the style can update
        return $user->hasRole('Factory') &&
               $productionTracking->style->assigned_factory_id === $user->id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ProductionTracking $productionTracking): bool
    {
        if (!$user->can('production.delete')) {
            return false;
        }

        // Only super admin or factory manager can delete production records
        return $user->hasRole(['Super Admin', 'Factory Manager']);
    }

    /**
     * Determine whether the user can complete a production stage.
     */
    public function completeStage(User $user, ProductionTracking $productionTracking): bool
    {
        if (!$user->can('production.complete_stage')) {
            return false;
        }

        // Only factory assigned to the style can complete stages
        return $user->hasRole('Factory') &&
               $productionTracking->style->assigned_factory_id === $user->id;
    }
}
