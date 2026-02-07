<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\ProfileController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\RoleController;
use App\Http\Controllers\Api\Admin\PermissionController;
use App\Http\Controllers\Api\Admin\SettingsController;
use App\Http\Controllers\Api\Admin\ActivityLogController;
use App\Http\Controllers\Api\Admin\StatusController;
use App\Http\Controllers\Api\Admin\EmailTemplateController;
use App\Http\Controllers\Api\Admin\SampleTypeController;
use App\Http\Controllers\Api\Admin\ProductionStageController;
use App\Http\Controllers\Api\Admin\AQLLevelController;
use App\Http\Controllers\Api\Admin\DefectCategoryController;
use App\Http\Controllers\Api\Admin\InspectionTypeController;
use App\Http\Controllers\Api\Admin\NotificationConfigController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\PurchaseOrderStyleController;
use App\Http\Controllers\Api\StyleController;
use App\Http\Controllers\Api\ExcelImportController;
use App\Http\Controllers\Api\FileUploadController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\FactoryAssignmentController;
use App\Http\Controllers\Api\SampleController;
use App\Http\Controllers\Api\ProductionTrackingController;
use App\Http\Controllers\Api\QualityInspectionController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\NotificationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Public shipment tracking (no authentication required)
Route::get('/track/{token}', [ShipmentController::class, 'publicTrack']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Profile routes
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/change-password', [ProfileController::class, 'changePassword']);

    // Notification routes
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread', [NotificationController::class, 'unread']);
        Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
        Route::delete('/read/all', [NotificationController::class, 'deleteAllRead']);
    });

    // Admin routes
    Route::prefix('admin')->group(function () {
        // User Management
        Route::middleware('permission:admin.users.view')->group(function () {
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::get('/users/{id}', [AdminUserController::class, 'show']);
            Route::get('/users/{id}/activity-logs', [AdminUserController::class, 'activityLogs']);
        });

        Route::middleware('permission:admin.users.create')->group(function () {
            Route::post('/users', [AdminUserController::class, 'store']);
        });

        Route::middleware('permission:admin.users.edit')->group(function () {
            Route::put('/users/{id}', [AdminUserController::class, 'update']);
            Route::post('/users/bulk-action', [AdminUserController::class, 'bulkAction']);
            Route::patch('/users/{id}/verify-email', [AdminUserController::class, 'verifyEmail']);
        });

        Route::middleware('permission:admin.users.delete')->group(function () {
            Route::delete('/users/{id}', [AdminUserController::class, 'destroy']);
        });

        // Role Management
        Route::middleware('permission:admin.roles.view')->group(function () {
            Route::get('/roles', [RoleController::class, 'index']);
            Route::get('/roles/{id}', [RoleController::class, 'show']);
            Route::get('/roles/{id}/users', [RoleController::class, 'users']);
        });

        Route::middleware('permission:admin.roles.create')->group(function () {
            Route::post('/roles', [RoleController::class, 'store']);
        });

        Route::middleware('permission:admin.roles.edit')->group(function () {
            Route::put('/roles/{id}', [RoleController::class, 'update']);
            Route::post('/roles/{id}/permissions', [RoleController::class, 'syncPermissions']);
        });

        Route::middleware('permission:admin.roles.delete')->group(function () {
            Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
        });

        // Permission Management
        Route::middleware('permission:admin.permissions.view')->group(function () {
            Route::get('/permissions', [PermissionController::class, 'index']);
            Route::get('/permissions/{id}', [PermissionController::class, 'show']);
            Route::get('/permissions/{id}/roles', [PermissionController::class, 'roles']);
            Route::get('/permissions/categories', [PermissionController::class, 'categories']);
            Route::get('/roles/permissions/all', [RoleController::class, 'permissions']);
        });

        Route::middleware('permission:admin.permissions.create')->group(function () {
            Route::post('/permissions', [PermissionController::class, 'store']);
        });

        Route::middleware('permission:admin.permissions.edit')->group(function () {
            Route::put('/permissions/{id}', [PermissionController::class, 'update']);
        });

        Route::middleware('permission:admin.permissions.delete')->group(function () {
            Route::delete('/permissions/{id}', [PermissionController::class, 'destroy']);
        });

        // Settings Management
        Route::middleware('permission:admin.settings.view')->group(function () {
            Route::get('/settings', [SettingsController::class, 'index']);
            Route::get('/settings/{key}', [SettingsController::class, 'show']);
            Route::get('/settings/group/{group}', [SettingsController::class, 'group']);
        });

        Route::middleware('permission:admin.settings.edit')->group(function () {
            Route::put('/settings/{key}', [SettingsController::class, 'update']);
            Route::post('/settings/bulk-update', [SettingsController::class, 'bulkUpdate']);
            Route::post('/settings/{key}/reset', [SettingsController::class, 'reset']);
        });

        // Activity Logs
        Route::middleware('permission:admin.activity_logs.view')->group(function () {
            Route::get('/activity-logs', [ActivityLogController::class, 'index']);
            Route::get('/activity-logs/{id}', [ActivityLogController::class, 'show']);
            Route::get('/activity-logs/statistics/overview', [ActivityLogController::class, 'statistics']);
            Route::get('/activity-logs/filters/actions', [ActivityLogController::class, 'actions']);
            Route::get('/activity-logs/filters/resource-types', [ActivityLogController::class, 'resourceTypes']);
            Route::get('/activity-logs/export', [ActivityLogController::class, 'export']);
            Route::get('/activity-logs/users/{userId}/timeline', [ActivityLogController::class, 'userTimeline']);
            Route::get('/activity-logs/resources/{resourceType}/{resourceId}', [ActivityLogController::class, 'resourceHistory']);
            Route::get('/activity-logs/analytics/heatmap', [ActivityLogController::class, 'heatmap']);
            Route::get('/activity-logs/security/audit', [ActivityLogController::class, 'securityAudit']);
        });

        // Status Management
        Route::middleware('permission:admin.statuses.view')->group(function () {
            Route::get('/statuses', [StatusController::class, 'index']);
            Route::get('/statuses/{id}', [StatusController::class, 'show']);
            Route::get('/statuses/type/{type}', [StatusController::class, 'byType']);
            Route::get('/statuses/types/all', [StatusController::class, 'types']);
            Route::post('/statuses/validate-transition', [StatusController::class, 'validateTransition']);
        });

        Route::middleware('permission:admin.statuses.create')->group(function () {
            Route::post('/statuses', [StatusController::class, 'store']);
        });

        Route::middleware('permission:admin.statuses.edit')->group(function () {
            Route::put('/statuses/{id}', [StatusController::class, 'update']);
            Route::post('/statuses/reorder', [StatusController::class, 'reorder']);
            Route::post('/statuses/{id}/toggle-active', [StatusController::class, 'toggleActive']);
        });

        Route::middleware('permission:admin.statuses.delete')->group(function () {
            Route::delete('/statuses/{id}', [StatusController::class, 'destroy']);
        });

        // Email Template Management
        Route::middleware('permission:admin.email_templates.view')->group(function () {
            Route::get('/email-templates', [EmailTemplateController::class, 'index']);
            Route::get('/email-templates/{id}', [EmailTemplateController::class, 'show']);
            Route::get('/email-templates/category/{category}', [EmailTemplateController::class, 'byCategory']);
            Route::get('/email-templates/categories/all', [EmailTemplateController::class, 'categories']);
            Route::post('/email-templates/{id}/preview', [EmailTemplateController::class, 'preview']);
        });

        Route::middleware('permission:admin.email_templates.create')->group(function () {
            Route::post('/email-templates', [EmailTemplateController::class, 'store']);
            Route::post('/email-templates/{id}/duplicate', [EmailTemplateController::class, 'duplicate']);
        });

        Route::middleware('permission:admin.email_templates.edit')->group(function () {
            Route::put('/email-templates/{id}', [EmailTemplateController::class, 'update']);
            Route::post('/email-templates/{id}/toggle-active', [EmailTemplateController::class, 'toggleActive']);
            Route::post('/email-templates/{id}/test-send', [EmailTemplateController::class, 'testSend']);
        });

        Route::middleware('permission:admin.email_templates.delete')->group(function () {
            Route::delete('/email-templates/{id}', [EmailTemplateController::class, 'destroy']);
        });

        // Sample Type Configuration
        Route::middleware('permission:admin.configuration.view')->group(function () {
            Route::get('/sample-types', [SampleTypeController::class, 'index']);
            Route::get('/sample-types/{id}', [SampleTypeController::class, 'show']);
        });

        Route::middleware('permission:admin.configuration.create')->group(function () {
            Route::post('/sample-types', [SampleTypeController::class, 'store']);
        });

        Route::middleware('permission:admin.configuration.edit')->group(function () {
            Route::put('/sample-types/{id}', [SampleTypeController::class, 'update']);
            Route::post('/sample-types/reorder', [SampleTypeController::class, 'reorder']);
        });

        Route::middleware('permission:admin.configuration.delete')->group(function () {
            Route::delete('/sample-types/{id}', [SampleTypeController::class, 'destroy']);
        });

        // Production Stage Configuration
        Route::middleware('permission:admin.configuration.view')->group(function () {
            Route::get('/production-stages', [ProductionStageController::class, 'index']);
            Route::get('/production-stages/{id}', [ProductionStageController::class, 'show']);
            Route::get('/production-stages/validate/weights', [ProductionStageController::class, 'validateWeights']);
        });

        Route::middleware('permission:admin.configuration.create')->group(function () {
            Route::post('/production-stages', [ProductionStageController::class, 'store']);
        });

        Route::middleware('permission:admin.configuration.edit')->group(function () {
            Route::put('/production-stages/{id}', [ProductionStageController::class, 'update']);
            Route::post('/production-stages/reorder', [ProductionStageController::class, 'reorder']);
        });

        Route::middleware('permission:admin.configuration.delete')->group(function () {
            Route::delete('/production-stages/{id}', [ProductionStageController::class, 'destroy']);
        });

        // AQL Level Configuration
        Route::middleware('permission:admin.configuration.view')->group(function () {
            Route::get('/aql-levels', [AQLLevelController::class, 'index']);
            Route::get('/aql-levels/{id}', [AQLLevelController::class, 'show']);
        });

        Route::middleware('permission:admin.configuration.create')->group(function () {
            Route::post('/aql-levels', [AQLLevelController::class, 'store']);
        });

        Route::middleware('permission:admin.configuration.edit')->group(function () {
            Route::put('/aql-levels/{id}', [AQLLevelController::class, 'update']);
        });

        Route::middleware('permission:admin.configuration.delete')->group(function () {
            Route::delete('/aql-levels/{id}', [AQLLevelController::class, 'destroy']);
        });

        // Defect Category Configuration
        Route::middleware('permission:admin.configuration.view')->group(function () {
            Route::get('/defect-categories', [DefectCategoryController::class, 'index']);
            Route::get('/defect-categories/{id}', [DefectCategoryController::class, 'show']);
        });

        Route::middleware('permission:admin.configuration.create')->group(function () {
            Route::post('/defect-categories', [DefectCategoryController::class, 'store']);
        });

        Route::middleware('permission:admin.configuration.edit')->group(function () {
            Route::put('/defect-categories/{id}', [DefectCategoryController::class, 'update']);
            Route::post('/defect-categories/reorder', [DefectCategoryController::class, 'reorder']);
        });

        Route::middleware('permission:admin.configuration.delete')->group(function () {
            Route::delete('/defect-categories/{id}', [DefectCategoryController::class, 'destroy']);
        });

        // Inspection Type Configuration
        Route::middleware('permission:admin.configuration.view')->group(function () {
            Route::get('/inspection-types', [InspectionTypeController::class, 'index']);
            Route::get('/inspection-types/{id}', [InspectionTypeController::class, 'show']);
        });

        Route::middleware('permission:admin.configuration.create')->group(function () {
            Route::post('/inspection-types', [InspectionTypeController::class, 'store']);
        });

        Route::middleware('permission:admin.configuration.edit')->group(function () {
            Route::put('/inspection-types/{id}', [InspectionTypeController::class, 'update']);
            Route::post('/inspection-types/reorder', [InspectionTypeController::class, 'reorder']);
        });

        Route::middleware('permission:admin.configuration.delete')->group(function () {
            Route::delete('/inspection-types/{id}', [InspectionTypeController::class, 'destroy']);
        });

        // Notification Config Management
        Route::middleware('permission:admin.notifications.view')->group(function () {
            Route::get('/notification-configs', [NotificationConfigController::class, 'index']);
            Route::get('/notification-configs/{id}', [NotificationConfigController::class, 'show']);
            Route::get('/notification-configs/templates/available', [NotificationConfigController::class, 'getAvailableTemplates']);
        });

        Route::middleware('permission:admin.notifications.create')->group(function () {
            Route::post('/notification-configs', [NotificationConfigController::class, 'store']);
        });

        Route::middleware('permission:admin.notifications.edit')->group(function () {
            Route::put('/notification-configs/{id}', [NotificationConfigController::class, 'update']);
        });

        Route::middleware('permission:admin.notifications.delete')->group(function () {
            Route::delete('/notification-configs/{id}', [NotificationConfigController::class, 'destroy']);
        });
    });

    // Master Data Management
    Route::prefix('master-data')->group(function () {
        // Brands
        Route::apiResource('brands', \App\Http\Controllers\Api\BrandController::class);

        // Seasons
        Route::apiResource('seasons', \App\Http\Controllers\Api\SeasonController::class);

        // Divisions
        Route::apiResource('divisions', \App\Http\Controllers\Api\DivisionController::class);

        // Customers
        Route::apiResource('customers', \App\Http\Controllers\Api\CustomerController::class);

        // Retailers (NEW - replaces customers in POs)
        Route::apiResource('retailers', \App\Http\Controllers\Api\RetailerController::class);

        // Countries (NEW - for shipping calculations)
        Route::apiResource('countries', \App\Http\Controllers\Api\CountryController::class);

        // Agents
        Route::apiResource('agents', \App\Http\Controllers\Api\AgentController::class);

        // Vendors
        Route::apiResource('vendors', \App\Http\Controllers\Api\VendorController::class);

        // Warehouses
        Route::apiResource('warehouses', \App\Http\Controllers\Api\WarehouseController::class);

        // Prepack Codes
        Route::apiResource('prepack-codes', \App\Http\Controllers\Api\PrepackCodeController::class);

        // Trims (NEW - brand-specific trims)
        Route::apiResource('trims', \App\Http\Controllers\Api\TrimController::class);
        Route::post('trims/upload-image', [\App\Http\Controllers\Api\TrimController::class, 'uploadImage']);
        Route::post('trims/upload-file', [\App\Http\Controllers\Api\TrimController::class, 'uploadFile']);
        Route::get('trims/types/all', [\App\Http\Controllers\Api\TrimController::class, 'types']);

        // Genders (NEW - for size management)
        Route::apiResource('genders', \App\Http\Controllers\Api\GenderController::class);
        Route::get('genders/{id}/sizes', [\App\Http\Controllers\Api\GenderController::class, 'getSizes']);

        // Sizes (NEW - gender-based sizes)
        Route::apiResource('sizes', \App\Http\Controllers\Api\SizeController::class);

        // Colors (NEW - for style color management with fabric type filtering)
        Route::apiResource('colors', \App\Http\Controllers\Api\ColorController::class);

        // Buyers (NEW - for style buyer categorization)
        Route::apiResource('buyers', \App\Http\Controllers\Api\BuyerController::class);

        // Categories (NEW - for style product categorization)
        Route::apiResource('categories', \App\Http\Controllers\Api\CategoryController::class);

        // Fabric Types (NEW - for dynamic fabric type selection in styles)
        Route::apiResource('fabric-types', \App\Http\Controllers\Api\FabricTypeController::class);

        // Fabric Qualities (NEW - for dynamic fabric quality selection in styles)
        Route::apiResource('fabric-qualities', \App\Http\Controllers\Api\FabricQualityController::class);

        // Currencies (NEW - for dynamic currency selection in POs)
        Route::apiResource('currencies', \App\Http\Controllers\Api\CurrencyController::class);

        // Payment Terms (NEW - for dynamic payment term selection in POs)
        Route::apiResource('payment-terms', \App\Http\Controllers\Api\PaymentTermController::class);

        // Trim Types (NEW - for dynamic trim type selection)
        Route::apiResource('trim-types', \App\Http\Controllers\Api\TrimTypeController::class);
        Route::post('trim-types/reorder', [\App\Http\Controllers\Api\TrimTypeController::class, 'reorder']);
    });

    // Purchase Order Management
    Route::prefix('purchase-orders')->group(function () {
        // PO Number Generation (helper - before create)
        Route::get('/generate-po-number', [PurchaseOrderController::class, 'generatePONumber']);

        // Date & Schedule Calculators (helper endpoints)
        Route::post('/calculate-dates', [PurchaseOrderController::class, 'calculateDates']);
        Route::post('/sample-schedule', [PurchaseOrderController::class, 'getSampleSchedule']);

        // View POs
        Route::middleware('permission:po.view')->group(function () {
            Route::get('/', [PurchaseOrderController::class, 'index']);
            Route::get('/{id}', [PurchaseOrderController::class, 'show']);
            Route::get('/statistics/overview', [PurchaseOrderController::class, 'statistics']);
            Route::get('/{id}/sample-schedule', [PurchaseOrderController::class, 'getSampleSchedule']);
            Route::get('/{id}/tna-chart/download', [PurchaseOrderController::class, 'downloadTNAChart']);
        });

        // Create POs
        Route::middleware('permission:po.create')->group(function () {
            Route::post('/', [PurchaseOrderController::class, 'store']);
            Route::post('/{id}/tna-chart/generate', [PurchaseOrderController::class, 'generateTNAChart']);
        });

        // Edit POs
        Route::middleware('permission:po.edit')->group(function () {
            Route::put('/{id}', [PurchaseOrderController::class, 'update']);
            Route::post('/{id}/status', [PurchaseOrderController::class, 'updateStatus']);
            Route::post('/{id}/recalculate-totals', [PurchaseOrderController::class, 'recalculateTotals']);
        });

        // Delete POs
        Route::middleware('permission:po.delete')->group(function () {
            Route::delete('/{id}', [PurchaseOrderController::class, 'destroy']);
        });

        // ========================================
        // PO-STYLE ASSOCIATIONS (UPDATED)
        // ========================================
        Route::prefix('{poId}/styles')->group(function () {
            // View styles associated with this PO
            Route::middleware('permission:style.view')->group(function () {
                Route::get('/', [PurchaseOrderStyleController::class, 'index']);
            });

            // Add existing styles to this PO (NEW - replaces create)
            Route::middleware('permission:style.create')->group(function () {
                Route::post('/attach', [PurchaseOrderStyleController::class, 'attachStyles']);
                Route::post('/attach-bulk', [PurchaseOrderStyleController::class, 'attachStylesBulk']);
            });

            // Update PO-specific style data (quantity, price, dates for THIS PO only)
            Route::middleware('permission:style.edit')->group(function () {
                Route::put('/{styleId}', [PurchaseOrderStyleController::class, 'updatePivot']);
            });

            // Remove style from this PO (NEW - replaces delete)
            Route::middleware('permission:style.delete')->group(function () {
                Route::delete('/{styleId}/detach', [PurchaseOrderStyleController::class, 'detachStyle']);
            });

            // Assign factory to style within this PO
            Route::middleware('permission:po.assign_factory')->group(function () {
                Route::post('/{styleId}/assign-factory', [PurchaseOrderStyleController::class, 'assignFactory']);
            });

            // Legacy endpoints for backward compatibility
            // These will still work but use the old flow
            Route::middleware('permission:style.create')->group(function () {
                Route::post('/', [StyleController::class, 'store']); // DEPRECATED
                Route::post('/bulk', [StyleController::class, 'bulkStore']); // DEPRECATED
            });
        });

        // Factory Assignment
        Route::middleware('permission:po.assign_factory')->group(function () {
            Route::post('/{poId}/assign-factory', [StyleController::class, 'assignFactory']);
        });

        // Excel Import
        Route::prefix('{poId}/import')->group(function () {
            Route::middleware('permission:style.create')->group(function () {
                Route::post('/analyze', [ExcelImportController::class, 'analyze']);
                Route::post('/execute', [ExcelImportController::class, 'import']);
                Route::post('/validate-mapping', [ExcelImportController::class, 'validateMapping']);
            });
        });
    });

    // Excel Import Template Download (public within auth)
    Route::get('/excel-templates/styles', [ExcelImportController::class, 'downloadTemplate']);

    // Import Mapping Management
    Route::prefix('import-mappings')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\ImportMappingController::class, 'index']);
        Route::get('/default', [\App\Http\Controllers\Api\ImportMappingController::class, 'getDefault']);
        Route::get('/{id}', [\App\Http\Controllers\Api\ImportMappingController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\Api\ImportMappingController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\Api\ImportMappingController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Api\ImportMappingController::class, 'destroy']);
    });

    // ========================================
    // STANDALONE STYLE MANAGEMENT (NEW)
    // ========================================
    Route::prefix('styles')->group(function () {
        // View all styles
        Route::middleware('permission:style.view')->group(function () {
            Route::get('/', [StyleController::class, 'indexAll']);
            Route::get('/{id}', [StyleController::class, 'showStandalone']);
        });

        // Create standalone styles
        Route::middleware('permission:style.create')->group(function () {
            Route::post('/', [StyleController::class, 'createStandalone']);
            Route::post('/bulk', [StyleController::class, 'bulkCreateStandalone']);
        });

        // Update standalone styles
        Route::middleware('permission:style.edit')->group(function () {
            Route::put('/{id}', [StyleController::class, 'updateStandalone']);
        });

        // Delete standalone styles
        Route::middleware('permission:style.delete')->group(function () {
            Route::delete('/{id}', [StyleController::class, 'destroyStandalone']);
        });

        // Excel import for standalone styles
        Route::middleware('permission:style.create')->group(function () {
            Route::post('/import/analyze', [ExcelImportController::class, 'analyzeStandalone']);
            Route::post('/import/execute', [ExcelImportController::class, 'importStandalone']);
        });

        // Download Excel template
        Route::get('/template/download', [ExcelImportController::class, 'downloadTemplate']);

        // Get styles available for PO selection
        Route::get('/available-for-po/{poId}', [StyleController::class, 'getAvailableForPO']);

        // Trim Management for Styles
        Route::prefix('{id}/trims')->group(function () {
            // Get trims for a style
            Route::middleware('permission:style.view')->group(function () {
                Route::get('/', [StyleController::class, 'getTrims']);
            });

            // Attach trims to a style
            Route::middleware('permission:style.edit')->group(function () {
                Route::post('/attach', [StyleController::class, 'attachTrims']);
            });

            // Detach trims from a style
            Route::middleware('permission:style.edit')->group(function () {
                Route::post('/detach', [StyleController::class, 'detachTrims']);
            });

            // Sync trims for a style (replace all)
            Route::middleware('permission:style.edit')->group(function () {
                Route::post('/sync', [StyleController::class, 'syncTrims']);
            });
        });
    });

    // Aggregate Endpoints - Cross-PO Data Access
    Route::get('/samples', [SampleController::class, 'indexAll']);
    Route::post('/samples', [SampleController::class, 'storeAll']);
    Route::post('/samples/bulk-approve-excel', [SampleController::class, 'bulkApproveExcel']);

    // Flat aggregate sample approval routes (used by frontend samples list page)
    Route::post('/samples/{id}/agency-approve', [SampleController::class, 'agencyApprove']);
    Route::post('/samples/{id}/agency-reject', [SampleController::class, 'agencyReject']);
    Route::post('/samples/{id}/importer-approve', [SampleController::class, 'importerApprove']);
    Route::post('/samples/{id}/importer-reject', [SampleController::class, 'importerReject']);
    Route::get('/production-tracking', [ProductionTrackingController::class, 'indexAll']);
    Route::get('/quality-inspections', [QualityInspectionController::class, 'indexAll']);
    Route::get('/shipments', [ShipmentController::class, 'indexAll']);
    Route::get('/invitations', [InvitationController::class, 'indexAll']);
    Route::get('/factory-assignments', [FactoryAssignmentController::class, 'indexAll']);
    Route::get('/factories', [\App\Http\Controllers\Api\FactoryController::class, 'index']);

    // Ship Options (Monthly Sailing Schedules)
    Route::prefix('ship-options')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\ShipOptionController::class, 'index']);
        Route::get('/suggest', [\App\Http\Controllers\Api\ShipOptionController::class, 'suggest']);
        Route::get('/{id}', [\App\Http\Controllers\Api\ShipOptionController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\Api\ShipOptionController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\Api\ShipOptionController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Api\ShipOptionController::class, 'destroy']);
    });

    // Shipping Approval Workflow
    Route::prefix('purchase-orders/{poId}')->group(function () {
        Route::get('/shipping-approvals', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'index']);
        Route::post('/styles/{styleId}/production-status', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'updateProductionStatus']);
        Route::post('/styles/{styleId}/request-shipping-approval', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'requestApproval']);
        Route::post('/styles/{styleId}/agency-approve-shipping', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'agencyApprove']);
        Route::post('/styles/{styleId}/importer-approve-shipping', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'importerApprove']);
        Route::post('/styles/{styleId}/reject-shipping', [\App\Http\Controllers\Api\ShippingApprovalController::class, 'reject']);
    });

    // File Upload (authenticated users)
    Route::post('/upload/file', [FileUploadController::class, 'upload']);
    Route::post('/upload/files', [FileUploadController::class, 'uploadMultiple']);
    Route::post('/upload/style-images', [FileUploadController::class, 'uploadStyleImages']);
    Route::post('/upload/technical-files', [FileUploadController::class, 'uploadTechnicalFiles']);
    Route::post('/upload/delete', [FileUploadController::class, 'delete']);

    // Excel Import
    Route::prefix('excel-import')->middleware('permission:style.create')->group(function () {
        Route::post('/analyze', [\App\Http\Controllers\Api\ExcelImportController::class, 'analyze']);
        Route::post('/{poId}/execute', [\App\Http\Controllers\Api\ExcelImportController::class, 'import']);
        Route::post('/{poId}/import', [\App\Http\Controllers\Api\ExcelImportController::class, 'import']);
    });

    // Invitation Management
    Route::prefix('purchase-orders/{poId}/invitations')->group(function () {
        // View invitations
        Route::middleware('permission:po.view')->group(function () {
            Route::get('/', [InvitationController::class, 'index']);
        });

        // Send invitations
        Route::middleware('permission:po.invite')->group(function () {
            Route::post('/send', [InvitationController::class, 'send']);
            Route::post('/{invitationId}/resend', [InvitationController::class, 'resend']);
        });

        // Cancel invitations
        Route::middleware('permission:po.invite')->group(function () {
            Route::post('/{invitationId}/cancel', [InvitationController::class, 'cancel']);
        });
    });

    // Public invitation actions (token-based, no permission needed)
    Route::prefix('invitations')->group(function () {
        Route::get('/validate/{token}', [InvitationController::class, 'validate']);
        Route::post('/{token}/accept', [InvitationController::class, 'accept']);
        Route::post('/{token}/reject', [InvitationController::class, 'reject']);
    });

    // Factory Assignment Management
    Route::prefix('purchase-orders/{poId}/factory-assignments')->group(function () {
        // View assignments
        Route::middleware('permission:po.view')->group(function () {
            Route::get('/', [FactoryAssignmentController::class, 'index']);
            Route::get('/{id}', [FactoryAssignmentController::class, 'show']);
            Route::get('/{assignmentId}/styles', [FactoryAssignmentController::class, 'assignedStyles']);
            Route::get('/statistics/overview', [FactoryAssignmentController::class, 'statistics']);
        });

        // Update assignment notes
        Route::middleware('permission:po.edit')->group(function () {
            Route::put('/{id}/notes', [FactoryAssignmentController::class, 'updateNotes']);
        });

        // Remove assignments
        Route::middleware('permission:po.assign_factory')->group(function () {
            Route::delete('/{id}', [FactoryAssignmentController::class, 'destroy']);
        });
    });

    // Factory's view of their assignments
    Route::get('/my-factory-assignments', [FactoryAssignmentController::class, 'myAssignments']);

    // Style Sample Processes
    Route::middleware('permission:sample.view')->group(function () {
        Route::get('/styles/{styleId}/sample-processes', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'index']);
    });

    Route::middleware('permission:sample.create')->group(function () {
        Route::post('/styles/bulk-assign-sample-processes', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'bulkAssign']);
        Route::post('/styles/{styleId}/sample-processes/reorder', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'reorder']);
        Route::post('/styles/{styleId}/sample-processes/add-custom', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'addCustomType']);
        Route::put('/styles/{styleId}/sample-processes/{processId}', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'update']);
        Route::delete('/styles/{styleId}/sample-processes/{processId}', [App\Http\Controllers\Api\StyleSampleProcessController::class, 'destroy']);
    });

    // Sample Management
    Route::prefix('purchase-orders/{poId}/styles/{styleId}/samples')->group(function () {
        // View samples
        Route::middleware('permission:sample.view')->group(function () {
            Route::get('/', [SampleController::class, 'index']);
            Route::get('/{id}', [SampleController::class, 'show']);
            Route::get('/types/available', [SampleController::class, 'availableSampleTypes']);
        });

        // Submit samples
        Route::middleware('permission:sample.create')->group(function () {
            Route::post('/', [SampleController::class, 'store']);
        });

        // Agency approval
        Route::middleware('permission:sample.agency_approve')->group(function () {
            Route::post('/{id}/agency-approve', [SampleController::class, 'agencyApprove']);
            Route::post('/{id}/agency-reject', [SampleController::class, 'agencyReject']);
        });

        // Importer approval
        Route::middleware('permission:sample.approve_final')->group(function () {
            Route::post('/{id}/importer-approve', [SampleController::class, 'importerApprove']);
            Route::post('/{id}/importer-reject', [SampleController::class, 'importerReject']);
        });
    });

    // Production Tracking
    Route::prefix('purchase-orders/{poId}/styles/{styleId}/production-tracking')->group(function () {
        // View production tracking
        Route::middleware('permission:production.view')->group(function () {
            Route::get('/', [ProductionTrackingController::class, 'index']);
            Route::get('/{id}', [ProductionTrackingController::class, 'show']);
            Route::get('/statistics/overview', [ProductionTrackingController::class, 'statistics']);
            Route::get('/timeline/view', [ProductionTrackingController::class, 'timeline']);
        });

        // Submit production updates
        Route::middleware('permission:production.submit')->group(function () {
            Route::post('/', [ProductionTrackingController::class, 'store']);
        });

        // Edit production updates
        Route::middleware('permission:production.edit')->group(function () {
            Route::put('/{id}', [ProductionTrackingController::class, 'update']);
        });

        // Delete production updates
        Route::middleware('permission:production.delete')->group(function () {
            Route::delete('/{id}', [ProductionTrackingController::class, 'destroy']);
        });
    });

    // Production Stages (master data)
    Route::get('/production-stages', [ProductionTrackingController::class, 'stages']);

    // Quality Inspection System
    Route::prefix('purchase-orders/{poId}/styles/{styleId}/quality-inspections')->group(function () {
        // View inspections
        Route::middleware('permission:quality_inspection.view')->group(function () {
            Route::get('/', [QualityInspectionController::class, 'index']);
            Route::get('/{id}', [QualityInspectionController::class, 'show']);
            Route::get('/statistics/overview', [QualityInspectionController::class, 'statistics']);
            Route::get('/{id}/certificate', [QualityInspectionController::class, 'certificate']);
        });

        // Calculate AQL parameters
        Route::middleware('permission:quality_inspection.create')->group(function () {
            Route::post('/calculate-aql', [QualityInspectionController::class, 'calculateAql']);
        });

        // Create inspections
        Route::middleware('permission:quality_inspection.create')->group(function () {
            Route::post('/', [QualityInspectionController::class, 'store']);
        });

        // Update inspections
        Route::middleware('permission:quality_inspection.edit')->group(function () {
            Route::put('/{id}', [QualityInspectionController::class, 'update']);
            Route::post('/{id}/defects', [QualityInspectionController::class, 'addDefects']);
        });

        // Complete inspections
        Route::middleware('permission:quality_inspection.approve')->group(function () {
            Route::post('/{id}/complete', [QualityInspectionController::class, 'complete']);
        });
    });

    // Quality Inspection Master Data
    Route::get('/inspection-types', [QualityInspectionController::class, 'inspectionTypes']);
    Route::get('/defect-types', [QualityInspectionController::class, 'defectTypes']);

    // Shipment Tracking System
    Route::prefix('purchase-orders/{poId}/shipments')->group(function () {
        // View shipments
        Route::middleware('permission:shipment.view')->group(function () {
            Route::get('/', [ShipmentController::class, 'index']);
            Route::get('/{id}', [ShipmentController::class, 'show']);
            Route::get('/statistics/overview', [ShipmentController::class, 'statistics']);
        });

        // Create shipments
        Route::middleware('permission:shipment.create')->group(function () {
            Route::post('/', [ShipmentController::class, 'store']);
        });

        // Update shipments
        Route::middleware('permission:shipment.edit')->group(function () {
            Route::put('/{id}', [ShipmentController::class, 'update']);
            Route::post('/{id}/status', [ShipmentController::class, 'updateStatus']);
            Route::post('/{id}/updates', [ShipmentController::class, 'addUpdate']);
        });
    });

    // Reporting & Analytics System
    Route::prefix('reports')->middleware('permission:reports.view')->group(function () {
        // Dashboard overview
        Route::get('/dashboard', [ReportController::class, 'dashboard']);

        // Detailed reports
        Route::get('/purchase-orders', [ReportController::class, 'purchaseOrders']);
        Route::get('/production', [ReportController::class, 'production']);
        Route::get('/quality-inspections', [ReportController::class, 'qualityInspections']);
        Route::get('/shipments', [ReportController::class, 'shipments']);

        // Statistics endpoints
        Route::get('/stats/purchase-orders', [ReportController::class, 'purchaseOrderStats']);
        Route::get('/stats/samples', [ReportController::class, 'sampleStats']);
        Route::get('/stats/production', [ReportController::class, 'productionStats']);
        Route::get('/stats/quality-inspections', [ReportController::class, 'qualityInspectionStats']);
        Route::get('/stats/shipments', [ReportController::class, 'shipmentStats']);
    });

    // Public settings (no authentication required but included in sanctum group for consistency)
    Route::get('/settings/public', [SettingsController::class, 'publicSettings']);
});
