<?php

namespace App\Policies;

use App\Models\Sample;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class SamplePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('sample.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Sample $sample): bool
    {
        // Can view all samples
        if ($user->can('sample.view')) {
            return true;
        }

        // Can view own samples only
        if ($user->can('sample.view_own')) {
            // Factory can view samples for their assigned styles
            if ($user->hasRole('Factory')) {
                return $sample->style->assigned_factory_id === $user->id;
            }

            // Agency can view samples for styles they manage
            if ($user->hasRole('Agency')) {
                return $sample->style->assigned_agency_id === $user->id;
            }

            // Importer can view samples for their POs
            if ($user->hasRole('Importer')) {
                return $sample->style->purchaseOrder->created_by === $user->id;
            }
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('sample.create');
    }

    /**
     * Determine whether the user can submit sample.
     */
    public function submit(User $user, Sample $sample): bool
    {
        if (!$user->can('sample.submit')) {
            return false;
        }

        // Only factory can submit samples for their assigned styles
        if ($user->hasRole('Factory')) {
            return $sample->style->assigned_factory_id === $user->id;
        }

        return true;
    }

    /**
     * Determine whether the user can approve sample as factory.
     */
    public function factoryApprove(User $user, Sample $sample): bool
    {
        if (!$user->can('sample.factory_approve')) {
            return false;
        }

        // Factory can only approve samples for their assigned styles
        return $user->hasRole('Factory') &&
               $sample->style->assigned_factory_id === $user->id;
    }

    /**
     * Determine whether the user can approve sample as agency.
     */
    public function agencyApprove(User $user, Sample $sample): bool
    {
        if (!$user->can('sample.approve_agency')) {
            return false;
        }

        // Agency can only approve samples for styles they manage
        return $user->hasRole('Agency') &&
               $sample->style->assigned_agency_id === $user->id;
    }

    /**
     * Determine whether the user can give final approval as importer.
     */
    public function finalApprove(User $user, Sample $sample): bool
    {
        if (!$user->can('sample.approve_final')) {
            return false;
        }

        // Importer can approve samples for their POs
        return $user->hasRole('Importer') &&
               $sample->style->purchaseOrder->created_by === $user->id;
    }

    /**
     * Determine whether the user can reject sample.
     */
    public function reject(User $user, Sample $sample): bool
    {
        if (!$user->can('sample.reject')) {
            return false;
        }

        // Importer can reject any sample for their POs
        if ($user->hasRole('Importer')) {
            return $sample->style->purchaseOrder->created_by === $user->id;
        }

        // Agency can reject samples for styles they manage
        if ($user->hasRole('Agency')) {
            return $sample->style->assigned_agency_id === $user->id;
        }

        return true;
    }

    /**
     * Determine whether the user can create auto-approval rules.
     */
    public function createAutoRule(User $user): bool
    {
        return $user->can('sample.create_auto_rule');
    }

    /**
     * Determine whether the user can bulk approve samples.
     */
    public function bulkApprove(User $user): bool
    {
        return $user->can('sample.bulk_approve');
    }
}
