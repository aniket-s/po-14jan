<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ImportMapping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class ImportMappingController extends Controller
{
    /**
     * Display a listing of the user's import mappings.
     */
    public function index(Request $request)
    {
        $mappings = ImportMapping::where('user_id', Auth::id())
            ->when($request->import_type, function ($query, $type) {
                return $query->where('import_type', $type);
            })
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($mappings);
    }

    /**
     * Store a newly created import mapping.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'import_type' => 'required|string|in:styles',
            'column_mapping' => 'required|array',
            'is_default' => 'boolean',
        ]);

        // If setting as default, unset any existing defaults for this import type
        if ($validated['is_default'] ?? false) {
            ImportMapping::where('user_id', Auth::id())
                ->where('import_type', $validated['import_type'])
                ->update(['is_default' => false]);
        }

        $mapping = ImportMapping::create([
            'user_id' => Auth::id(),
            'name' => $validated['name'],
            'import_type' => $validated['import_type'],
            'column_mapping' => $validated['column_mapping'],
            'is_default' => $validated['is_default'] ?? false,
        ]);

        return response()->json([
            'message' => 'Import mapping saved successfully',
            'mapping' => $mapping
        ], 201);
    }

    /**
     * Display the specified import mapping.
     */
    public function show(string $id)
    {
        $mapping = ImportMapping::where('user_id', Auth::id())
            ->findOrFail($id);

        return response()->json($mapping);
    }

    /**
     * Update the specified import mapping.
     */
    public function update(Request $request, string $id)
    {
        $mapping = ImportMapping::where('user_id', Auth::id())
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'column_mapping' => 'sometimes|array',
            'is_default' => 'sometimes|boolean',
        ]);

        // If setting as default, unset any existing defaults for this import type
        if (($validated['is_default'] ?? false) && !$mapping->is_default) {
            ImportMapping::where('user_id', Auth::id())
                ->where('import_type', $mapping->import_type)
                ->where('id', '!=', $mapping->id)
                ->update(['is_default' => false]);
        }

        $mapping->update($validated);

        return response()->json([
            'message' => 'Import mapping updated successfully',
            'mapping' => $mapping
        ]);
    }

    /**
     * Remove the specified import mapping.
     */
    public function destroy(string $id)
    {
        $mapping = ImportMapping::where('user_id', Auth::id())
            ->findOrFail($id);

        $mapping->delete();

        return response()->json([
            'message' => 'Import mapping deleted successfully'
        ]);
    }

    /**
     * Get the default mapping for a specific import type.
     */
    public function getDefault(Request $request)
    {
        $importType = $request->query('import_type', 'styles');

        $mapping = ImportMapping::where('user_id', Auth::id())
            ->where('import_type', $importType)
            ->where('is_default', true)
            ->first();

        if (!$mapping) {
            return response()->json([
                'message' => 'No default mapping found'
            ], 404);
        }

        return response()->json($mapping);
    }
}
