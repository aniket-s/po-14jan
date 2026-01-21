<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Trim;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class TrimController extends Controller
{
    /**
     * Display a listing of trims.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Trim::with('brand');

        // Filter by brand
        if ($request->has('brand_id')) {
            $query->byBrand($request->brand_id);
        }

        // Filter by trim type
        if ($request->has('trim_type')) {
            $query->byType($request->trim_type);
        }

        // Filter by active status
        if ($request->has('active_only')) {
            $query->active();
        }

        // Search by trim code or description
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('trim_code', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Return all if requested (for dropdowns)
        if ($request->has('all') && $request->all === 'true') {
            return response()->json($query->active()->orderBy('trim_code')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $trims = $query->orderBy('trim_code')->paginate($perPage);

        return response()->json($trims);
    }

    /**
     * Store a newly created trim.
     * Now supports multiple trim types (array) and removes file_path (specification document)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'brand_id' => 'required|exists:brands,id',
            'trim_types' => 'required|array|min:1', // Now supports multiple selection
            'trim_types.*' => 'string', // Each type should be a string
            'trim_code' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image_path' => 'nullable|string', // Now accepts PDF, AI, and images
            // 'file_path' removed - specification document no longer needed
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $trim = Trim::create($validator->validated());

        return response()->json([
            'message' => 'Trim created successfully',
            'data' => $trim->load('brand')
        ], 201);
    }

    /**
     * Display the specified trim.
     */
    public function show(Trim $trim): JsonResponse
    {
        return response()->json($trim->load('brand'));
    }

    /**
     * Update the specified trim.
     * Now supports multiple trim types (array) and removes file_path
     */
    public function update(Request $request, Trim $trim): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'brand_id' => 'sometimes|required|exists:brands,id',
            'trim_types' => 'sometimes|required|array|min:1', // Now supports multiple selection
            'trim_types.*' => 'string', // Each type should be a string
            'trim_code' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'image_path' => 'nullable|string', // Now accepts PDF, AI, and images
            // 'file_path' removed - specification document no longer needed
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $trim->update($validator->validated());

        return response()->json([
            'message' => 'Trim updated successfully',
            'data' => $trim->load('brand')
        ]);
    }

    /**
     * Remove the specified trim (soft delete).
     */
    public function destroy(Trim $trim): JsonResponse
    {
        $trim->delete();

        return response()->json([
            'message' => 'Trim deleted successfully'
        ]);
    }

    /**
     * Upload trim image.
     * Now accepts PDF, AI, EPS files in addition to standard images
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            // Now accepts: images + PDF, AI, EPS, SVG files
            'image' => 'required|file|mimes:jpeg,png,jpg,gif,svg,webp,pdf,ai,eps|max:20480', // 20MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('image');
        $storedPath = $file->store('trims/images', 'public');

        // Remove 'public/' prefix if present (Laravel sometimes adds this)
        $path = str_replace('public/', '', $storedPath);

        // Build absolute URL with request scheme and host
        $url = $request->getSchemeAndHttpHost() . '/storage/' . $path;

        // Determine file type for frontend display
        $extension = strtolower($file->getClientOriginalExtension());
        $isDocument = in_array($extension, ['pdf', 'ai', 'eps']);

        return response()->json([
            'message' => 'File uploaded successfully',
            'path' => $path,
            'url' => $url,
            'is_document' => $isDocument,
            'extension' => $extension
        ]);
    }

    /**
     * Upload trim file/document.
     * DEPRECATED: Use uploadImage instead - now supports all file types
     */
    public function uploadFile(Request $request): JsonResponse
    {
        // Redirect to uploadImage which now handles all file types
        return $this->uploadImage($request);
    }

    /**
     * Get trim types list.
     */
    public function types(): JsonResponse
    {
        return response()->json(Trim::TRIM_TYPES);
    }
}
