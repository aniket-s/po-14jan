# Style Management Enhancement - Implementation Plan

## Overview
This document outlines the comprehensive plan to enhance the "Create New Style" functionality based on client requirements.

---

## 📋 Client Requirements Summary

### 1. **Color Management System**
- **Current**: Free text input for color name
- **Required**:
  - Searchable dropdown with autocomplete
  - Filter colors by fabric type
  - Example: Entering 'B' shows Black, Brown, Raw black, Black Sand, etc.
  - Remove Pantone/PTI# requirement (make optional)

### 2. **Fabric Weight Field**
- **Current**: Field exists in database but not in form
- **Required**: Add visible input field in form

### 3. **New Dropdown Fields**
- **Brand**: Select from master data (default: Men's)
- **Buyer**: New entity with options:
  - Rebel Minds (Default)
  - R3bel Denim
  - Citi Trends
  - Burlington Coat
  - Ross
  - SWFM
  - etc.
- **Gender**: Already exists, make default "Men's"

### 4. **Remove Sub-Menus**
- Remove "Create Trim" inline form
- Remove "Add Prepack" functionality from style creation

### 5. **Admin Management Pages**
Client needs admin ability to manage:
- ✅ Brands (already exists)
- ✅ Genders (already exists)
- ✅ Sizes (already exists)
- ✅ Prepack Codes (already exists)
- ❌ **Colors** (needs to be created)
- ❌ **Buyers** (needs to be created)
- ❌ **Categories** (needs to be created)

### 6. **Additional Form Fields**
- **Category**: Dropdown with options like:
  - Tee shirts
  - Knit pants
  - Knit hoodie
  - Denim pants
  - etc.
- **Season**: Dropdown (master data already exists)
- **Active/Inactive**: Toggle/checkbox
- **Pricing**: MSRP and Price 1, 2, 3, 4, 5

### 7. **Audit Information**
Display for reference:
- Created Date and Creator
- Last Edited Date and Editor

### 8. **File Upload Improvements**
- **Issue**: Technical Pack upload doesn't show after upload
- **Required**:
  - Fix display issue
  - Implement drag-and-drop for T/P and Spec uploads

### 9. **Sorting & Filtering**
- Styles should be sortable by Brand and/or Buyer

---

## 🏗️ Technical Implementation Plan

### **Phase 1: Backend Infrastructure**

#### 1.1 Database Migrations

**New Tables:**

```sql
-- Colors Table
CREATE TABLE colors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    pantone_code VARCHAR(50) NULLABLE,
    fabric_types JSON,  -- Array of fabric types this color applies to
    is_active BOOLEAN DEFAULT 1,
    display_order INT DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Buyers Table
CREATE TABLE buyers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INT DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Categories Table
CREATE TABLE categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INT DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL
);
```

**Update Styles Table:**

```sql
ALTER TABLE styles ADD COLUMN:
    - brand_id BIGINT (Foreign Key to brands)
    - buyer_id BIGINT (Foreign Key to buyers)
    - category_id BIGINT (Foreign Key to categories)
    - season_id BIGINT (Foreign Key to seasons)
    - color_id BIGINT (Foreign Key to colors) -- Replace free text
    - msrp DECIMAL(10,2)
    - price_1 DECIMAL(10,2)
    - price_2 DECIMAL(10,2)
    - price_3 DECIMAL(10,2)
    - price_4 DECIMAL(10,2)
    - price_5 DECIMAL(10,2)
    - is_active BOOLEAN DEFAULT 1
    - updated_by BIGINT (User who last updated)
    - Make fabric_weight visible/required in form
```

#### 1.2 Models

**Create New Models:**
- `app/Models/Color.php` - with fabric type filtering logic
- `app/Models/Buyer.php`
- `app/Models/Category.php`

**Update Existing:**
- `app/Models/Style.php` - Add relationships and new fields
- `app/Models/Season.php` - Ensure proper structure

#### 1.3 Controllers

**Create New Controllers:**
- `app/Http/Controllers/Api/ColorController.php`
  - GET `/master-data/colors?fabric_type=XXX&search=B` (filtered search)
  - POST/PUT/DELETE for CRUD

- `app/Http/Controllers/Api/BuyerController.php`
  - Standard CRUD endpoints

- `app/Http/Controllers/Api/CategoryController.php`
  - Standard CRUD endpoints

**Update Existing:**
- `app/Http/Controllers/Api/StyleController.php`
  - Handle new fields in create/update
  - Add `updated_by` tracking
  - Return audit info (created_by, updated_by with user names)

#### 1.4 API Routes

```php
// routes/api.php

Route::middleware('auth:sanctum')->group(function () {
    // Color Management
    Route::get('/master-data/colors', [ColorController::class, 'index']);
    Route::post('/master-data/colors', [ColorController::class, 'store']);
    Route::put('/master-data/colors/{id}', [ColorController::class, 'update']);
    Route::delete('/master-data/colors/{id}', [ColorController::class, 'destroy']);

    // Buyer Management
    Route::get('/master-data/buyers', [BuyerController::class, 'index']);
    Route::post('/master-data/buyers', [BuyerController::class, 'store']);
    Route::put('/master-data/buyers/{id}', [BuyerController::class, 'update']);
    Route::delete('/master-data/buyers/{id}', [BuyerController::class, 'destroy']);

    // Category Management
    Route::get('/master-data/categories', [CategoryController::class, 'index']);
    Route::post('/master-data/categories', [CategoryController::class, 'store']);
    Route::put('/master-data/categories/{id}', [CategoryController::class, 'update']);
    Route::delete('/master-data/categories/{id}', [CategoryController::class, 'destroy']);
});
```

---

### **Phase 2: Frontend - Admin Pages**

Create admin management pages for new entities:

#### 2.1 Colors Admin Page
**File**: `frontend/src/app/master-data/colors/page.tsx`

**Features**:
- List all colors with search
- Create/Edit dialog
- Fields:
  - Name
  - Code
  - Pantone Code (optional)
  - Fabric Types (multi-select)
  - Active status
  - Display order
- Delete with confirmation
- Sorting by display order

#### 2.2 Buyers Admin Page
**File**: `frontend/src/app/master-data/buyers/page.tsx`

**Features**:
- Similar to Brands page structure
- CRUD operations
- Active/inactive toggle

#### 2.3 Categories Admin Page
**File**: `frontend/src/app/master-data/categories/page.tsx`

**Features**:
- Product category management
- Examples: Tee shirts, Knit pants, Knit hoodie, Denim pants

---

### **Phase 3: Frontend - Update Create Style Form**

**File**: `frontend/src/components/styles/CreateStyleDialog.tsx`

#### 3.1 Form Structure Reorganization

**Basic Information Section:**
```tsx
- Style Number * (existing)
- Fit (existing)
- Description (existing)
- Brand * (NEW - dropdown)
- Buyer * (NEW - dropdown)
- Category * (NEW - dropdown)
- Season * (NEW - dropdown)
- Active/Inactive (NEW - toggle/checkbox)
```

**Fabric & Color Section:**
```tsx
- Fabric Type Name (existing)
- Fabric Weight * (NEW - number input, kg/m² or oz/yd²)
- Color * (UPDATED - searchable dropdown with fabric type filter)
- Color Code/Pantone (optional, auto-filled from color selection)
```

**Pricing Section (NEW):**
```tsx
- MSRP (number input with currency)
- Price 1 (number input)
- Price 2 (number input)
- Price 3 (number input)
- Price 4 (number input)
- Price 5 (number input)
```

**Master Data Section:**
```tsx
- Gender * (existing dropdown - default to "Men's")
- Sizes (existing - auto-load based on gender)
```

**Trims Section:**
```tsx
- Select Trims (multi-select from existing trims)
- ❌ REMOVE "Create Trim" inline form button
```

**Prepacks Section:**
```tsx
- ❌ REMOVE entire Prepacks section
- ❌ REMOVE "Add Prepack" button
```

**Files & Documents:**
```tsx
- Style Images (UPDATED - add drag & drop)
- Technical Pack / Spec Sheet (UPDATED - add drag & drop, fix display)
```

**Audit Information (Read-only section at bottom):**
```tsx
- Created: {date} by {user_name}
- Last Updated: {date} by {user_name}
```

#### 3.2 Color Dropdown Implementation

**Requirements**:
- Searchable/filterable dropdown
- Filter by fabric type when fabric type is selected
- Show color name and code
- Autocomplete behavior (entering 'B' shows Black, Brown, etc.)

**Implementation**:
```tsx
// Use Combobox from shadcn/ui or custom component
<Combobox
  value={selectedColor}
  onChange={setSelectedColor}
  onSearchChange={handleColorSearch}
  options={filteredColors}
  placeholder="Search colors..."
  displayValue={(color) => `${color.name} (${color.code})`}
/>
```

#### 3.3 Drag & Drop File Upload

**Library**: `react-dropzone` (already available)

**Implementation**:
```tsx
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/postscript': ['.ai']
  },
  multiple: true,
  onDrop: handleTechnicalFileDrop
});
```

#### 3.4 Fix Technical Pack Display

**Issue**: Files uploaded but not showing
**Investigation needed**:
- Check if file paths are being stored correctly
- Verify file list rendering logic
- Ensure uploaded files persist in state

---

### **Phase 4: Frontend - Update Styles List Page**

**File**: `frontend/src/app/styles/page.tsx`

#### 4.1 Add Sorting & Filtering

**Add Filter Controls:**
```tsx
- Brand Filter (dropdown)
- Buyer Filter (dropdown)
- Status Filter (Active/Inactive)
- Season Filter
- Category Filter
```

**Add Sorting:**
```tsx
- Sort by Brand
- Sort by Buyer
- Sort by Style Number
- Sort by Created Date
```

**Table Columns to Add:**
```tsx
- Brand column
- Buyer column
- Category column
- Status badge (Active/Inactive)
- MSRP column
```

---

### **Phase 5: Frontend Services**

**Files to Update:**
- `frontend/src/services/styles.ts` - Add new fields to interfaces
- Create new services:
  - `frontend/src/services/colors.ts`
  - `frontend/src/services/buyers.ts`
  - `frontend/src/services/categories.ts`

---

## 🗂️ Files to Create/Modify

### Backend (Laravel)

**New Files:**
```
backend/database/migrations/
  - YYYY_MM_DD_create_colors_table.php
  - YYYY_MM_DD_create_buyers_table.php
  - YYYY_MM_DD_create_categories_table.php
  - YYYY_MM_DD_add_new_fields_to_styles_table.php

backend/app/Models/
  - Color.php
  - Buyer.php
  - Category.php

backend/app/Http/Controllers/Api/
  - ColorController.php
  - BuyerController.php
  - CategoryController.php
```

**Modified Files:**
```
backend/app/Models/Style.php
backend/app/Http/Controllers/Api/StyleController.php
backend/routes/api.php
```

### Frontend (Next.js)

**New Files:**
```
frontend/src/app/master-data/colors/page.tsx
frontend/src/app/master-data/buyers/page.tsx
frontend/src/app/master-data/categories/page.tsx
frontend/src/services/colors.ts
frontend/src/services/buyers.ts
frontend/src/services/categories.ts
frontend/src/components/master-data/ColorDialog.tsx
frontend/src/components/master-data/BuyerDialog.tsx
frontend/src/components/master-data/CategoryDialog.tsx
```

**Modified Files:**
```
frontend/src/components/styles/CreateStyleDialog.tsx (major refactor)
frontend/src/app/styles/page.tsx
frontend/src/services/styles.ts
```

---

## 📝 Data Models

### Color Model
```typescript
interface Color {
  id: number;
  name: string;
  code: string;
  pantone_code?: string;
  fabric_types: string[]; // e.g., ['CVC', 'Cotton', 'Polyester']
  is_active: boolean;
  display_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}
```

### Buyer Model
```typescript
interface Buyer {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}
```

### Category Model
```typescript
interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}
```

### Updated Style Model
```typescript
interface Style {
  // ... existing fields ...
  brand_id: number;
  brand?: Brand;
  buyer_id: number;
  buyer?: Buyer;
  category_id: number;
  category?: Category;
  season_id: number;
  season?: Season;
  color_id: number;
  color?: Color;
  fabric_weight: number;
  msrp: number;
  price_1: number;
  price_2: number;
  price_3: number;
  price_4: number;
  price_5: number;
  is_active: boolean;
  created_by: number;
  created_by_user?: User;
  updated_by: number;
  updated_by_user?: User;
  // ... other fields ...
}
```

---

## 🎯 Implementation Order

1. ✅ **Phase 1.1**: Create database migrations (Colors, Buyers, Categories, update Styles)
2. ✅ **Phase 1.2**: Create models with relationships
3. ✅ **Phase 1.3**: Create controllers with CRUD operations
4. ✅ **Phase 1.4**: Add API routes
5. ✅ **Phase 2**: Create admin pages (Colors, Buyers, Categories)
6. ✅ **Phase 3**: Update CreateStyleDialog form
   - Add new dropdowns
   - Update color field
   - Add pricing fields
   - Remove sub-menus
   - Add drag-drop
   - Fix technical pack display
7. ✅ **Phase 4**: Update Styles list page with sorting/filtering
8. ✅ **Phase 5**: Update frontend services
9. ✅ **Testing**: Full end-to-end testing
10. ✅ **Deploy**: Commit and push to branch

---

## 🧪 Testing Checklist

### Backend Testing
- [ ] Color CRUD operations
- [ ] Buyer CRUD operations
- [ ] Category CRUD operations
- [ ] Color filtering by fabric type
- [ ] Style creation with new fields
- [ ] Style update with audit tracking
- [ ] API response includes audit info

### Frontend Testing
- [ ] Color admin page - Create/Edit/Delete
- [ ] Buyer admin page - Create/Edit/Delete
- [ ] Category admin page - Create/Edit/Delete
- [ ] Style creation with all new fields
- [ ] Color dropdown search/filter works
- [ ] Brand dropdown works
- [ ] Buyer dropdown works
- [ ] Category dropdown works
- [ ] Season dropdown works
- [ ] Fabric weight input works
- [ ] MSRP and Price 1-5 inputs work
- [ ] Active/Inactive toggle works
- [ ] Trim selection WITHOUT inline creation
- [ ] NO Prepack section visible
- [ ] Drag-drop file upload works
- [ ] Technical pack files display correctly
- [ ] Audit info displays correctly
- [ ] Styles list sorting by Brand/Buyer
- [ ] Styles list filtering by Brand/Buyer

---

## 📌 Notes

1. **Gender Default**: Set "Men's" as default in dropdown
2. **Fabric Type Reference**: Colors should reference common fabric types (CVC, Cotton, Polyester, etc.)
3. **Color Search**: Implement debounced search for performance
4. **File Upload**: Use FormData multipart for drag-drop uploads
5. **Permissions**: Ensure admin routes are protected
6. **Validation**: Add proper Zod schemas for all new fields
7. **Migration Safety**: Use transactions and rollback support

---

## 🚀 Ready to Proceed

This plan covers all client requirements:
- ✅ Color management with fabric type filtering
- ✅ Fabric weight field
- ✅ Brand, Buyer, Category, Season dropdowns
- ✅ Remove sub-menus (Trim creation, Prepack)
- ✅ Admin pages for all master data
- ✅ Additional fields (MSRP, Prices, Active status)
- ✅ Audit information display
- ✅ Drag-drop file uploads
- ✅ Technical pack display fix
- ✅ Sorting by Brand/Buyer

**Estimated Files**: ~25 new files, ~10 modified files
**Estimated Time**: Full implementation across all phases

Awaiting approval to proceed with implementation.
