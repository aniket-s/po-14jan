<?php

return [
    'image_extraction' => [
        'enabled' => env('IMPORT_IMAGE_EXTRACTION_ENABLED', true),
        'storage_disk' => env('IMPORT_IMAGE_DISK', 'public'),
        'storage_path' => 'imports/images',
        'max_image_width' => 800,
        'image_quality' => 85,
    ],
];
