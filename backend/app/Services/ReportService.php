<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderStyle;
use App\Models\Sample;
use App\Models\ProductionTracking;
use App\Models\QualityInspection;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

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
     * Apply user-based PO access filter to a query.
     * Reused across PO stats and related entity queries.
     */
    private function applyPOAccessFilter($query, User $user)
    {
        if ($user->hasRole('Super Admin') || $user->hasPermissionTo('po.view_all')) {
            return;
        }

        if ($user->hasRole('Importer')) {
            $query->where('importer_id', $user->id);
        } elseif ($user->hasRole('Agency')) {
            $query->where(function ($q) use ($user) {
                $q->where('agency_id', $user->id)
                  ->orWhere('creator_id', $user->id);
            });
        } elseif ($user->hasRole('Factory')) {
            $query->whereHas('factoryAssignments', function ($q) use ($user) {
                $q->where('factory_id', $user->id);
            });
        }
    }

    /**
     * Get accessible PO IDs for a user (for filtering related entities).
     */
    private function getAccessiblePOIds(User $user): ?array
    {
        if ($user->hasRole('Super Admin') || $user->hasPermissionTo('po.view_all')) {
            return null; // No filter needed
        }

        $query = PurchaseOrder::query();
        $this->applyPOAccessFilter($query, $user);
        return $query->pluck('id')->toArray();
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
        $this->applyPOAccessFilter($query, $user);

        $totalCount = $query->count();
        $totalValue = $query->sum('total_value');
        $totalQuantity = $query->sum('total_quantity');

        $byStatus = (clone $query)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $recentOrders = (clone $query)
            ->with(['importer:id,name', 'agency:id,name'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($po) {
                return [
                    'id' => $po->id,
                    'po_number' => $po->po_number,
                    'importer' => $po->importer?->name ?? $po->agency?->name ?? '-',
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
        if ($user->hasRole('Factory')) {
            $query->where('submitted_by', $user->id);
        } else {
            $poIds = $this->getAccessiblePOIds($user);
            if ($poIds !== null) {
                $query->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                    $q->whereIn('purchase_orders.id', $poIds);
                });
            }
        }

        $totalCount = $query->count();
        $approvedCount = (clone $query)->where('final_status', 'approved')->count();
        $rejectedCount = (clone $query)->where('final_status', 'rejected')->count();
        $pendingCount = (clone $query)->where('final_status', 'pending')->count();

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
        if ($user->hasRole('Factory')) {
            $query->where('submitted_by', $user->id);
        } else {
            $poIds = $this->getAccessiblePOIds($user);
            if ($poIds !== null) {
                $query->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                    $q->whereIn('purchase_orders.id', $poIds);
                });
            }
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
        } else {
            $poIds = $this->getAccessiblePOIds($user);
            if ($poIds !== null) {
                $query->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                    $q->whereIn('purchase_orders.id', $poIds);
                });
            }
        }

        $totalCount = $query->count();
        $passedCount = (clone $query)->where('result', 'passed')->count();
        $failedCount = (clone $query)->where('result', 'failed')->count();

        $passRate = $totalCount > 0 ? round(($passedCount / $totalCount) * 100, 2) : 0;

        $byAqlLevel = (clone $query)
            ->with('aqlLevel:id,name')
            ->get()
            ->groupBy('aql_level_id')
            ->map(function ($inspections) {
                $level = $inspections->first()->aqlLevel;
                $total = $inspections->count();
                $passed = $inspections->where('result', 'passed')->count();
                return [
                    'level_name' => $level->name ?? '-',
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
            'by_aql_level' => $byAqlLevel,
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
        $poIds = $this->getAccessiblePOIds($user);
        if ($poIds !== null) {
            $query->whereHas('purchaseOrder', function ($q) use ($poIds) {
                $q->whereIn('purchase_orders.id', $poIds);
            });
        }

        $totalCount = $query->count();
        $deliveredCount = (clone $query)->where('status', 'delivered')->count();
        $inTransitCount = (clone $query)->where('status', 'in_transit')->count();
        $delayedCount = (clone $query)->whereNotIn('status', ['delivered', 'cancelled'])
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
        $query = PurchaseOrder::with([
            'importer:id,name',
            'agency:id,name',
            'buyer:id,name,code',
            'retailer:id,name',
            'season:id,name',
            'country:id,name,sailing_time_days',
            'warehouse:id,name',
            'currency:id,code,symbol',
        ])->withCount('styles');

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

        if (!empty($filters['agency_id'])) {
            $query->where('agency_id', $filters['agency_id']);
        }

        if (!empty($filters['buyer_id'])) {
            $query->where('buyer_id', $filters['buyer_id']);
        }

        if (!empty($filters['retailer_id'])) {
            $query->where('retailer_id', $filters['retailer_id']);
        }

        if (!empty($filters['season_id'])) {
            $query->where('season_id', $filters['season_id']);
        }

        if (!empty($filters['country_id'])) {
            $query->where('country_id', $filters['country_id']);
        }

        if (!empty($filters['shipping_term'])) {
            $query->where('shipping_term', $filters['shipping_term']);
        }

        if (!empty($filters['currency_id'])) {
            $query->where('currency_id', $filters['currency_id']);
        }

        if (!empty($filters['factory_id'])) {
            $query->whereHas('factoryAssignments', function ($q) use ($filters) {
                $q->where('factory_id', $filters['factory_id']);
            });
        }

        if (!empty($filters['etd_overdue'])) {
            $query->whereNotNull('etd_date')
                ->whereDate('etd_date', '<', now()->toDateString())
                ->whereNotIn('status', ['completed', 'cancelled']);
        }

        if (!empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($w) use ($s) {
                $w->where('po_number', 'LIKE', "%{$s}%")
                    ->orWhere('headline', 'LIKE', "%{$s}%")
                    ->orWhere('buy_sheet_number', 'LIKE', "%{$s}%");
            });
        }

        // Apply user-based access control
        $this->applyPOAccessFilter($query, $user);

        // Snapshot summary BEFORE pagination so KPIs reflect the full filtered set,
        // not just the current page.
        $summaryQ = (clone $query);
        $totalCount = (clone $summaryQ)->count();
        $totalValue = (float) (clone $summaryQ)->sum('total_value');
        $totalQuantity = (int) (clone $summaryQ)->sum('total_quantity');
        $byStatus = (clone $summaryQ)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
        $today = now()->toDateString();
        $overdueEtdCount = (clone $summaryQ)
            ->whereNotNull('etd_date')
            ->whereDate('etd_date', '<', $today)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();
        $upcomingEtdCount = (clone $summaryQ)
            ->whereNotNull('etd_date')
            ->whereBetween('etd_date', [$today, now()->addDays(30)->toDateString()])
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        // Order + paginate
        $sortBy = $filters['sort_by'] ?? 'po_date';
        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['po_date', 'po_number', 'total_value', 'total_quantity', 'etd_date', 'status', 'created_at'];
        if (!in_array($sortBy, $allowedSorts, true)) $sortBy = 'po_date';
        $query->orderBy($sortBy, $sortDir);

        $perPage = (int) ($filters['per_page'] ?? 25);
        $page = (int) ($filters['page'] ?? 1);
        if ($perPage < 1) $perPage = 25;
        if ($perPage > 200) $perPage = 200;

        $needsPagination = empty($filters['unpaginated']);
        if ($needsPagination) {
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = $paginator->items();
        } else {
            $rows = $query->get()->all();
            $paginator = null;
        }

        $poIds = array_map(fn ($po) => $po->id, $rows);

        // Cross-domain aggregates - one query per dimension instead of N+1.
        $sampleByPo = $this->aggregateSamplesByPo($poIds);
        $productionByPo = $this->aggregateProductionByPo($poIds);
        $shipmentByPo = $this->aggregateShipmentsByPo($poIds);
        $qualityByPo = $this->aggregateQualityByPo($poIds);
        $factoryByPo = $this->aggregateFactoriesByPo($poIds);

        $orders = collect($rows)->map(function ($po) use ($sampleByPo, $productionByPo, $shipmentByPo, $qualityByPo, $factoryByPo, $today) {
            $etdStatus = $this->classifyEtd($po->etd_date, $po->status, $today);
            $samples = $sampleByPo[$po->id] ?? ['pending' => 0, 'approved' => 0, 'rejected' => 0, 'total' => 0];
            $production = $productionByPo[$po->id] ?? ['not_started' => 0, 'in_progress' => 0, 'completed' => 0, 'total' => 0];
            $shipments = $shipmentByPo[$po->id] ?? ['preparing' => 0, 'in_transit' => 0, 'delivered' => 0, 'overdue' => 0, 'total' => 0];
            $quality = $qualityByPo[$po->id] ?? ['passed' => 0, 'failed' => 0, 'pending' => 0, 'total' => 0];

            return [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'headline' => $po->headline,
                'status' => $po->status,
                'po_date' => $po->po_date?->format('Y-m-d'),
                'etd_date' => $po->etd_date instanceof \DateTimeInterface ? $po->etd_date->format('Y-m-d') : $po->etd_date,
                'eta_date' => $po->eta_date instanceof \DateTimeInterface ? $po->eta_date->format('Y-m-d') : $po->eta_date,
                'ex_factory_date' => $po->ex_factory_date instanceof \DateTimeInterface ? $po->ex_factory_date->format('Y-m-d') : $po->ex_factory_date,
                'in_warehouse_date' => $po->in_warehouse_date instanceof \DateTimeInterface ? $po->in_warehouse_date->format('Y-m-d') : $po->in_warehouse_date,
                'shipping_term' => $po->shipping_term,
                'total_quantity' => (int) $po->total_quantity,
                'total_value' => (float) $po->total_value,
                'currency_id' => $po->currency_id,
                'currency_code' => $po->currency?->code,
                'currency_symbol' => $po->currency?->symbol,
                'styles_count' => (int) $po->styles_count,
                'importer_id' => $po->importer_id,
                'importer_name' => $po->importer?->name,
                'agency_id' => $po->agency_id,
                'agency_name' => $po->agency?->name,
                'buyer_id' => $po->buyer_id,
                'buyer_name' => $po->buyer?->name,
                'buyer_code' => $po->buyer?->code,
                'retailer_id' => $po->retailer_id,
                'retailer_name' => $po->retailer?->name,
                'season_id' => $po->season_id,
                'season_name' => $po->season?->name,
                'country_id' => $po->country_id,
                'country_name' => $po->country?->name,
                'warehouse_id' => $po->warehouse_id,
                'warehouse_name' => $po->warehouse?->name,
                'buy_sheet_id' => $po->buy_sheet_id,
                'buy_sheet_number' => $po->buy_sheet_number,
                'etd_status' => $etdStatus,
                'samples_summary' => $samples,
                'production_summary' => $production,
                'shipments_summary' => $shipments,
                'quality_summary' => $quality,
                'factories' => $factoryByPo[$po->id] ?? [],
            ];
        })->all();

        $summary = [
            'total_orders' => $totalCount,
            'total_value' => round($totalValue, 2),
            'total_quantity' => $totalQuantity,
            'by_status' => $byStatus,
            'overdue_etd' => $overdueEtdCount,
            'upcoming_etd' => $upcomingEtdCount,
        ];

        $payload = [
            'summary' => $summary,
            'orders' => $orders,
        ];

        if ($paginator) {
            $payload['pagination'] = [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ];
        }

        return $payload;
    }

    /** @param int[] $poIds */
    private function aggregateSamplesByPo(array $poIds): array
    {
        if (empty($poIds)) return [];
        $rows = DB::table('samples')
            ->join('purchase_order_style', 'purchase_order_style.style_id', '=', 'samples.style_id')
            ->select('purchase_order_style.po_id', 'samples.final_status', DB::raw('count(*) as cnt'))
            ->whereIn('purchase_order_style.po_id', $poIds)
            ->groupBy('purchase_order_style.po_id', 'samples.final_status')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $poId = (int) $r->po_id;
            $status = $r->final_status ?: 'pending';
            $out[$poId] = $out[$poId] ?? ['pending' => 0, 'approved' => 0, 'rejected' => 0, 'total' => 0];
            $key = in_array($status, ['pending', 'approved', 'rejected'], true) ? $status : 'pending';
            $out[$poId][$key] += (int) $r->cnt;
            $out[$poId]['total'] += (int) $r->cnt;
        }
        return $out;
    }

    /** @param int[] $poIds */
    private function aggregateProductionByPo(array $poIds): array
    {
        if (empty($poIds)) return [];
        $rows = DB::table('purchase_order_style')
            ->select('po_id', 'status', DB::raw('count(*) as cnt'))
            ->whereIn('po_id', $poIds)
            ->groupBy('po_id', 'status')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $poId = (int) $r->po_id;
            $out[$poId] = $out[$poId] ?? ['not_started' => 0, 'in_progress' => 0, 'completed' => 0, 'total' => 0];
            $bucket = match (true) {
                in_array($r->status, ['completed', 'shipped', 'delivered'], true) => 'completed',
                in_array($r->status, ['in_production', 'fabric_inhouse', 'cutting', 'sewing', 'finishing'], true) => 'in_progress',
                default => 'not_started',
            };
            $out[$poId][$bucket] += (int) $r->cnt;
            $out[$poId]['total'] += (int) $r->cnt;
        }
        return $out;
    }

    /** @param int[] $poIds */
    private function aggregateShipmentsByPo(array $poIds): array
    {
        if (empty($poIds)) return [];
        if (!\Illuminate\Support\Facades\Schema::hasTable('shipments')) return [];

        $rows = DB::table('shipments')
            ->select('purchase_order_id', 'status', 'estimated_delivery_date')
            ->whereIn('purchase_order_id', $poIds)
            ->get();

        $today = now()->toDateString();
        $out = [];
        foreach ($rows as $r) {
            $poId = (int) $r->purchase_order_id;
            $out[$poId] = $out[$poId] ?? ['preparing' => 0, 'in_transit' => 0, 'delivered' => 0, 'overdue' => 0, 'total' => 0];
            $bucket = match ($r->status) {
                'delivered' => 'delivered',
                'in_transit', 'customs', 'out_for_delivery' => 'in_transit',
                default => 'preparing',
            };
            $out[$poId][$bucket]++;
            $out[$poId]['total']++;
            if ($r->status !== 'delivered' && $r->estimated_delivery_date && $r->estimated_delivery_date < $today) {
                $out[$poId]['overdue']++;
            }
        }
        return $out;
    }

    /** @param int[] $poIds */
    private function aggregateQualityByPo(array $poIds): array
    {
        if (empty($poIds)) return [];
        if (!\Illuminate\Support\Facades\Schema::hasTable('quality_inspections')) return [];

        $rows = DB::table('quality_inspections')
            ->join('purchase_order_style', 'purchase_order_style.style_id', '=', 'quality_inspections.style_id')
            ->select('purchase_order_style.po_id', 'quality_inspections.result', DB::raw('count(*) as cnt'))
            ->whereIn('purchase_order_style.po_id', $poIds)
            ->groupBy('purchase_order_style.po_id', 'quality_inspections.result')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $poId = (int) $r->po_id;
            $out[$poId] = $out[$poId] ?? ['passed' => 0, 'failed' => 0, 'pending' => 0, 'total' => 0];
            $bucket = match ($r->result) {
                'passed' => 'passed',
                'failed' => 'failed',
                default => 'pending',
            };
            $out[$poId][$bucket] += (int) $r->cnt;
            $out[$poId]['total'] += (int) $r->cnt;
        }
        return $out;
    }

    /** @param int[] $poIds */
    private function aggregateFactoriesByPo(array $poIds): array
    {
        if (empty($poIds)) return [];
        if (!\Illuminate\Support\Facades\Schema::hasTable('factory_assignments')) return [];

        $rows = DB::table('factory_assignments')
            ->join('users', 'users.id', '=', 'factory_assignments.factory_id')
            ->select('factory_assignments.purchase_order_id as po_id', 'users.id', 'users.name')
            ->whereIn('factory_assignments.purchase_order_id', $poIds)
            ->distinct()
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $poId = (int) $r->po_id;
            $out[$poId] = $out[$poId] ?? [];
            $out[$poId][] = ['id' => (int) $r->id, 'name' => $r->name];
        }
        return $out;
    }

    private function classifyEtd(?string $etdDate, ?string $status, string $today): string
    {
        if (!$etdDate) return 'none';
        if (in_array($status, ['completed', 'cancelled'], true)) return 'on_track';
        $etd = substr($etdDate, 0, 10);
        if ($etd < $today) return 'overdue';
        $diff = (strtotime($etd) - strtotime($today)) / 86400;
        if ($diff <= 7) return 'urgent';
        if ($diff <= 30) return 'soon';
        return 'on_track';
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
        if ($user->hasRole('Factory')) {
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
            'aqlLevel:id,name',
            'inspector:id,name',
        ]);

        // Apply filters
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('inspected_at', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['result'])) {
            $query->where('result', $filters['result']);
        }

        // Apply user-based access control
        if ($user->hasRole('qc_inspector')) {
            $query->where('inspector_id', $user->id);
        }

        $inspections = $query->get()->map(function ($inspection) {
            return [
                'inspection_number' => $inspection->inspection_number,
                'style_number' => $inspection->style->style_number ?? '-',
                'aql_level' => $inspection->aqlLevel->name ?? '-',
                'inspector' => $inspection->inspector->name ?? '-',
                'inspected_at' => $inspection->inspected_at?->format('Y-m-d'),
                'lot_size' => $inspection->lot_size,
                'sample_size' => $inspection->sample_size,
                'result' => $inspection->result,
                'critical_defects' => $inspection->critical_defects,
                'major_defects' => $inspection->major_defects,
                'minor_defects' => $inspection->minor_defects,
                'total_defects' => ($inspection->critical_defects ?? 0) + ($inspection->major_defects ?? 0) + ($inspection->minor_defects ?? 0),
            ];
        });

        $summary = [
            'total_inspections' => $inspections->count(),
            'passed' => $inspections->where('result', 'passed')->count(),
            'failed' => $inspections->where('result', 'failed')->count(),
            'pass_rate' => $inspections->count() > 0 ? round(($inspections->where('result', 'passed')->count() / $inspections->count()) * 100, 2) : 0,
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
        if ($user->hasRole('Importer')) {
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

    /**
     * Get factory-wise report: all orders grouped by factory with summary and row-level detail.
     */
    public function getFactoryWiseReport(User $user, array $filters): array
    {
        $query = PurchaseOrderStyle::query()
            ->whereNotNull('assigned_factory_id')
            ->with([
                'purchaseOrder:id,po_number,po_date,status,total_value,ex_factory_date,importer_id,agency_id',
                'purchaseOrder.importer:id,name',
                'purchaseOrder.agency:id,name',
                'style:id,style_number,description,total_quantity,unit_price',
                'assignedFactory:id,name,company',
            ]);

        // Apply PO-level access control
        $poIds = $this->getAccessiblePOIds($user);
        if ($poIds !== null) {
            $query->whereIn('purchase_order_id', $poIds);
        }

        // Filter by factory
        if (!empty($filters['factory_id'])) {
            $query->where('assigned_factory_id', $filters['factory_id']);
        }

        // Filter by date range on PO date
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereHas('purchaseOrder', function ($q) use ($filters) {
                $q->whereBetween('po_date', [$filters['start_date'], $filters['end_date']]);
            });
        }

        $rows = $query->get();

        // Build row-level data
        $items = $rows->map(function ($pos) {
            $po = $pos->purchaseOrder;
            return [
                'id' => $pos->id,
                'po_number' => $po->po_number ?? '-',
                'po_date' => $po->po_date?->format('Y-m-d'),
                'style_number' => $pos->style->style_number ?? '-',
                'style_description' => $pos->style->description ?? '-',
                'factory_id' => $pos->assigned_factory_id,
                'factory_name' => $pos->assignedFactory->name ?? '-',
                'factory_company' => $pos->assignedFactory->company ?? '-',
                'quantity' => $pos->quantity_in_po ?? $pos->style->total_quantity ?? 0,
                'unit_price' => $pos->unit_price_in_po ?? $pos->style->unit_price ?? 0,
                'total_value' => ($pos->quantity_in_po ?? 0) * ($pos->unit_price_in_po ?? $pos->style->unit_price ?? 0),
                'ex_factory_date' => $pos->ex_factory_date?->format('Y-m-d') ?? $po->ex_factory_date?->format('Y-m-d'),
                'estimated_ex_factory_date' => $pos->estimated_ex_factory_date?->format('Y-m-d'),
                'production_status' => $pos->production_status ?? 'pending',
                'shipping_approval_status' => $pos->shipping_approval_status ?? 'pending',
                'po_status' => $po->status ?? '-',
            ];
        });

        // Build factory-level summary
        $factorySummary = $rows->groupBy('assigned_factory_id')->map(function ($group) {
            $factory = $group->first()->assignedFactory;
            $totalQty = $group->sum(fn($pos) => $pos->quantity_in_po ?? $pos->style->total_quantity ?? 0);
            $totalValue = $group->sum(fn($pos) => ($pos->quantity_in_po ?? 0) * ($pos->unit_price_in_po ?? $pos->style->unit_price ?? 0));
            $statusCounts = $group->groupBy(fn($pos) => $pos->production_status ?? 'pending')
                ->map->count()
                ->toArray();

            return [
                'factory_id' => $factory->id ?? null,
                'factory_name' => $factory->name ?? '-',
                'factory_company' => $factory->company ?? '-',
                'total_styles' => $group->count(),
                'total_quantity' => $totalQty,
                'total_value' => round($totalValue, 2),
                'status_breakdown' => $statusCounts,
                'po_count' => $group->pluck('purchase_order_id')->unique()->count(),
            ];
        })->values();

        // List of factories for the filter dropdown
        $factories = $rows->pluck('assignedFactory')
            ->filter()
            ->unique('id')
            ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company])
            ->values();

        return [
            'summary' => [
                'total_factories' => $factorySummary->count(),
                'total_styles' => $items->count(),
                'total_quantity' => $items->sum('quantity'),
                'total_value' => round($items->sum('total_value'), 2),
            ],
            'factory_summary' => $factorySummary,
            'items' => $items,
            'factories' => $factories,
        ];
    }

    /**
     * Get pending-to-ship report: factory orders that haven't shipped yet.
     */
    public function getPendingShipmentsReport(User $user, array $filters): array
    {
        $query = PurchaseOrderStyle::query()
            ->whereNotNull('assigned_factory_id')
            ->where(function ($q) {
                $q->whereNull('production_status')
                  ->orWhereNotIn('production_status', ['shipped']);
            })
            ->where(function ($q) {
                $q->whereNull('shipping_approval_status')
                  ->orWhereIn('shipping_approval_status', ['pending', 'requested', 'agency_approved']);
            })
            ->with([
                'purchaseOrder:id,po_number,po_date,status,ex_factory_date,importer_id,agency_id',
                'purchaseOrder.importer:id,name',
                'style:id,style_number,description,total_quantity,unit_price',
                'assignedFactory:id,name,company',
            ]);

        // Apply PO-level access control
        $poIds = $this->getAccessiblePOIds($user);
        if ($poIds !== null) {
            $query->whereIn('purchase_order_id', $poIds);
        }

        if (!empty($filters['factory_id'])) {
            $query->where('assigned_factory_id', $filters['factory_id']);
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereHas('purchaseOrder', function ($q) use ($filters) {
                $q->whereBetween('po_date', [$filters['start_date'], $filters['end_date']]);
            });
        }

        $rows = $query->get();
        $now = Carbon::today();

        $items = $rows->map(function ($pos) use ($now) {
            $po = $pos->purchaseOrder;
            $exFactory = $pos->ex_factory_date ?? $po->ex_factory_date;
            $daysRemaining = $exFactory ? $now->diffInDays(Carbon::parse($exFactory), false) : null;

            return [
                'id' => $pos->id,
                'po_number' => $po->po_number ?? '-',
                'po_date' => $po->po_date?->format('Y-m-d'),
                'style_number' => $pos->style->style_number ?? '-',
                'style_description' => $pos->style->description ?? '-',
                'factory_id' => $pos->assigned_factory_id,
                'factory_name' => $pos->assignedFactory->name ?? '-',
                'quantity' => $pos->quantity_in_po ?? $pos->style->total_quantity ?? 0,
                'ex_factory_date' => $exFactory?->format('Y-m-d'),
                'estimated_ex_factory_date' => $pos->estimated_ex_factory_date?->format('Y-m-d'),
                'days_remaining' => $daysRemaining,
                'is_overdue' => $daysRemaining !== null && $daysRemaining < 0,
                'production_status' => $pos->production_status ?? 'pending',
                'shipping_approval_status' => $pos->shipping_approval_status ?? 'pending',
            ];
        })->sortBy('days_remaining')->values();

        $factories = $rows->pluck('assignedFactory')
            ->filter()
            ->unique('id')
            ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company])
            ->values();

        return [
            'summary' => [
                'total_pending' => $items->count(),
                'overdue' => $items->where('is_overdue', true)->count(),
                'on_track' => $items->where('is_overdue', false)->count(),
                'total_quantity' => $items->sum('quantity'),
            ],
            'items' => $items,
            'factories' => $factories,
        ];
    }

    /**
     * Get pending samples report: samples awaiting approval, grouped by factory.
     */
    public function getPendingSamplesReport(User $user, array $filters): array
    {
        $query = Sample::query()
            ->where(function ($q) {
                $q->where('final_status', 'pending')
                  ->orWhere('agency_status', 'pending')
                  ->orWhere('importer_status', 'pending');
            })
            ->with([
                'style:id,style_number,description,assigned_factory_id',
                'style.assignedFactory:id,name,company',
                'style.purchaseOrders:id,po_number',
                'sampleType:id,name,display_name,typical_days',
                'submittedBy:id,name',
            ]);

        // Apply PO-level access control
        $poIds = $this->getAccessiblePOIds($user);
        if ($poIds !== null) {
            $query->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                $q->whereIn('purchase_orders.id', $poIds);
            });
        }

        if (!empty($filters['factory_id'])) {
            $query->whereHas('style', function ($q) use ($filters) {
                $q->where('assigned_factory_id', $filters['factory_id']);
            });
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('submission_date', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['sample_type'])) {
            $query->where('sample_type_id', $filters['sample_type']);
        }

        $rows = $query->get();
        $now = Carbon::today();

        $items = $rows->map(function ($sample) use ($now) {
            $style = $sample->style;
            $factory = $style?->assignedFactory;
            $poNumber = $style?->purchaseOrders?->first()?->po_number ?? '-';
            $submissionDate = $sample->submission_date ? Carbon::parse($sample->submission_date) : null;
            $daysPending = $submissionDate ? $submissionDate->diffInDays($now) : null;

            return [
                'id' => $sample->id,
                'po_number' => $poNumber,
                'style_number' => $style->style_number ?? '-',
                'factory_id' => $factory->id ?? null,
                'factory_name' => $factory->name ?? '-',
                'sample_type' => $sample->sampleType->display_name ?? $sample->sampleType->name ?? '-',
                'sample_reference' => $sample->sample_reference,
                'submission_date' => $sample->submission_date,
                'days_pending' => $daysPending,
                'typical_days' => $sample->sampleType->typical_days ?? null,
                'is_overdue' => ($daysPending !== null && $sample->sampleType?->typical_days)
                    ? $daysPending > $sample->sampleType->typical_days
                    : false,
                'agency_status' => $sample->agency_status,
                'importer_status' => $sample->importer_status,
                'final_status' => $sample->final_status,
                'submitted_by' => $sample->submittedBy->name ?? '-',
                'notes' => $sample->notes,
            ];
        })->sortByDesc('days_pending')->values();

        // Get factory list from the styles
        $factories = $rows->map(fn($s) => $s->style?->assignedFactory)
            ->filter()
            ->unique('id')
            ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company])
            ->values();

        return [
            'summary' => [
                'total_pending' => $items->count(),
                'pending_agency' => $items->where('agency_status', 'pending')->count(),
                'pending_importer' => $items->where('importer_status', 'pending')->count(),
                'overdue' => $items->where('is_overdue', true)->count(),
            ],
            'items' => $items,
            'factories' => $factories,
        ];
    }

    /**
     * Get approved samples report: all samples that have been fully approved.
     */
    public function getApprovedSamplesReport(User $user, array $filters): array
    {
        $query = Sample::query()
            ->where('final_status', 'approved')
            ->with([
                'style:id,style_number,description,assigned_factory_id',
                'style.assignedFactory:id,name,company',
                'style.purchaseOrders:id,po_number',
                'sampleType:id,name,display_name,typical_days',
                'submittedBy:id,name',
                'agencyApprovedBy:id,name',
                'importerApprovedBy:id,name',
            ]);

        // Apply PO-level access control
        $poIds = $this->getAccessiblePOIds($user);
        if ($poIds !== null) {
            $query->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                $q->whereIn('purchase_orders.id', $poIds);
            });
        }

        if (!empty($filters['factory_id'])) {
            $query->whereHas('style', function ($q) use ($filters) {
                $q->where('assigned_factory_id', $filters['factory_id']);
            });
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $query->whereBetween('submission_date', [$filters['start_date'], $filters['end_date']]);
        }

        if (!empty($filters['sample_type'])) {
            $query->where('sample_type_id', $filters['sample_type']);
        }

        $rows = $query->get();

        $items = $rows->map(function ($sample) {
            $style = $sample->style;
            $factory = $style?->assignedFactory;
            $poNumber = $style?->purchaseOrders?->first()?->po_number ?? '-';

            return [
                'id' => $sample->id,
                'po_number' => $poNumber,
                'style_number' => $style->style_number ?? '-',
                'factory_id' => $factory->id ?? null,
                'factory_name' => $factory->name ?? '-',
                'sample_type' => $sample->sampleType->display_name ?? $sample->sampleType->name ?? '-',
                'sample_reference' => $sample->sample_reference,
                'submission_date' => $sample->submission_date,
                'agency_status' => $sample->agency_status,
                'agency_approved_by' => $sample->agencyApprovedBy->name ?? '-',
                'agency_approved_at' => $sample->agency_approved_at,
                'importer_status' => $sample->importer_status,
                'importer_approved_by' => $sample->importerApprovedBy->name ?? '-',
                'importer_approved_at' => $sample->importer_approved_at,
                'final_status' => $sample->final_status,
                'submitted_by' => $sample->submittedBy->name ?? '-',
                'notes' => $sample->notes,
            ];
        })->sortByDesc('submission_date')->values();

        // Get factory list from the styles
        $factories = $rows->map(fn($s) => $s->style?->assignedFactory)
            ->filter()
            ->unique('id')
            ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company])
            ->values();

        return [
            'summary' => [
                'total_approved' => $items->count(),
                'by_agency' => $items->where('agency_status', 'approved')->count(),
                'by_importer' => $items->where('importer_status', 'approved')->count(),
            ],
            'items' => $items,
            'factories' => $factories,
        ];
    }

    /**
     * Get delay report: all delayed items across shipments, ex-factory dates, and samples.
     */
    public function getDelayReport(User $user, array $filters): array
    {
        $now = Carbon::today();
        $delays = collect();

        // Apply PO-level access control
        $poIds = $this->getAccessiblePOIds($user);

        // --- 1. Shipment Delays ---
        $shipmentQuery = Shipment::query()
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->where('estimated_delivery_date', '<', $now)
            ->with([
                'purchaseOrder:id,po_number,agency_id,importer_id',
                'purchaseOrder.importer:id,name',
            ]);

        if ($poIds !== null) {
            $shipmentQuery->whereIn('purchase_order_id', $poIds);
        }

        if (!empty($filters['factory_id'])) {
            $shipmentQuery->whereHas('purchaseOrder.styles', function ($q) use ($filters) {
                $q->where('purchase_order_style.assigned_factory_id', $filters['factory_id']);
            });
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $shipmentQuery->whereBetween('estimated_delivery_date', [$filters['start_date'], $filters['end_date']]);
        }

        $shipmentQuery->get()->each(function ($shipment) use ($delays, $now) {
            $daysDelayed = Carbon::parse($shipment->estimated_delivery_date)->diffInDays($now);
            $delays->push([
                'delay_type' => 'shipment',
                'po_number' => $shipment->purchaseOrder->po_number ?? '-',
                'style_number' => '-',
                'factory_name' => '-',
                'reference' => $shipment->shipment_reference ?? $shipment->tracking_number ?? '-',
                'expected_date' => $shipment->estimated_delivery_date?->format('Y-m-d'),
                'actual_date' => null,
                'days_delayed' => $daysDelayed,
                'status' => $shipment->status,
                'severity' => $daysDelayed > 7 ? 'critical' : 'warning',
                'details' => "Shipment {$shipment->shipment_reference} delayed - expected delivery was " . $shipment->estimated_delivery_date?->format('Y-m-d'),
            ]);
        });

        // --- 2. Ex-Factory Delays ---
        $exFactoryQuery = PurchaseOrderStyle::query()
            ->whereNotNull('assigned_factory_id')
            ->where(function ($q) {
                $q->whereNull('production_status')
                  ->orWhereNotIn('production_status', ['shipped']);
            })
            ->where(function ($q) use ($now) {
                $q->where('ex_factory_date', '<', $now)
                  ->orWhereHas('purchaseOrder', function ($pq) use ($now) {
                      $pq->where('ex_factory_date', '<', $now);
                  });
            })
            ->with([
                'purchaseOrder:id,po_number,ex_factory_date',
                'style:id,style_number',
                'assignedFactory:id,name',
            ]);

        if ($poIds !== null) {
            $exFactoryQuery->whereIn('purchase_order_id', $poIds);
        }

        if (!empty($filters['factory_id'])) {
            $exFactoryQuery->where('assigned_factory_id', $filters['factory_id']);
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $exFactoryQuery->where(function ($q) use ($filters) {
                $q->whereBetween('ex_factory_date', [$filters['start_date'], $filters['end_date']])
                  ->orWhereHas('purchaseOrder', function ($pq) use ($filters) {
                      $pq->whereBetween('ex_factory_date', [$filters['start_date'], $filters['end_date']]);
                  });
            });
        }

        $exFactoryQuery->get()->each(function ($pos) use ($delays, $now) {
            $exFactory = $pos->ex_factory_date ?? $pos->purchaseOrder->ex_factory_date;
            if (!$exFactory) return;
            $daysDelayed = Carbon::parse($exFactory)->diffInDays($now);

            $delays->push([
                'delay_type' => 'ex_factory',
                'po_number' => $pos->purchaseOrder->po_number ?? '-',
                'style_number' => $pos->style->style_number ?? '-',
                'factory_name' => $pos->assignedFactory->name ?? '-',
                'reference' => $pos->purchaseOrder->po_number ?? '-',
                'expected_date' => Carbon::parse($exFactory)->format('Y-m-d'),
                'actual_date' => null,
                'days_delayed' => $daysDelayed,
                'status' => $pos->production_status ?? 'pending',
                'severity' => $daysDelayed > 7 ? 'critical' : 'warning',
                'details' => "Ex-factory date passed for {$pos->style->style_number} at {$pos->assignedFactory->name}",
            ]);
        });

        // --- 3. Sample Delays ---
        $sampleQuery = Sample::query()
            ->where('final_status', 'pending')
            ->whereNotNull('submission_date')
            ->with([
                'style:id,style_number,assigned_factory_id',
                'style.assignedFactory:id,name',
                'style.purchaseOrders:id,po_number',
                'sampleType:id,name,display_name,typical_days',
            ]);

        if ($poIds !== null) {
            $sampleQuery->whereHas('style.purchaseOrders', function ($q) use ($poIds) {
                $q->whereIn('purchase_orders.id', $poIds);
            });
        }

        if (!empty($filters['factory_id'])) {
            $sampleQuery->whereHas('style', function ($q) use ($filters) {
                $q->where('assigned_factory_id', $filters['factory_id']);
            });
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $sampleQuery->whereBetween('submission_date', [$filters['start_date'], $filters['end_date']]);
        }

        $sampleQuery->get()->each(function ($sample) use ($delays, $now) {
            $typicalDays = $sample->sampleType->typical_days ?? null;
            if (!$typicalDays) return;

            $daysPending = Carbon::parse($sample->submission_date)->diffInDays($now);
            if ($daysPending <= $typicalDays) return;

            $daysOverdue = $daysPending - $typicalDays;
            $factory = $sample->style?->assignedFactory;
            $poNumber = $sample->style?->purchaseOrders?->first()?->po_number ?? '-';

            $delays->push([
                'delay_type' => 'sample',
                'po_number' => $poNumber,
                'style_number' => $sample->style->style_number ?? '-',
                'factory_name' => $factory->name ?? '-',
                'reference' => $sample->sample_reference ?? $sample->sampleType->display_name ?? '-',
                'expected_date' => Carbon::parse($sample->submission_date)->addDays($typicalDays)->format('Y-m-d'),
                'actual_date' => null,
                'days_delayed' => $daysOverdue,
                'status' => $sample->final_status,
                'severity' => $daysOverdue > 7 ? 'critical' : 'warning',
                'details' => "{$sample->sampleType->display_name} for {$sample->style->style_number} overdue by {$daysOverdue} days",
            ]);
        });

        // Sort by days delayed desc
        $sorted = $delays->sortByDesc('days_delayed')->values();

        // Factory list for filter
        $factories = collect();
        if ($poIds !== null) {
            $factories = PurchaseOrderStyle::whereIn('purchase_order_id', $poIds)
                ->whereNotNull('assigned_factory_id')
                ->with('assignedFactory:id,name,company')
                ->get()
                ->pluck('assignedFactory')
                ->filter()
                ->unique('id')
                ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company])
                ->values();
        } else {
            $factories = User::role('Factory')->select('id', 'name', 'company')->get()
                ->map(fn($f) => ['id' => $f->id, 'name' => $f->name, 'company' => $f->company]);
        }

        return [
            'summary' => [
                'total_delays' => $sorted->count(),
                'shipment_delays' => $sorted->where('delay_type', 'shipment')->count(),
                'ex_factory_delays' => $sorted->where('delay_type', 'ex_factory')->count(),
                'sample_delays' => $sorted->where('delay_type', 'sample')->count(),
                'critical_count' => $sorted->where('severity', 'critical')->count(),
            ],
            'items' => $sorted,
            'factories' => $factories,
        ];
    }
}
