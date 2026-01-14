<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Style;
use App\Models\SampleType;
use App\Models\StyleSampleProcess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StyleSampleProcessController extends Controller
{
    /**
     * Get sample processes for a style
     */
    public function index(Request $request, $styleId)
    {
        $style = Style::findOrFail($styleId);

        $processes = $style->sampleProcesses()
            ->with('sampleType')
            ->get();

        return response()->json([
            'sample_processes' => $processes,
        ]);
    }

    /**
     * Bulk assign sample processes to multiple styles
     */
    public function bulkAssign(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'style_ids' => 'required|array',
            'style_ids.*' => 'exists:styles,id',
            'sample_type_ids' => 'required|array',
            'sample_type_ids.*' => 'exists:sample_types,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $styleIds = $request->input('style_ids');
            $sampleTypeIds = $request->input('sample_type_ids');

            foreach ($styleIds as $styleId) {
                // Clear existing processes for this style
                StyleSampleProcess::where('style_id', $styleId)->delete();

                // Create new processes with priority based on array order
                foreach ($sampleTypeIds as $index => $sampleTypeId) {
                    StyleSampleProcess::create([
                        'style_id' => $styleId,
                        'sample_type_id' => $sampleTypeId,
                        'priority' => $index + 1,
                        'is_required' => true,
                        'status' => 'pending',
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Sample processes assigned successfully',
                'styles_updated' => count($styleIds),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to assign sample processes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reorder sample process priorities for a style
     */
    public function reorder(Request $request, $styleId)
    {
        $validator = Validator::make($request->all(), [
            'priorities' => 'required|array',
            'priorities.*.process_id' => 'required|exists:style_sample_processes,id',
            'priorities.*.priority' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $style = Style::findOrFail($styleId);

        DB::beginTransaction();
        try {
            foreach ($request->input('priorities') as $item) {
                $process = StyleSampleProcess::where('id', $item['process_id'])
                    ->where('style_id', $styleId)
                    ->firstOrFail();

                $process->priority = $item['priority'];
                $process->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Sample process priorities updated successfully',
                'sample_processes' => $style->sampleProcesses()->with('sampleType')->get(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to reorder sample processes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add custom sample type and assign to style
     */
    public function addCustomType(Request $request, $styleId)
    {
        $validator = Validator::make($request->all(), [
            'display_name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'priority' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $style = Style::findOrFail($styleId);

        DB::beginTransaction();
        try {
            // Create custom sample type
            $name = strtolower(str_replace(' ', '_', $request->input('display_name')));
            $name = preg_replace('/[^a-z0-9_]/', '', $name);

            $sampleType = SampleType::create([
                'name' => $name . '_' . time(),
                'display_name' => $request->input('display_name'),
                'description' => $request->input('description'),
                'prerequisites' => [],
                'required_for_production' => false,
                'parallel_submission_allowed' => true,
                'typical_days' => 7,
                'display_order' => 999,
                'max_images' => 10,
                'is_active' => true,
                'is_custom' => true,
                'created_by' => auth()->id(),
            ]);

            // Add to style's sample processes
            StyleSampleProcess::create([
                'style_id' => $styleId,
                'sample_type_id' => $sampleType->id,
                'priority' => $request->input('priority'),
                'is_required' => false,
                'status' => 'pending',
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Custom sample type created and assigned successfully',
                'sample_type' => $sampleType,
                'sample_processes' => $style->sampleProcesses()->with('sampleType')->get(),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create custom sample type',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove a sample process from a style
     */
    public function destroy($styleId, $processId)
    {
        $process = StyleSampleProcess::where('id', $processId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        $process->delete();

        return response()->json([
            'message' => 'Sample process removed successfully',
        ]);
    }

    /**
     * Update a specific sample process
     */
    public function update(Request $request, $styleId, $processId)
    {
        $validator = Validator::make($request->all(), [
            'priority' => 'sometimes|integer|min:1',
            'is_required' => 'sometimes|boolean',
            'status' => 'sometimes|in:pending,in_progress,approved,rejected,skipped',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $process = StyleSampleProcess::where('id', $processId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        $process->update($request->only(['priority', 'is_required', 'status']));

        return response()->json([
            'message' => 'Sample process updated successfully',
            'sample_process' => $process->load('sampleType'),
        ]);
    }
}
