<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\MemoryDrawing;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use ZipArchive;
use DOMDocument;
use DOMXPath;

class ExcelImageExtractionService
{
    protected $tempPath;
    protected $currentZipArchive = null;
    protected $storageDisk;
    protected $storagePath;
    protected $mediaFolderCache = null;

    public function __construct()
    {
        $this->tempPath = sys_get_temp_dir() . '/excel_images_' . uniqid();
        $this->storageDisk = config('import.image_extraction.storage_disk', 'public');
        $this->storagePath = config('import.image_extraction.storage_path', 'imports/images');

        if (!file_exists($this->tempPath)) {
            mkdir($this->tempPath, 0777, true);
        }
    }

    /**
     * Extract images from an Excel file and map them to row numbers
     *
     * Returns: [ rowNumber => ['url' => ..., 'path' => ...], ... ]
     */
    public function extractImagesForRows(string $excelPath, int $headerRow = 1): array
    {
        $allImages = $this->extractInCellImagesUniversal($excelPath);
        $rowImages = [];

        foreach ($allImages['images'] as $image) {
            $row = $image['row_index'];
            // Skip images in header row or above
            if ($row <= $headerRow) continue;
            // Store one image per row (first found wins)
            if (!isset($rowImages[$row])) {
                $rowImages[$row] = [
                    'url' => $image['url'],
                    'path' => $image['path'],
                ];
            }
        }

        return $rowImages;
    }

    /**
     * Universal image extraction from Excel file
     */
    public function extractInCellImagesUniversal(string $excelPath): array
    {
        $result = [
            'images' => [],
            'format_detected' => 'unknown',
        ];

        $zip = new ZipArchive();
        if ($zip->open($excelPath) !== true) {
            throw new \Exception("Cannot open Excel file as ZIP");
        }

        $this->currentZipArchive = $zip;
        $this->mediaFolderCache = null; // Reset cache for new file

        try {
            // Method 1: Rich Data format (Office 365/Excel 2021+)
            $richDataImages = $this->extractRichDataImages($zip);
            if (!empty($richDataImages)) {
                $result['format_detected'] = 'Rich Data Format';
                $result['images'] = array_merge($result['images'], $richDataImages);
            }

            // Method 2: Drawing Anchors format
            $drawingImages = $this->extractDrawingAnchorImages($zip);
            if (!empty($drawingImages)) {
                if ($result['format_detected'] === 'unknown') {
                    $result['format_detected'] = 'Drawing Anchors Format';
                }
                $result['images'] = array_merge($result['images'], $drawingImages);
            }

            // Method 3: Legacy VML format
            $vmlImages = $this->extractVmlImages($zip);
            if (!empty($vmlImages)) {
                if ($result['format_detected'] === 'unknown') {
                    $result['format_detected'] = 'Legacy VML Format';
                }
                $result['images'] = array_merge($result['images'], $vmlImages);
            }

            // Remove duplicates
            $result['images'] = $this->removeDuplicateImagesByContent($result['images']);

        } finally {
            $zip->close();
            $this->currentZipArchive = null;
        }

        return $result;
    }

    /**
     * Method 1: Extract Rich Data format images (Office 365/Excel 2021+)
     */
    protected function extractRichDataImages(ZipArchive $zip): array
    {
        $images = [];

        if ($zip->locateName('xl/richData/richValueRel.xml') === false) {
            return $images;
        }

        // Extract media images
        $mediaImages = $this->extractMediaFolder($zip, 'richdata');

        // Parse relationships
        $relsContent = $zip->getFromName('xl/richData/_rels/richValueRel.xml.rels');
        if ($relsContent === false) return $images;

        $relationships = [];
        $dom = new DOMDocument();
        @$dom->loadXML($relsContent);
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('r', 'http://schemas.openxmlformats.org/package/2006/relationships');

        $rels = $xpath->query('//r:Relationship');
        foreach ($rels as $rel) {
            $id = $rel->getAttribute('Id');
            $target = basename($rel->getAttribute('Target'));
            $relationships[$id] = $target;
        }

        // Parse worksheet for cells with vm attribute
        for ($sheetNum = 1; $sheetNum <= 10; $sheetNum++) {
            $sheetContent = $zip->getFromName("xl/worksheets/sheet{$sheetNum}.xml");
            if ($sheetContent === false) continue;

            $sheetDom = new DOMDocument();
            @$sheetDom->loadXML($sheetContent);
            $sheetXpath = new DOMXPath($sheetDom);
            $sheetXpath->registerNamespace('ws', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');

            $cells = $sheetXpath->query('//ws:c[@vm]');
            foreach ($cells as $cell) {
                $cellRef = $cell->getAttribute('r');
                $vmIndex = intval($cell->getAttribute('vm'));

                $relId = 'rId' . $vmIndex;
                if (isset($relationships[$relId]) && isset($mediaImages[$relationships[$relId]])) {
                    $imageInfo = $mediaImages[$relationships[$relId]];

                    $cellReference = Coordinate::coordinateFromString($cellRef);
                    $columnIndex = Coordinate::columnIndexFromString($cellReference[0]) - 1;
                    $rowIndex = intval($cellReference[1]);

                    $images[] = [
                        'cell' => $cellRef,
                        'column_index' => $columnIndex,
                        'row_index' => $rowIndex,
                        'url' => $imageInfo['url'],
                        'path' => $imageInfo['path'],
                        'format' => 'Rich Data',
                        'in_cell' => true,
                    ];
                }
            }
        }

        return $images;
    }

    /**
     * Method 2: Extract Drawing Anchor format images
     */
    protected function extractDrawingAnchorImages(ZipArchive $zip): array
    {
        $images = [];

        $mediaImages = $this->extractMediaFolder($zip, 'drawing');

        for ($i = 1; $i <= 10; $i++) {
            $drawingPath = "xl/drawings/drawing{$i}.xml";
            $drawingContent = $zip->getFromName($drawingPath);
            if ($drawingContent === false) continue;

            $drawingRelsPath = "xl/drawings/_rels/drawing{$i}.xml.rels";
            $drawingRels = $this->parseRelationships($zip->getFromName($drawingRelsPath));

            $dom = new DOMDocument();
            @$dom->loadXML($drawingContent);
            $xpath = new DOMXPath($dom);
            $xpath->registerNamespace('xdr', 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing');
            $xpath->registerNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main');

            // oneCellAnchor (in-cell images)
            $this->processAnchors($xpath, '//xdr:oneCellAnchor', $drawingRels, $mediaImages, $images);

            // twoCellAnchor (floating images positioned over cells)
            $this->processAnchors($xpath, '//xdr:twoCellAnchor', $drawingRels, $mediaImages, $images);
        }

        return $images;
    }

    /**
     * Process anchor elements to extract images
     */
    protected function processAnchors(DOMXPath $xpath, string $query, array $drawingRels, array $mediaImages, array &$images): void
    {
        $anchors = $xpath->query($query);
        foreach ($anchors as $anchor) {
            $from = $xpath->query('.//xdr:from', $anchor)->item(0);
            if (!$from) continue;

            $colNode = $xpath->query('.//xdr:col', $from)->item(0);
            $rowNode = $xpath->query('.//xdr:row', $from)->item(0);
            if (!$colNode || !$rowNode) continue;

            $col = intval($colNode->nodeValue);
            $row = intval($rowNode->nodeValue) + 1; // 0-indexed to 1-indexed
            $cellRef = Coordinate::stringFromColumnIndex($col + 1) . $row;

            $blip = $xpath->query('.//a:blip', $anchor)->item(0);
            if (!$blip) continue;

            $embedId = $blip->getAttribute('r:embed');
            if (isset($drawingRels[$embedId])) {
                $imageName = basename($drawingRels[$embedId]);
                if (isset($mediaImages[$imageName])) {
                    $images[] = [
                        'cell' => $cellRef,
                        'column_index' => $col,
                        'row_index' => $row,
                        'url' => $mediaImages[$imageName]['url'],
                        'path' => $mediaImages[$imageName]['path'],
                        'format' => 'Drawing Anchor',
                        'in_cell' => true,
                    ];
                }
            }
        }
    }

    /**
     * Method 3: Extract VML format images (legacy)
     */
    protected function extractVmlImages(ZipArchive $zip): array
    {
        $images = [];

        $mediaImages = $this->extractMediaFolder($zip, 'vml');

        for ($i = 1; $i <= 10; $i++) {
            $vmlPath = "xl/drawings/vmlDrawing{$i}.vml";
            $vmlContent = $zip->getFromName($vmlPath);
            if ($vmlContent === false) continue;

            if (preg_match_all('/<v:shape[^>]*>.*?<x:ClientData[^>]*>.*?<x:Anchor>([^<]+)<\/x:Anchor>/s', $vmlContent, $matches)) {
                foreach ($matches[1] as $idx => $anchor) {
                    $parts = array_map('trim', explode(',', $anchor));
                    if (count($parts) >= 4) {
                        $col = intval($parts[0]);
                        $row = intval($parts[2]) + 1;
                        $cellRef = Coordinate::stringFromColumnIndex($col + 1) . $row;

                        if ($idx < count($mediaImages)) {
                            $imageInfo = array_values($mediaImages)[$idx];
                            $images[] = [
                                'cell' => $cellRef,
                                'column_index' => $col,
                                'row_index' => $row,
                                'url' => $imageInfo['url'],
                                'path' => $imageInfo['path'],
                                'format' => 'VML',
                                'in_cell' => true,
                            ];
                        }
                    }
                }
            }
        }

        return $images;
    }

    /**
     * Extract all images from the xl/media/ folder inside the Excel ZIP (cached)
     */
    protected function extractMediaFolder(ZipArchive $zip, string $prefix): array
    {
        // Return cached result if already extracted for this ZIP
        if ($this->mediaFolderCache !== null) {
            return $this->mediaFolderCache;
        }

        $images = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            if (!str_starts_with($filename, 'xl/media/')) continue;

            $imageData = $zip->getFromIndex($i);
            if ($imageData === false) continue;

            $originalName = basename($filename);
            $extension = pathinfo($originalName, PATHINFO_EXTENSION) ?: 'jpg';

            $storedImage = $this->storeImageData($imageData, $extension, 'img_' . pathinfo($originalName, PATHINFO_FILENAME));

            if ($storedImage) {
                $images[$originalName] = [
                    'path' => $storedImage['path'],
                    'url' => $storedImage['url'],
                    'size' => strlen($imageData),
                ];
            }
        }

        $this->mediaFolderCache = $images;
        return $images;
    }

    /**
     * Parse XML relationship files
     */
    protected function parseRelationships($xmlContent): array
    {
        $relationships = [];
        if (!$xmlContent) return $relationships;

        $dom = new DOMDocument();
        @$dom->loadXML($xmlContent);
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('r', 'http://schemas.openxmlformats.org/package/2006/relationships');

        $rels = $xpath->query('//r:Relationship');
        foreach ($rels as $rel) {
            $id = $rel->getAttribute('Id');
            $target = $rel->getAttribute('Target');
            $relationships[$id] = $target;
        }

        return $relationships;
    }

    /**
     * Store image data to disk and return path + URL
     */
    protected function storeImageData(string $imageContent, string $extension, string $prefix): ?array
    {
        try {
            // Optionally resize large images using GD
            $processed = $this->processImageWithGd($imageContent, $extension);
            if ($processed) {
                $imageContent = $processed;
                $extension = 'jpg'; // GD output is JPEG
            }

            $filename = sprintf(
                '%s/%s/%s_%s.%s',
                $this->storagePath,
                date('Y/m'),
                preg_replace('/[^a-zA-Z0-9_-]/', '_', $prefix),
                substr(md5(uniqid()), 0, 8),
                $extension
            );

            Storage::disk($this->storageDisk)->put($filename, $imageContent);

            $url = Storage::disk($this->storageDisk)->url($filename);

            return [
                'path' => $filename,
                'url' => $url,
            ];
        } catch (\Exception $e) {
            Log::warning('Failed to store extracted image: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Process image with GD - resize if too large, convert to JPEG
     */
    protected function processImageWithGd(string $imageContent, string $extension): ?string
    {
        if (!function_exists('imagecreatefromstring')) {
            return null; // GD not available, store raw
        }

        try {
            $image = @imagecreatefromstring($imageContent);
            if (!$image) return null;

            $width = imagesx($image);
            $height = imagesy($image);
            $maxWidth = 800;

            // Only process if image is larger than max
            if ($width <= $maxWidth) {
                imagedestroy($image);
                return null; // Store original
            }

            // Resize
            $newWidth = $maxWidth;
            $newHeight = (int) ($height * ($maxWidth / $width));
            $resized = imagecreatetruecolor($newWidth, $newHeight);

            // Preserve transparency for PNG
            imagealphablending($resized, false);
            imagesavealpha($resized, true);

            imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

            ob_start();
            imagejpeg($resized, null, 85);
            $output = ob_get_clean();

            imagedestroy($image);
            imagedestroy($resized);

            return $output;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Remove duplicate images based on cell reference
     */
    protected function removeDuplicateImagesByContent(array $images): array
    {
        $unique = [];
        $seen = [];

        foreach ($images as $image) {
            $key = $image['cell'] . '_' . md5($image['path'] ?? '');
            if (!isset($seen[$key])) {
                $unique[] = $image;
                $seen[$key] = true;
            }
        }

        return $unique;
    }

    /**
     * Clean up temporary directory
     */
    public function cleanup(): void
    {
        if (file_exists($this->tempPath)) {
            $files = glob($this->tempPath . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            @rmdir($this->tempPath);
        }
    }

    public function __destruct()
    {
        $this->cleanup();
    }
}
