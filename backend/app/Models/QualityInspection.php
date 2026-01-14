<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QualityInspection extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_id',
        'inspector_id',
        'aql_level_id',
        'inspection_number',
        'lot_size',
        'sample_size',
        'accept_point',
        'reject_point',
        'critical_defects',
        'major_defects',
        'minor_defects',
        'defect_details',
        'measurements',
        'images',
        'result',
        'inspector_notes',
        'certificate_number',
        'certificate_path',
        'inspected_at',
    ];

    protected $casts = [
        'lot_size' => 'integer',
        'sample_size' => 'integer',
        'accept_point' => 'integer',
        'reject_point' => 'integer',
        'critical_defects' => 'integer',
        'major_defects' => 'integer',
        'minor_defects' => 'integer',
        'defect_details' => 'array',
        'measurements' => 'array',
        'images' => 'array',
        'inspected_at' => 'datetime',
    ];

    /**
     * Get the style
     */
    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    /**
     * Get the AQL level
     */
    public function aqlLevel()
    {
        return $this->belongsTo(AQLLevel::class);
    }

    /**
     * Get the inspector
     */
    public function inspector()
    {
        return $this->belongsTo(User::class, 'inspector_id');
    }

    /**
     * Get inspection defects (from inspection_defects table)
     */
    public function inspectionDefects()
    {
        return $this->hasMany(InspectionDefect::class);
    }

    /**
     * Scope to filter by style
     */
    public function scopeByStyle($query, $styleId)
    {
        return $query->where('style_id', $styleId);
    }

    /**
     * Scope to filter by result
     */
    public function scopeByResult($query, $result)
    {
        return $query->where('result', $result);
    }

    /**
     * Scope to filter passed inspections
     */
    public function scopePassed($query)
    {
        return $query->where('result', 'passed');
    }

    /**
     * Scope to filter failed inspections
     */
    public function scopeFailed($query)
    {
        return $query->where('result', 'failed');
    }

    /**
     * Check if inspection passed
     */
    public function isPassed(): bool
    {
        return $this->result === 'passed';
    }

    /**
     * Check if inspection failed
     */
    public function isFailed(): bool
    {
        return $this->result === 'failed';
    }

    /**
     * Get total defects found
     */
    public function getTotalDefects(): int
    {
        return $this->critical_defects + $this->major_defects + $this->minor_defects;
    }

    /**
     * Determine inspection result based on defects and accept/reject points
     */
    public function determineResult(): string
    {
        $totalDefects = $this->getTotalDefects();

        if ($totalDefects <= $this->accept_point) {
            return 'passed';
        }

        if ($totalDefects >= $this->reject_point) {
            return 'failed';
        }

        // In between - still passed but close to rejection
        return 'passed';
    }

    /**
     * Calculate and set inspection result
     */
    public function calculateResult(): void
    {
        $this->result = $this->determineResult();
    }

    /**
     * Initialize inspection with AQL level data
     *
     * @param int $aqlLevelId
     * @param int $lotSize
     */
    public function initializeFromAQLLevel(int $aqlLevelId, int $lotSize): void
    {
        $aqlLevel = AQLLevel::find($aqlLevelId);

        if (!$aqlLevel) {
            throw new \Exception("AQL Level not found");
        }

        $params = $aqlLevel->getSampleSizeParams($lotSize);

        if (!$params) {
            throw new \Exception("No sample size parameters found for lot size: {$lotSize}");
        }

        $this->aql_level_id = $aqlLevelId;
        $this->lot_size = $lotSize;
        $this->sample_size = $params['sample_size'];
        $this->accept_point = $params['accept_point'];
        $this->reject_point = $params['reject_point'];
    }

    /**
     * Generate unique inspection number
     */
    public static function generateInspectionNumber(): string
    {
        $prefix = 'QI';
        $date = now()->format('Ymd');
        $random = strtoupper(substr(md5(uniqid()), 0, 6));

        return "{$prefix}-{$date}-{$random}";
    }

    /**
     * Helper to create inspection with AQL parameters
     */
    public static function createWithAQL(array $data, int $aqlLevelId, int $lotSize): self
    {
        $inspection = new self($data);
        $inspection->initializeFromAQLLevel($aqlLevelId, $lotSize);

        if (!isset($data['inspection_number'])) {
            $inspection->inspection_number = self::generateInspectionNumber();
        }

        $inspection->save();

        return $inspection;
    }

    /**
     * Update defect counts from defect details
     */
    public function updateDefectCounts(): void
    {
        if (empty($this->defect_details)) {
            $this->critical_defects = 0;
            $this->major_defects = 0;
            $this->minor_defects = 0;
            return;
        }

        $critical = 0;
        $major = 0;
        $minor = 0;

        foreach ($this->defect_details as $defect) {
            $severity = $defect['severity'] ?? 'minor';
            $quantity = $defect['quantity'] ?? 1;

            match ($severity) {
                'critical' => $critical += $quantity,
                'major' => $major += $quantity,
                'minor' => $minor += $quantity,
                default => $minor += $quantity,
            };
        }

        $this->critical_defects = $critical;
        $this->major_defects = $major;
        $this->minor_defects = $minor;
    }

    /**
     * Has certificate been generated
     */
    public function hasCertificate(): bool
    {
        return !empty($this->certificate_number) && !empty($this->certificate_path);
    }
}
