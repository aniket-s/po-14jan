<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\Sample;
use App\Models\ProductionTracking;
use App\Models\QualityInspection;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Get dashboard overview statistics
     */
    public function getDashboardOverview(User $user, ?array $filters = []): array
    {
        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;

        return [
            'purchase_orders' => $this->getPurchaseOrderStats($user, $startDate, $endDate),
            'samples' => $this->getSampleStats($user, $startDate, $endDate),
            'production' => $this->getProductionStats($user, $startDate, $endDate),
            'quality_inspections' => $this->getQualityInspectionStats($user, $startDate, $endDate),
            'shipments' => $this->getShipmentStats($user, $startDate, $endDate),
        ];
    }

    /**
     * Get purchase order statistics
     */
    public function getPurchaseOrderStats(User $user, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = PurchaseOrder::query();

        // Apply date range filter
        if ($startDate && $endDate) {
            $query->whereBetween('po_date', [$startDate, $endDate]);
        }

        // Apply user-based access control
        if ($user->hasRole('importer')) {
            $query->where('importer_id', $user->id);
        } elseif ($user->hasRole('agency')) {
            $query->where('agency_id', $user->id);
        } elseif ($user->hasRole('factory')) {
            $query->whereHas('factoryAssignments', function ($q) use ($user) {
                $q->where('factory_id', $user->id);
            });
        }

        $totalCount = $query->count();
        $totalValue = $query->sum('total_value');
        $totalQuantity = $query->sum('total_quantity');

        $byStatus = (clone $query)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $recentOrders = (clone $query)
            ->with('importer:id,name')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($po) {
                return [
                    'id' => $po->id,
                    'po_number' => $po->po_number,
                    'importer' => $po->importer->name,
                    'total_value' => $po->total_value,
                    'status' => $po->status,
                    'order_date' => $po->po_date ? $po->po_date->format('Y-m-d') : null,
                ];
            });

        return [
            'total_count' => $totalCount,
            'total_value' => round($totalValue, 2),
            'total_quantity' => $totalQuantity,
            'by_status' => $byStatus,
            'recent_orders' => $recentOrders,
        ];
    }

    /**
     * Get sample statistics
     */
    public function getSampleStats(User $user, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = Sample::query();

        // Apply date range filter
        if ($startDate && $endDate) {
            $query->whereBetween('submission_date', [$startDate, $endDate]);
        }

        // Apply user-based access control
        if ($user->hasRole('importer')) {
            $query->whereHas('style.purchaseOrder', function ($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        } elseif ($user->hasRole('factory')) {
            $query->where('submitted_by', $user->id);
        }

        $totalCount = $query->count();
        $approvedCount = $query->where('final_status', 'approved')->count();
        $rejectedCount = $query->where('final_status', 'rejected')->count();
        $pendingCount = $query->where('final_status', 'pending')->count();

        $approvalRate = $totalCount > 0 ? round(($approvedCount / $totalCount) * 100, 2) : 0;

        $bySampleType = (clone $query)
            ->with('sampleType:id,name')
            ->get()
            ->groupBy('sample_type_id')
            ->map(function ($samples, $typeId) {
                $sampleType = $samples->first()->sampleType;
                return [
                    'type_name' => $sampleType->name,
                    'total' => $samples->count(),
                    'approved' => $samples->where('final_status', 'approved')->count(),
                    'rejected' => $samples->where('final_status', 'rejected')->count(),
                ];
            })
            ->values();

        return [
            'total_count' => $totalCount,
            'approved_count' => $approvedCount,
            'rejected_count' => $rejectedCount,
            'pending_count' => $pendingCount,
            'approval_rate' => $approvalRate,
            'by_sample_type' => $bySampleType,
        ];
    }

    /**
     * Get production statistics
     */
    public function getProductionStats(User $user, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = ProductionTracking::query();

        // Apply date range filter
        if ($startDate && $endDate) {
            $query->whereBetween('tracking_date', [$startDate, $endDate]);
        }

        // Apply user-based access control
        if ($user->hasRole('factory')) {
            $query->where('submitted_by', $user->id);
        } elseif ($user->hasRole('importer')) {
            $query->whereHas('style.purchaseOrder', function ($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        $totalQuantityProduced = $query->sum('quantity_produced');
        $totalQuantityRejected = $query->sum('quantity_rejected');
        $totalQuantityReworked = $query->sum('quantity_reworked');

        $acceptanceRate = $totalQuantityProduced > 0
            ? round((($totalQuantityProduced - $totalQuantityRejected) / $totalQuantityProduced) * 100, 2)
            : 0;

        $byStage = (clone $query)
            ->with('productionStage:id,name')
            ->get()
            ->groupBy('production_stage_id')
            ->map(function ($trackings, $stageId) {
                $stage = $trackings->first()->productionStage;
                $produced = $trackings->sum('quantity_produced');
                $rejected = $trackings->sum('quantity_rejected');
                return [
                    'stage_name' => $stage->name,
                    'quantity_produced' => $produced,
                    'quantity_rejected' => $rejected,
                    'acceptance_rate' => $produced > 0 ? round((($produced - $rejected) / $produced) * 100, 2) : 0,
                ];
            })
            ->values();

        return [
            'total_quantity_produced' => $totalQuantityProduced,
            'total_quantity_rejected' => $totalQuantityRejected,
            'total_quantity_reworked' => $totalQuantityReworked,
            'acceptance_rate' => $acceptanceRate,
            'by_stage' => $byStage,
        ];
    }

    /**
     * Get quality inspection statistics
     */
    public function getQualityInspectionStats(User $user, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = QualityInspection::query();

        // Apply date range filter
        if ($startDate && $endDate) {
            $query->whereBetween('inspected_at', [$startDate, $endDate]);
        }

        // Apply user-based access control
        if ($user->hasRole('qc_inspector')) {
            $query->where('inspector_id', $user->id);
        } elseif ($user->hasRole('importer')) {
            $query->whereHas('style.purchaseOrder', function ($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        $totalCount = $query->count();
        $passedCount = (clone $query)->where('result', 'passed')->count();
        $failedCount = (clone $query)->where('result', 'failed')->count();

        $passRate = $totalCount > 0 ? round(($passedCount / $totalCount) * 100, 2) : 0;

        $byInspectionType = (clone $query)
            ->with('inspectionType:id,name')
            ->get()
            ->groupBy('inspection_type_id')
            ->map(function ($inspections, $typeId) {
                $type = $inspections->first()->inspectionType;
                $total = $inspections->count();
                $passed = $inspections->where('result', 'passed')->count();
                return [
                    'type_name' => $type->name,
                    'total' => $total,
                    'passed' => $passed,
                    'failed' => $total - $passed,
                    'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 2) : 0,
                ];
            })
            ->values();

        $criticalDefects = (clone $query)->sum('critical_defects');
        $majorDefects = (clone $query)->sum('major_defects');
        $minorDefects = (clone $query)->sum('minor_defects');
        $totalDefects = $criticalDefects + $majorDefects + $minorDefects;

        return [
            'total_count' => $totalCount,
            'passed_count' => $passedCount,
            'failed_count' => $failedCount,
            'pass_rate' => $passRate,
            'by_inspection_type' => $byInspectionType,
            'defects' => [
                'total' => $totalDefects,
                'critical' => $criticalDefects,
                'major' => $majorDefects,
                'minor' => $minorDefects,
            ],
        ];
    }

    /**
     * Get shipment statistics
     */
    public function getShipmentStats(User $user, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = Shipment::query();

        // Apply date range filter
        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        // Apply user-based access control
        if ($user->hasRole('importer')) {
            $query->whereHas('purchaseOrder', function ($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        $totalCount = $query->count();
        $deliveredCount = $query->where('status', 'delivered')->count();
        $inTransitCount = $query->where('status', 'in_transit')->count();
        $delayedCount = $query->whereNotIn('status', ['delivered', 'cancelled'])
            ->where('estimated_delivery_date', '<', now())
            ->count();

        $onTimeDeliveryRate = $totalCount > 0 ? round(($deliveredCount / $totalCount) * 100, 2) : 0;

        $byStatus = (clone $query)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $byMethod = (clone $query)
            ->select('shipment_method', DB::raw('count(*) as count'))
            ->groupBy('shipment_method')
            ->pluck('count', 'shipment_method')
            ->toArray();

        return [
            'total_count' => $totalCount,
            'delivered_count' => $deliveredCount,
            'in_transit_count' => $inTransitCount,
            'delayed_count' => $delayedCount,
            'on_time_delivery_rate' => $onTimeDeliveryRate,
            'by_status' => $byStatus,
            'by_method' => $byMethod,
        ];
    }

    /**
     * Get purchase order detailed report
     */
    public function getPurchaseOrderReport(User $user, array $filters): array
    {
        $query = PurchaseOrder::with(['importer:id,name', 'agency:id,name']);

        // Apply filters
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('po_date', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['importer_id'])) {
            $query->where('importer_id', $filters['importer_id']);
        }

        // Apply user-based access control
        if ($user->hasRole('importer')) {
            $query->where('importer_id', $user->id);
        } elseif ($user->hasRole('agency')) {
            $query->where('agency_id', $user->id);
        }

        $orders = $query->get()->map(function ($po) {
            return [
                'po_number' => $po->po_number,
                'importer' => $po->importer->name,
                'agency' => $po->agency?->name,
                'order_date' => $po->po_date ? $po->po_date->format('Y-m-d') : null,
                'delivery_date' => $po->delivery_date?->format('Y-m-d'),
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'currency' => $po->currency,
                'status' => $po->status,
                'payment_terms' => $po->payment_terms,
            ];
        });

        $summary = [
            'total_orders' => $orders->count(),
            'total_value' => $orders->sum('total_value'),
            'total_quantity' => $orders->sum('total_quantity'),
        ];

        return [
            'summary' => $summary,
            'orders' => $orders,
        ];
    }

    /**
     * Get production detailed report
     */
    public function getProductionReport(User $user, array $filters): array
    {
        $query = ProductionTracking::with([
            'style:id,style_number,description',
            'productionStage:id,name',
        ]);

        // Apply filters
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('tracking_date', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['style_id'])) {
            $query->where('style_id', $filters['style_id']);
        }

        if (!empty($filters['stage_id'])) {
            $query->where('production_stage_id', $filters['stage_id']);
        }

        // Apply user-based access control
        if ($user->hasRole('factory')) {
            $query->where('submitted_by', $user->id);
        }

        $records = $query->get()->map(function ($tracking) {
            return [
                'style_number' => $tracking->style->style_number,
                'production_stage' => $tracking->productionStage->name,
                'tracking_date' => $tracking->tracking_date->format('Y-m-d'),
                'quantity_produced' => $tracking->quantity_produced,
                'quantity_rejected' => $tracking->quantity_rejected,
                'quantity_reworked' => $tracking->quantity_reworked,
                'net_quantity' => $tracking->quantity_produced - $tracking->quantity_rejected,
                'acceptance_rate' => $tracking->getAcceptanceRateAttribute(),
                'completion_percentage' => $tracking->completion_percentage,
            ];
        });

        $summary = [
            'total_records' => $records->count(),
            'total_produced' => $records->sum('quantity_produced'),
            'total_rejected' => $records->sum('quantity_rejected'),
            'total_reworked' => $records->sum('quantity_reworked'),
            'overall_acceptance_rate' => $records->avg('acceptance_rate'),
        ];

        return [
            'summary' => $summary,
            'records' => $records,
        ];
    }

    /**
     * Get quality inspection detailed report
     */
    public function getQualityInspectionReport(User $user, array $filters): array
    {
        $query = QualityInspection::with([
            'style:id,style_number',
            'inspectionType:id,name',
            'inspector:id,name',
        ]);

        // Apply filters
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('inspected_at', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['result'])) {
            $query->where('inspection_result', $filters['result']);
        }

        if (!empty($filters['inspection_type_id'])) {
            $query->where('inspection_type_id', $filters['inspection_type_id']);
        }

        // Apply user-based access control
        if ($user->hasRole('qc_inspector')) {
            $query->where('inspector_id', $user->id);
        }

        $inspections = $query->get()->map(function ($inspection) {
            return [
                'inspection_reference' => $inspection->inspection_reference,
                'style_number' => $inspection->style->style_number,
                'inspection_type' => $inspection->inspectionType->name,
                'inspector' => $inspection->inspector->name,
                'inspected_at' => $inspection->inspected_at->format('Y-m-d'),
                'lot_size' => $inspection->lot_size,
                'sample_size' => $inspection->sample_size,
                'result' => $inspection->inspection_result,
                'critical_found' => $inspection->critical_found,
                'major_found' => $inspection->major_found,
                'minor_found' => $inspection->minor_found,
                'total_defects' => $inspection->total_defects_found,
                'certificate_number' => $inspection->certificate_number,
            ];
        });

        $summary = [
            'total_inspections' => $inspections->count(),
            'passed' => $inspections->where('result', 'pass')->count(),
            'failed' => $inspections->where('result', 'fail')->count(),
            'pass_rate' => $inspections->count() > 0 ? round(($inspections->where('result', 'pass')->count() / $inspections->count()) * 100, 2) : 0,
            'total_defects' => $inspections->sum('total_defects'),
        ];

        return [
            'summary' => $summary,
            'inspections' => $inspections,
        ];
    }

    /**
     * Get shipment detailed report
     */
    public function getShipmentReport(User $user, array $filters): array
    {
        $query = Shipment::with([
            'purchaseOrder:id,po_number',
        ]);

        // Apply filters
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('created_at', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['method'])) {
            $query->where('shipment_method', $filters['method']);
        }

        // Apply user-based access control
        if ($user->hasRole('importer')) {
            $query->whereHas('purchaseOrder', function ($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        $shipments = $query->get()->map(function ($shipment) {
            return [
                'shipment_reference' => $shipment->shipment_reference,
                'po_number' => $shipment->purchaseOrder->po_number,
                'tracking_number' => $shipment->tracking_number,
                'carrier_name' => $shipment->carrier_name,
                'shipment_method' => $shipment->shipment_method,
                'status' => $shipment->status,
                'estimated_dispatch_date' => $shipment->estimated_dispatch_date?->format('Y-m-d'),
                'actual_dispatch_date' => $shipment->actual_dispatch_date?->format('Y-m-d'),
                'estimated_delivery_date' => $shipment->estimated_delivery_date?->format('Y-m-d'),
                'actual_delivery_date' => $shipment->actual_delivery_date?->format('Y-m-d'),
                'is_delayed' => $shipment->isDelayed(),
                'total_cartons' => $shipment->total_cartons,
                'total_weight' => $shipment->total_weight,
            ];
        });

        $summary = [
            'total_shipments' => $shipments->count(),
            'delivered' => $shipments->where('status', 'delivered')->count(),
            'in_transit' => $shipments->where('status', 'in_transit')->count(),
            'delayed' => $shipments->where('is_delayed', true)->count(),
        ];

        return [
            'summary' => $summary,
            'shipments' => $shipments,
        ];
    }
}
