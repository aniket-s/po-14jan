<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FileUploadController extends Controller
{
    /**
     * Upload a single file
     */
    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240', // Max 10MB
            'type' => 'nullable|in:image,document,attachment',
            'folder' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $file = $request->file('file');
            $type = $request->input('type', 'attachment');
            $folder = $request->input('folder', 'uploads');

            // Generate unique filename
            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $filename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME))
                . '-' . time()
                . '.' . $extension;

            // Determine storage path based on type
            $path = $file->storeAs(
                "public/{$folder}/{$type}",
                $filename
            );

            // Get public URL - use the API domain instead of APP_URL
            $relativePath = str_replace('public/', '', $path);
            $url = url('/storage/' . $relativePath);

            return response()->json([
                'message' => 'File uploaded successfully',
                'file' => [
                    'path' => $path,
                    'url' => $url,
                    'filename' => $filename,
                    'original_name' => $originalName,
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                ],
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'File upload failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload multiple files
     */
    public function uploadMultiple(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'files' => 'required|array',
            'files.*' => 'file|max:10240', // Max 10MB per file
            'type' => 'nullable|in:image,document,attachment',
            'folder' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $type = $request->input('type', 'attachment');
            $folder = $request->input('folder', 'uploads');
            $uploadedFiles = [];

            foreach ($request->file('files') as $file) {
                // Generate unique filename
                $originalName = $file->getClientOriginalName();
                $extension = $file->getClientOriginalExtension();
                $filename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME))
                    . '-' . time() . '-' . Str::random(6)
                    . '.' . $extension;

                // Store file
                $path = $file->storeAs(
                    "public/{$folder}/{$type}",
                    $filename
                );

                // Get public URL - use the API domain instead of APP_URL
                $relativePath = str_replace('public/', '', $path);
                $url = url('/storage/' . $relativePath);

                $uploadedFiles[] = [
                    'path' => $path,
                    'url' => $url,
                    'filename' => $filename,
                    'original_name' => $originalName,
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                ];
            }

            return response()->json([
                'message' => 'Files uploaded successfully',
                'files' => $uploadedFiles,
                'count' => count($uploadedFiles),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'File upload failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload style images (multiple)
     */
    public function uploadStyleImages(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'images' => 'required|array',
            'images.*' => 'image|mimes:jpeg,jpg,png|max:10240', // Max 10MB per image
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uploadedImages = [];

            foreach ($request->file('images') as $image) {
                // Generate unique filename
                $originalName = $image->getClientOriginalName();
                $extension = $image->getClientOriginalExtension();
                $filename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME))
                    . '-' . time() . '-' . Str::random(6)
                    . '.' . $extension;

                // Store in styles/images directory
                $path = $image->storeAs(
                    'public/styles/images',
                    $filename
                );

                // Get public URL - use the API domain instead of APP_URL
                $relativePath = str_replace('public/', '', $path);
                $url = url('/storage/' . $relativePath);

                $uploadedImages[] = [
                    'path' => $path,
                    'url' => $url,
                    'filename' => $filename,
                    'original_name' => $originalName,
                    'size' => $image->getSize(),
                    'mime_type' => $image->getMimeType(),
                ];
            }

            return response()->json([
                'message' => 'Images uploaded successfully',
                'images' => $uploadedImages,
                'count' => count($uploadedImages),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Image upload failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload technical files (multiple) - .ai, .pdf, .jpg, .jpeg, .png
     */
    public function uploadTechnicalFiles(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'files' => 'required|array',
            'files.*' => 'file|mimes:ai,pdf,jpeg,jpg,png|max:20480', // Max 20MB per file
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $uploadedFiles = [];

            foreach ($request->file('files') as $file) {
                // Generate unique filename
                $originalName = $file->getClientOriginalName();
                $extension = $file->getClientOriginalExtension();
                $filename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME))
                    . '-' . time() . '-' . Str::random(6)
                    . '.' . $extension;

                // Store in styles/technical directory
                $path = $file->storeAs(
                    'public/styles/technical',
                    $filename
                );

                // Get public URL - use the API domain instead of APP_URL
                $relativePath = str_replace('public/', '', $path);
                $url = url('/storage/' . $relativePath);

                $uploadedFiles[] = [
                    'path' => $path,
                    'url' => $url,
                    'filename' => $filename,
                    'original_name' => $originalName,
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                ];
            }

            return response()->json([
                'message' => 'Technical files uploaded successfully',
                'files' => $uploadedFiles,
                'count' => count($uploadedFiles),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Technical file upload failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a file
     */
    public function delete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $path = $request->input('path');

            if (Storage::exists($path)) {
                Storage::delete($path);
                return response()->json([
                    'message' => 'File deleted successfully',
                ]);
            }

            return response()->json([
                'message' => 'File not found',
            ], 404);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'File deletion failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
