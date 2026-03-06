<?php

return [
    'image_extraction' => [
        'enabled' => env('IMPORT_IMAGE_EXTRACTION_ENABLED', true),
        'storage_disk' => env('IMPORT_IMAGE_DISK', 'public'),
        'storage_path' => 'imports/images',
        'max_image_width' => 800,
        'image_quality' => 85,
        'cleanup_temp_files' => true,
        'image_headers' => [
            'picture' => [
                'PICTURE', 'IMAGE', 'PHOTO', 'PIC', 'STYLE PICTURE',
                'PRODUCT IMAGE', 'STYLE IMAGE', 'STYLE PHOTO',
            ],
            'trims_picture' => [
                'TRIMS PICTURE', 'TRIM PICTURE', 'TRIMS IMAGE', 'TRIM IMAGE',
                'TRIMS PHOTO', 'TRIM PHOTO', 'ACCESSORY IMAGE', 'TRIMS',
            ],
        ],
    ],
];
