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
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'brand_id' => 'required|exists:brands,id',
            'trim_type' => 'required|in:main_label,size_label,tag_1,tag_2,wash_care_label,special_label,special_tag,price_ticket',
            'trim_code' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image_path' => 'nullable|string',
            'file_path' => 'nullable|string',
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
     */
    public function update(Request $request, Trim $trim): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'brand_id' => 'sometimes|required|exists:brands,id',
            'trim_type' => 'sometimes|required|in:main_label,size_label,tag_1,tag_2,wash_care_label,special_label,special_tag,price_ticket',
            'trim_code' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'image_path' => 'nullable|string',
            'file_path' => 'nullable|string',
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
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,svg|max:10240', // 10MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('image');
        $path = $file->store('trims/images', 'public');

        return response()->json([
            'message' => 'Image uploaded successfully',
            'path' => $path,
            'url' => Storage::url($path)
        ]);
    }

    /**
     * Upload trim file/document.
     */
    public function uploadFile(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:pdf,doc,docx,xlsx,xls,txt|max:20480', // 20MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('file');
        $path = $file->store('trims/files', 'public');

        return response()->json([
            'message' => 'File uploaded successfully',
            'path' => $path,
            'url' => Storage::url($path)
        ]);
    }

    /**
     * Get trim types list.
     */
    public function types(): JsonResponse
    {
        return response()->json(Trim::TRIM_TYPES);
    }
}
