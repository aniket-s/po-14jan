<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'month',
        'year',
        'etd',
        'eta',
        'cutoff_date',
        'vessel_name',
        'port_of_loading',
        'port_of_discharge',
        'notes',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'etd' => 'date',
        'eta' => 'date',
        'cutoff_date' => 'date',
        'is_active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (ShipOption $option) {
            // Auto-calculate cutoff_date = ETD - 7 days
            if ($option->etd) {
                $option->cutoff_date = Carbon::parse($option->etd)->subDays(7);
            }
            // Auto-set month/year from ETD
            if ($option->etd) {
                $option->month = Carbon::parse($option->etd)->month;
                $option->year = Carbon::parse($option->etd)->year;
            }
        });
    }

    /**
     * Get the user who created this option
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope to get active options
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to filter by month and year
     */
    public function scopeForMonth($query, int $month, int $year)
    {
        return $query->where('month', $month)->where('year', $year);
    }

    /**
     * Scope to get upcoming options from a date
     */
    public function scopeUpcomingFrom($query, $date)
    {
        return $query->where('etd', '>=', $date)->orderBy('etd');
    }

    /**
     * Check if goods with a given ex-factory date can connect to this ship
     * Rule: goods must leave factory at least 7 days before ship ETD
     */
    public function canConnect(Carbon $estimatedExFactoryDate): bool
    {
        return $estimatedExFactoryDate->lte($this->cutoff_date);
    }

    /**
     * Find connectable ship options for a given estimated ex-factory date
     * Returns options where cutoff_date >= estimated_ex_factory_date
     */
    public static function findConnectable(string $estimatedExFactoryDate)
    {
        $date = Carbon::parse($estimatedExFactoryDate);

        return static::active()
            ->where('cutoff_date', '>=', $date)
            ->orderBy('etd')
            ->get();
    }

    /**
     * Find the earliest connectable ship option
     */
    public static function findEarliestConnectable(string $estimatedExFactoryDate): ?self
    {
        $date = Carbon::parse($estimatedExFactoryDate);

        return static::active()
            ->where('cutoff_date', '>=', $date)
            ->orderBy('etd')
            ->first();
    }
}
