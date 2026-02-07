<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShipOption;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShipOptionController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * List ship options with filtering
     */
    public function index(Request $request)
    {
        $query = ShipOption::with('creator:id,name');

        if ($request->has('month') && $request->has('year')) {
            $query->forMonth((int) $request->month, (int) $request->year);
        } elseif ($request->has('year')) {
            $query->where('year', $request->year);
        }

        if ($request->boolean('active_only', true)) {
            $query->active();
        }

        if ($request->has('port_of_loading')) {
            $query->where('port_of_loading', 'like', "%{$request->port_of_loading}%");
        }

        if ($request->has('port_of_discharge')) {
            $query->where('port_of_discharge', 'like', "%{$request->port_of_discharge}%");
        }

        $shipOptions = $query->orderBy('etd')->get();

        return response()->json([
            'ship_options' => $shipOptions->map(function ($option) {
                return [
                    'id' => $option->id,
                    'name' => $option->name,
                    'month' => $option->month,
                    'year' => $option->year,
                    'etd' => $option->etd->format('Y-m-d'),
                    'eta' => $option->eta->format('Y-m-d'),
                    'cutoff_date' => $option->cutoff_date->format('Y-m-d'),
                    'vessel_name' => $option->vessel_name,
                    'port_of_loading' => $option->port_of_loading,
                    'port_of_discharge' => $option->port_of_discharge,
                    'notes' => $option->notes,
                    'is_active' => $option->is_active,
                    'created_by' => $option->creator ? [
                        'id' => $option->creator->id,
                        'name' => $option->creator->name,
                    ] : null,
                    'created_at' => $option->created_at,
                ];
            }),
        ]);
    }

    /**
     * Create a new ship option
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'etd' => 'required|date',
            'eta' => 'required|date|after:etd',
            'vessel_name' => 'nullable|string|max:150',
            'port_of_loading' => 'nullable|string|max:150',
            'port_of_discharge' => 'nullable|string|max:150',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $shipOption = ShipOption::create([
            'name' => $request->name,
            'etd' => $request->etd,
            'eta' => $request->eta,
            'vessel_name' => $request->vessel_name,
            'port_of_loading' => $request->port_of_loading,
            'port_of_discharge' => $request->port_of_discharge,
            'notes' => $request->notes,
            'is_active' => $request->input('is_active', true),
            'created_by' => $user->id,
        ]);

        $this->activityLog->logCreated('ShipOption', $shipOption->id, [
            'name' => $shipOption->name,
            'etd' => $shipOption->etd->format('Y-m-d'),
        ]);

        return response()->json([
            'message' => 'Ship option created successfully',
            'ship_option' => [
                'id' => $shipOption->id,
                'name' => $shipOption->name,
                'etd' => $shipOption->etd->format('Y-m-d'),
                'eta' => $shipOption->eta->format('Y-m-d'),
                'cutoff_date' => $shipOption->cutoff_date->format('Y-m-d'),
                'month' => $shipOption->month,
                'year' => $shipOption->year,
            ],
        ], 201);
    }

    /**
     * Show a single ship option
     */
    public function show($id)
    {
        $option = ShipOption::with('creator:id,name')->findOrFail($id);

        return response()->json([
            'ship_option' => [
                'id' => $option->id,
                'name' => $option->name,
                'month' => $option->month,
                'year' => $option->year,
                'etd' => $option->etd->format('Y-m-d'),
                'eta' => $option->eta->format('Y-m-d'),
                'cutoff_date' => $option->cutoff_date->format('Y-m-d'),
                'vessel_name' => $option->vessel_name,
                'port_of_loading' => $option->port_of_loading,
                'port_of_discharge' => $option->port_of_discharge,
                'notes' => $option->notes,
                'is_active' => $option->is_active,
                'created_by' => $option->creator ? [
                    'id' => $option->creator->id,
                    'name' => $option->creator->name,
                ] : null,
            ],
        ]);
    }

    /**
     * Update a ship option
     */
    public function update(Request $request, $id)
    {
        $option = ShipOption::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:150',
            'etd' => 'date',
            'eta' => 'date|after:etd',
            'vessel_name' => 'nullable|string|max:150',
            'port_of_loading' => 'nullable|string|max:150',
            'port_of_discharge' => 'nullable|string|max:150',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $option->update($request->only([
            'name', 'etd', 'eta', 'vessel_name',
            'port_of_loading', 'port_of_discharge', 'notes', 'is_active',
        ]));

        $this->activityLog->log(
            'updated',
            'ShipOption',
            $option->id,
            "Updated ship option {$option->name}",
            $request->only(['name', 'etd', 'eta'])
        );

        return response()->json([
            'message' => 'Ship option updated successfully',
            'ship_option' => [
                'id' => $option->id,
                'name' => $option->name,
                'etd' => $option->etd->format('Y-m-d'),
                'eta' => $option->eta->format('Y-m-d'),
                'cutoff_date' => $option->cutoff_date->format('Y-m-d'),
            ],
        ]);
    }

    /**
     * Delete a ship option
     */
    public function destroy($id)
    {
        $option = ShipOption::findOrFail($id);
        $name = $option->name;
        $option->delete();

        $this->activityLog->log(
            'deleted',
            'ShipOption',
            $id,
            "Deleted ship option {$name}"
        );

        return response()->json([
            'message' => 'Ship option deleted successfully',
        ]);
    }

    /**
     * Suggest connectable ship options for a given estimated ex-factory date.
     * Rule: goods must leave factory 7 days before ship ETD (cutoff_date = ETD - 7).
     */
    public function suggest(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'estimated_ex_factory_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $connectableOptions = ShipOption::findConnectable($request->estimated_ex_factory_date);

        return response()->json([
            'estimated_ex_factory_date' => $request->estimated_ex_factory_date,
            'connectable_ship_options' => $connectableOptions->map(function ($option) {
                return [
                    'id' => $option->id,
                    'name' => $option->name,
                    'etd' => $option->etd->format('Y-m-d'),
                    'eta' => $option->eta->format('Y-m-d'),
                    'cutoff_date' => $option->cutoff_date->format('Y-m-d'),
                    'vessel_name' => $option->vessel_name,
                    'port_of_loading' => $option->port_of_loading,
                    'port_of_discharge' => $option->port_of_discharge,
                ];
            }),
            'earliest_option' => $connectableOptions->first() ? [
                'id' => $connectableOptions->first()->id,
                'name' => $connectableOptions->first()->name,
                'etd' => $connectableOptions->first()->etd->format('Y-m-d'),
                'eta' => $connectableOptions->first()->eta->format('Y-m-d'),
            ] : null,
        ]);
    }
}
