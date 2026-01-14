<?php

namespace App\Policies;

use App\Models\QualityInspection;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class QualityInspectionPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('quality_inspection.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, QualityInspection $qualityInspection): bool
    {
        // Can view all inspections
        if ($user->can('quality.view_all_inspections')) {
            return true;
        }

        // Can view specific inspection
        if ($user->can('quality_inspection.view') || $user->can('quality.view_inspection')) {
            // Factory can view inspections for their styles
            if ($user->hasRole('Factory')) {
                return $qualityInspection->style->assigned_factory_id === $user->id;
            }

            // Agency can view inspections for styles they manage
            if ($user->hasRole('Agency')) {
                return $qualityInspection->style->assigned_agency_id === $user->id;
            }

            // Importer can view inspections for their POs
            if ($user->hasRole('Importer')) {
                return $qualityInspection->style->purchaseOrder->created_by === $user->id;
            }

            // Inspector can view their own inspections
            return $qualityInspection->inspector_id === $user->id;
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('quality_inspection.create') || $user->can('quality.create_inspection');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, QualityInspection $qualityInspection): bool
    {
        if (!$user->can('quality_inspection.edit')) {
            return false;
        }

        // Only inspector who created it can edit
        return $qualityInspection->inspector_id === $user->id;
    }

    /**
     * Determine whether the user can approve the inspection.
     */
    public function approve(User $user, QualityInspection $qualityInspection): bool
    {
        return $user->can('quality_inspection.approve');
    }

    /**
     * Determine whether the user can pass inspection.
     */
    public function passInspection(User $user, QualityInspection $qualityInspection): bool
    {
        if (!$user->can('quality.pass_inspection')) {
            return false;
        }

        // Only inspector can pass their own inspection
        return $qualityInspection->inspector_id === $user->id;
    }

    /**
     * Determine whether the user can fail inspection.
     */
    public function failInspection(User $user, QualityInspection $qualityInspection): bool
    {
        if (!$user->can('quality.fail_inspection')) {
            return false;
        }

        // Only inspector can fail their own inspection
        return $qualityInspection->inspector_id === $user->id;
    }

    /**
     * Determine whether the user can generate certificate.
     */
    public function generateCertificate(User $user, QualityInspection $qualityInspection): bool
    {
        if (!$user->can('quality.generate_certificate')) {
            return false;
        }

        // Can only generate certificate if inspection passed
        return $qualityInspection->isPassed();
    }
}
