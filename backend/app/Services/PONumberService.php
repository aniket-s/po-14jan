<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use Carbon\Carbon;

class PONumberService
{
    /**
     * Generate next PO number in format: PO-{YEAR}-{INCREMENT}
     * Example: PO-2025-001, PO-2025-002, etc.
     *
     * @param int|null $year If null, uses current year
     * @return string
     */
    public function generatePONumber(?int $year = null): string
    {
        $year = $year ?? Carbon::now()->year;

        // Find the last PO number for this year
        $lastPO = PurchaseOrder::where('po_number', 'like', "PO-{$year}-%")
            ->orderBy('po_number', 'desc')
            ->first();

        if ($lastPO) {
            // Extract the increment part from the last PO number
            // Format: PO-2025-001 -> extract 001
            $parts = explode('-', $lastPO->po_number);
            if (count($parts) === 3) {
                $lastIncrement = (int) $parts[2];
                $nextIncrement = $lastIncrement + 1;
            } else {
                // Fallback if format doesn't match
                $nextIncrement = 1;
            }
        } else {
            // No PO for this year yet, start with 1
            $nextIncrement = 1;
        }

        // Format with leading zeros (001, 002, 003, etc.)
        return sprintf('PO-%d-%03d', $year, $nextIncrement);
    }

    /**
     * Check if PO number already exists
     *
     * @param string $poNumber
     * @return bool
     */
    public function poNumberExists(string $poNumber): bool
    {
        return PurchaseOrder::where('po_number', $poNumber)->exists();
    }

    /**
     * Validate PO number format
     *
     * @param string $poNumber
     * @return bool
     */
    public function isValidFormat(string $poNumber): bool
    {
        // Pattern: PO-YYYY-NNN where YYYY is year and NNN is 3-digit number
        return preg_match('/^PO-\d{4}-\d{3,}$/', $poNumber) === 1;
    }

    /**
     * Parse PO number into components
     *
     * @param string $poNumber
     * @return array|null ['year' => int, 'increment' => int] or null if invalid
     */
    public function parsePONumber(string $poNumber): ?array
    {
        if (!$this->isValidFormat($poNumber)) {
            return null;
        }

        $parts = explode('-', $poNumber);

        return [
            'year' => (int) $parts[1],
            'increment' => (int) $parts[2],
        ];
    }

    /**
     * Get next available PO number (checking for uniqueness)
     *
     * @param int|null $year
     * @return string
     */
    public function getNextAvailablePONumber(?int $year = null): string
    {
        $maxAttempts = 100; // Prevent infinite loop
        $attempts = 0;

        do {
            $poNumber = $this->generatePONumber($year);
            $attempts++;

            if (!$this->poNumberExists($poNumber)) {
                return $poNumber;
            }

            // If PO exists, increment and try again
            // This handles race conditions where multiple POs might be created simultaneously
            $parsed = $this->parsePONumber($poNumber);
            if ($parsed) {
                $year = $parsed['year'];
                // The next generatePONumber call will get the latest increment
            }
        } while ($attempts < $maxAttempts);

        // Fallback: append timestamp to ensure uniqueness
        return sprintf('PO-%d-%s', $year ?? Carbon::now()->year, time());
    }

    /**
     * Get statistics for PO numbers in a given year
     *
     * @param int|null $year
     * @return array
     */
    public function getYearStats(?int $year = null): array
    {
        $year = $year ?? Carbon::now()->year;

        $count = PurchaseOrder::where('po_number', 'like', "PO-{$year}-%")->count();
        $lastPO = PurchaseOrder::where('po_number', 'like', "PO-{$year}-%")
            ->orderBy('po_number', 'desc')
            ->first();

        $lastIncrement = 0;
        if ($lastPO) {
            $parsed = $this->parsePONumber($lastPO->po_number);
            $lastIncrement = $parsed ? $parsed['increment'] : 0;
        }

        return [
            'year' => $year,
            'total_pos' => $count,
            'last_increment' => $lastIncrement,
            'next_po_number' => $this->generatePONumber($year),
        ];
    }
}
