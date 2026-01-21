# Garment Supply Chain Platform
## Complete Workflow Documentation for Clients

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Getting Started](#2-getting-started)
3. [Master Data Setup](#3-master-data-setup)
4. [Purchase Order Workflow](#4-purchase-order-workflow)
5. [Style Management](#5-style-management)
6. [Sample Approval Workflow](#6-sample-approval-workflow)
7. [Production Tracking](#7-production-tracking)
8. [Quality Inspection (AQL)](#8-quality-inspection-aql)
9. [Shipment Tracking](#9-shipment-tracking)
10. [Complete Workflow Diagram](#10-complete-workflow-diagram)
11. [User Roles & Permissions](#11-user-roles--permissions)
12. [Glossary](#12-glossary)

---

# 1. Executive Summary

## What is This Platform?

This is a **Garment Supply Chain Management Platform** - a complete digital solution that helps you manage the entire process of manufacturing and delivering garments, from the moment you receive an order to the final delivery at the warehouse.

## Who Uses This Platform?

| User Type | Role Description |
|-----------|------------------|
| **Importer/Brand Owner** | Creates purchase orders, approves samples, monitors production |
| **Factory** | Receives orders, submits samples, reports production progress |
| **Quality Inspector** | Conducts quality checks before shipment |
| **Admin** | Manages system settings, users, and permissions |

## Key Benefits

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHY USE THIS PLATFORM?                       │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Track all orders in one place                                │
│  ✓ Never miss a sample approval deadline                        │
│  ✓ Real-time production visibility                              │
│  ✓ Quality control with international AQL standards             │
│  ✓ Complete audit trail of all activities                       │
│  ✓ Automatic date calculations for shipping                     │
│  ✓ Factory collaboration without sharing system access          │
└─────────────────────────────────────────────────────────────────┘
```

## The Big Picture

Here's how the platform fits into your business:

```
    YOUR BUSINESS WORKFLOW WITH THIS PLATFORM
    ==========================================

    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ RETAILER │────▶│   YOU    │────▶│ FACTORY  │────▶│WAREHOUSE │
    │  Orders  │     │(Importer)│     │Production│     │ Delivery │
    └──────────┘     └──────────┘     └──────────┘     └──────────┘
         │                │                │                │
         │                │                │                │
         ▼                ▼                ▼                ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              THIS PLATFORM MANAGES EVERYTHING               │
    │  • Purchase Orders    • Samples      • Quality Checks       │
    │  • Style Details      • Production   • Shipments            │
    └─────────────────────────────────────────────────────────────┘
```

---

# 2. Getting Started

## Logging In

1. Open your web browser (Chrome, Firefox, or Safari recommended)
2. Go to the platform website
3. Enter your **Email** and **Password**
4. Click **"Login"**

## The Dashboard

After logging in, you'll see your dashboard with quick summaries:

```
┌─────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ Active POs  │  │  Pending    │  │  In         │            │
│   │     25      │  │  Samples    │  │  Production │            │
│   │             │  │     12      │  │     18      │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │  Quality    │  │  Shipments  │  │  Delivered  │            │
│   │  Pending    │  │  In Transit │  │  This Month │            │
│   │      5      │  │      8      │  │     45      │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Main Navigation

The main menu gives you access to all features:

| Menu Item | What It Does |
|-----------|--------------|
| **Dashboard** | Overview of all activities |
| **Purchase Orders** | Create and manage orders |
| **Styles** | Manage product definitions |
| **Samples** | Track sample approvals |
| **Production** | Monitor manufacturing progress |
| **Quality** | Quality inspection records |
| **Shipments** | Track deliveries |
| **Master Data** | Manage brands, colors, sizes, etc. |
| **Reports** | Generate business reports |
| **Settings** | System configuration (Admin only) |

---

# 3. Master Data Setup

Before creating purchase orders, you need to set up your **Master Data**. Think of this as your "dictionary" of common terms and options used throughout the system.

## What is Master Data?

Master Data is the foundational information that you'll select from dropdown menus when creating orders and styles.

```
                        MASTER DATA OVERVIEW
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │   COMPANY DATA          PRODUCT DATA         LOGISTICS      │
    │   ─────────────         ────────────         ─────────      │
    │   • Brands              • Categories         • Warehouses   │
    │   • Retailers           • Colors             • Countries    │
    │   • Agents              • Sizes              • Currencies   │
    │   • Vendors             • Genders            • Payment Terms│
    │   • Factories           • Fabric Types                      │
    │                         • Fabric Qualities                  │
    │                         • Trims                             │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

## Setting Up Master Data (Step-by-Step Examples)

### Example 1: Adding a New Brand

**Scenario:** You want to add "Urban Style" as a brand you work with.

**Steps:**
1. Go to **Master Data** → **Brands**
2. Click **"Add New Brand"**
3. Fill in the form:

| Field | What to Enter | Example |
|-------|---------------|---------|
| Brand Name | Full brand name | Urban Style |
| Brand Code | Short code (2-5 letters) | US |
| Description | Brief description | Contemporary fashion brand |
| Status | Active or Inactive | Active |

4. Click **"Save"**

**Result:** "Urban Style" now appears in brand dropdown menus throughout the system.

---

### Example 2: Adding a New Retailer

**Scenario:** "Fashion Retail Co." is a new customer who will be placing orders.

**Steps:**
1. Go to **Master Data** → **Retailers**
2. Click **"Add New Retailer"**
3. Fill in the form:

| Field | What to Enter | Example |
|-------|---------------|---------|
| Retailer Name | Company name | Fashion Retail Co. |
| Code | Short identifier | FRC |
| Email | Contact email | orders@fashionretail.com |
| Phone | Contact number | +1-555-123-4567 |
| Address | Street address | 123 Fashion Avenue |
| City | City name | New York |
| State | State/Province | NY |
| Country | Country | United States |

4. Click **"Save"**

---

### Example 3: Setting Up Seasons

**Scenario:** You need to set up seasons for organizing collections.

**Steps:**
1. Go to **Master Data** → **Seasons**
2. Add your seasons:

| Season Name | Code | Year |
|-------------|------|------|
| Spring/Summer | SS | 2025 |
| Fall/Winter | FW | 2025 |
| Resort | RS | 2025 |
| Holiday | HOL | 2025 |

---

### Example 4: Setting Up Sizes by Gender

**Scenario:** You need different size options for Men's vs Women's clothing.

**Step 1:** Add Genders
1. Go to **Master Data** → **Genders**
2. Add: Men, Women, Kids, Unisex

**Step 2:** Add Sizes for Each Gender
1. Go to **Master Data** → **Sizes**
2. For **Men**:

| Size Name | Code | Order |
|-----------|------|-------|
| Small | S | 1 |
| Medium | M | 2 |
| Large | L | 3 |
| X-Large | XL | 4 |
| XX-Large | XXL | 5 |

3. For **Women**: XS, S, M, L, XL
4. For **Kids**: 2T, 3T, 4T, 5, 6, 7, 8, 10, 12

---

### Example 5: Setting Up Colors

**Steps:**
1. Go to **Master Data** → **Colors**
2. Add colors with their codes:

| Color Name | Code | Hex Value |
|------------|------|-----------|
| Navy Blue | NVY | #000080 |
| Heather Grey | HGR | #9E9E9E |
| Black | BLK | #000000 |
| White | WHT | #FFFFFF |
| Red | RED | #FF0000 |

---

### Master Data Checklist

Before creating your first Purchase Order, ensure you have set up:

```
MASTER DATA SETUP CHECKLIST
============================

[ ] Brands (at least one)
[ ] Retailers/Customers (at least one)
[ ] Seasons (current and upcoming)
[ ] Genders (Men, Women, Kids, etc.)
[ ] Sizes (for each gender)
[ ] Colors (your color palette)
[ ] Categories (T-Shirts, Pants, Dresses, etc.)
[ ] Fabric Types (Cotton, Polyester, Blend, etc.)
[ ] Fabric Qualities (Premium, Standard, Economy)
[ ] Warehouses (delivery destinations)
[ ] Countries (with sailing times)
[ ] Currencies (USD, EUR, etc.)
[ ] Payment Terms (Net 30, Net 60, etc.)
[ ] Vendors (your suppliers)
```

---

# 4. Purchase Order Workflow

A **Purchase Order (PO)** is the core document that tracks an entire order from start to delivery.

## Understanding Purchase Orders

```
    WHAT'S IN A PURCHASE ORDER?
    ═══════════════════════════

    ┌─────────────────────────────────────────────────────────────┐
    │  PO-2025-001                                    Status: NEW │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  WHO                           WHAT                         │
    │  ───                           ────                         │
    │  Retailer: Fashion Retail Co.  Styles: 3 different styles   │
    │  Brand: Urban Style            Total Qty: 15,000 units      │
    │  Agent: John Smith Agency      Total Value: $75,000         │
    │                                                             │
    │  WHEN                          WHERE                        │
    │  ────                          ─────                        │
    │  Order Date: Jan 15, 2025      Ship From: Vietnam           │
    │  Ex-Factory: Mar 25, 2025      Ship To: LA Warehouse        │
    │  ETD: Mar 28, 2025             Shipping: FOB                │
    │  ETA: Apr 20, 2025                                          │
    │  In Warehouse: Apr 25, 2025                                 │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

## Creating a Purchase Order (Complete Example)

### Scenario
**Fashion Retail Co.** places an order for **10,000 Men's Cotton T-Shirts** for their **Summer 2025** collection under the **Urban Style** brand.

### Step 1: Start a New Purchase Order

1. Go to **Purchase Orders** → Click **"Create New PO"**
2. The system automatically generates a PO number: **PO-2025-001**

### Step 2: Fill in Basic Information

| Section | Field | What to Enter | Example Value |
|---------|-------|---------------|---------------|
| **Header** | Headline | Brief description | Summer 2025 T-Shirt Order |
| **Parties** | Retailer | Select customer | Fashion Retail Co. |
| | Brand | Select brand | Urban Style |
| | Agent | Select sales agent | John Smith Agency |
| | Vendor | Select supplier | ABC Textiles |
| **Collection** | Season | Select season | Spring/Summer 2025 |
| | Category | Product category | T-Shirts |

### Step 3: Set Key Dates

| Date Field | What It Means | Example |
|------------|---------------|---------|
| **Order Date** | When PO was placed | January 15, 2025 |
| **Ex-Factory Date** | When goods leave factory | March 25, 2025 |
| **ETD** | Estimated Time of Departure (from port) | March 28, 2025 |

**Automatic Calculations:**
The system automatically calculates:
- **ETA** (Estimated Time of Arrival): Based on destination country's sailing time
- **In-Warehouse Date**: ETA + 4 business days

```
    DATE CALCULATION EXAMPLE
    ════════════════════════

    Ex-Factory:  March 25, 2025  ─┐
                                  │
    ETD:         March 28, 2025  ─┤  (You enter these)
                                  │
    ──────────────────────────────┘

    ETA:         April 20, 2025  ─┐  (System calculates)
                    ↑             │  (Based on 23 days
              Sailing Time        │   sailing to USA)
                                  │
    In-Warehouse: April 25, 2025 ─┘  (ETA + 4 business days)
```

### Step 4: Set Payment & Shipping Terms

| Field | Options | Example |
|-------|---------|---------|
| **Currency** | USD, EUR, GBP, etc. | USD |
| **Payment Terms** | Net 30, Net 60, LC, etc. | Net 60 |
| **Shipping Term** | FOB, DDP, CIF, etc. | FOB |
| **Destination Warehouse** | Select warehouse | Los Angeles Warehouse |

### Step 5: Save the Purchase Order

Click **"Create Purchase Order"**

**Result:** Your PO is created with status **"Draft"**

---

## Purchase Order Statuses

A PO moves through these statuses during its lifecycle:

```
    PURCHASE ORDER STATUS FLOW
    ══════════════════════════

    ┌────────┐    ┌──────────┐    ┌────────────┐    ┌────────────┐
    │ DRAFT  │───▶│ CONFIRMED│───▶│IN PRODUCTION│───▶│  SHIPPED   │
    └────────┘    └──────────┘    └────────────┘    └────────────┘
         │                                                  │
         │                                                  ▼
         │                                          ┌────────────┐
         ▼                                          │ DELIVERED  │
    ┌────────┐                                      └────────────┘
    │CANCELLED│
    └────────┘

    Status Meanings:
    ─────────────────
    Draft        = PO created but not yet finalized
    Confirmed    = PO finalized, ready for production
    In Production= Factory is manufacturing the goods
    Shipped      = Goods have left the factory
    Delivered    = Goods received at warehouse
    Cancelled    = PO was cancelled
```

---

## Sample Schedule (Automatic Milestones)

When you create a PO, the system generates a **Sample Schedule** with 8 key milestones:

```
    SAMPLE SCHEDULE FOR PO-2025-001
    ════════════════════════════════

    ORDER DATE: January 15, 2025          ETD: March 28, 2025

    MILESTONES AFTER PO DATE:
    ─────────────────────────
    1. Lab Dip Approval      → Jan 20  (PO + 5 days)
    2. Fit Sample Approval   → Jan 22  (PO + 7 days)
    3. Trim Approval         → Jan 22  (PO + 7 days)
    4. 1st Proto Approval    → Jan 25  (PO + 10 days)

    MILESTONES BEFORE ETD:
    ──────────────────────
    5. Bulk Fabric In-House  → Feb 16  (ETD - 40 days)
    6. PP Sample Approval    → Feb 21  (ETD - 35 days)
    7. Production Start      → Feb 26  (ETD - 30 days)
    8. TOP Sample Approval   → Mar 18  (ETD - 10 days)
```

This schedule helps you track whether production is on time.

---

# 5. Style Management

A **Style** represents a specific product with all its details (design, sizes, colors, pricing).

## Understanding Styles

```
    WHAT'S IN A STYLE?
    ══════════════════

    ┌─────────────────────────────────────────────────────────────┐
    │  Style #: TS-MEN-001                                        │
    │  Description: Men's Classic Crew Neck T-Shirt               │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  PRODUCT INFO                    PRICING                    │
    │  ────────────                    ───────                    │
    │  Category: T-Shirts              FOB Price: $5.50           │
    │  Gender: Men                     MSRP: $24.99               │
    │  Fabric: 100% Cotton             Wholesale: $12.50          │
    │  Fabric Quality: Premium                                    │
    │  Color: Navy Blue                                           │
    │                                                             │
    │  SIZE BREAKDOWN                  TOTAL                      │
    │  ──────────────                  ─────                      │
    │  S:    1,500 units               Quantity: 10,000           │
    │  M:    3,000 units               Value: $55,000             │
    │  L:    3,500 units                                          │
    │  XL:   2,000 units                                          │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

## Important Concept: Styles and Purchase Orders

**One Style can be in Multiple Purchase Orders**

```
    STYLE-TO-PO RELATIONSHIP
    ════════════════════════

    Style: TS-MEN-001 (Navy T-Shirt)
           │
           ├──── PO-2025-001 (Fashion Retail Co.)
           │     └── 10,000 units @ $5.50
           │
           ├──── PO-2025-005 (Style Mart)
           │     └── 5,000 units @ $5.25  (volume discount)
           │
           └──── PO-2025-008 (Budget Stores)
                 └── 20,000 units @ $4.80  (larger volume)

    Each PO can have different:
    • Quantities
    • Prices
    • Delivery dates
    • Size breakdowns
```

## Creating a Style (Complete Example)

### Step 1: Go to Style Creation

1. Navigate to **Styles** → Click **"Create New Style"**

   OR

   From within a PO → Click **"Add Style"** → **"Create New"**

### Step 2: Enter Style Information

**Basic Information:**

| Field | Description | Example |
|-------|-------------|---------|
| Style Number | Unique identifier | TS-MEN-001 |
| Description | Product name | Men's Classic Crew Neck T-Shirt |
| Brand | Brand name | Urban Style |
| Retailer | Primary customer | Fashion Retail Co. |
| Category | Product type | T-Shirts |
| Season | Collection | Spring/Summer 2025 |

**Product Details:**

| Field | Description | Example |
|-------|-------------|---------|
| Gender | Target gender | Men |
| Color | Primary color | Navy Blue |
| Fabric Type | Material | Cotton |
| Fabric Quality | Quality level | Premium |
| Fabric Description | Details | 100% Combed Cotton, 180 GSM |

**Pricing:**

| Field | Description | Example |
|-------|-------------|---------|
| FOB Price | Factory price | $5.50 |
| MSRP | Retail price | $24.99 |
| Wholesale Price | Distributor price | $12.50 |

### Step 3: Enter Size Breakdown

| Size | Quantity | Percentage |
|------|----------|------------|
| S | 1,500 | 15% |
| M | 3,000 | 30% |
| L | 3,500 | 35% |
| XL | 2,000 | 20% |
| **Total** | **10,000** | **100%** |

### Step 4: Upload Images & Technical Files

- **Style Images:** Photos of the product (front, back, detail)
- **Technical Files:** Tech packs, measurement specs, artwork files

### Step 5: Save the Style

Click **"Save Style"**

---

## Adding Styles to a Purchase Order

### Method 1: Add Existing Style

1. Open the Purchase Order
2. Go to **Styles** tab
3. Click **"Add Existing Style"**
4. Search and select the style
5. Enter PO-specific details:
   - Quantity for this PO
   - Price for this PO (may differ from default)
   - Size breakdown for this PO
6. Click **"Add to PO"**

### Method 2: Bulk Import from Excel

For large orders with many styles:

1. Open the Purchase Order
2. Click **"Import Styles from Excel"**
3. Download the template (if needed)
4. Upload your Excel file
5. Map columns to fields
6. Review and confirm import

**Excel Template Columns:**

| Column | Required | Example |
|--------|----------|---------|
| Style Number | Yes | TS-MEN-001 |
| Description | Yes | Men's Crew Neck T-Shirt |
| Color | Yes | Navy Blue |
| Quantity | Yes | 10000 |
| Unit Price | Yes | 5.50 |
| Size S | No | 1500 |
| Size M | No | 3000 |
| Size L | No | 3500 |
| Size XL | No | 2000 |

---

## Assigning a Factory to a Style

Once a style is added to a PO, you can assign a factory to manufacture it.

### Method 1: Direct Assignment

If the factory is already a user in the system:

1. Open the PO → Go to Style
2. Click **"Assign Factory"**
3. Select the factory from the list
4. Add any special instructions
5. Click **"Assign"**

### Method 2: Send Invitation

If the factory is not yet in the system:

1. Open the PO → Go to Style
2. Click **"Invite Factory"**
3. Enter factory email and name
4. The system sends an invitation email
5. Factory clicks the link to accept/reject
6. Once accepted, they're automatically assigned

```
    FACTORY INVITATION FLOW
    ═══════════════════════

    You                          Factory
     │                              │
     │  Send Invitation             │
     │  ─────────────────────────▶  │
     │                              │
     │                         Receives Email
     │                         with Link
     │                              │
     │                         Clicks "Accept"
     │                              │
     │  ◀─────────────────────────  │
     │  Notification:               │
     │  "Factory Accepted"          │
     │                              │
     │  Factory now assigned        │
     │  to Style in PO              │
```

---

# 6. Sample Approval Workflow

The **Sample Approval Process** ensures product quality before mass production begins. This is one of the most critical workflows in garment manufacturing.

## Understanding Sample Types

There are **8 types of samples** in a typical garment production cycle:

```
    THE 8-STEP SAMPLE APPROVAL PROCESS
    ═══════════════════════════════════

    PHASE 1: PRE-PRODUCTION APPROVALS
    ──────────────────────────────────

    1. LAB DIP
       What: Color matching samples
       Purpose: Ensure fabric color matches approved shade

    2. FIT SAMPLE
       What: Size and fit prototype
       Purpose: Verify measurements and fit

    3. TRIM APPROVAL
       What: Buttons, zippers, labels, tags
       Purpose: Approve all accessories

    4. 1ST PROTO (First Prototype)
       What: First complete sample
       Purpose: Review overall design execution

    PHASE 2: PRE-SHIPMENT APPROVALS
    ───────────────────────────────

    5. BULK FABRIC IN-HOUSE
       What: Confirmation fabric received
       Purpose: Verify fabric quality before cutting

    6. PP SAMPLE (Pre-Production Sample)
       What: Final sample before mass production
       Purpose: Last approval before production starts

    7. PRODUCTION START
       What: Confirmation production began
       Purpose: Acknowledge production commencement

    8. TOP SAMPLE (Top of Production)
       What: Sample from actual production run
       Purpose: Verify quality during production
```

## Sample Prerequisites

Some samples require previous samples to be approved first:

```
    SAMPLE DEPENDENCY CHAIN
    ═══════════════════════

    Lab Dip ──────┐
                  │
    Fit Sample ───┼──▶ 1st Proto ──▶ PP Sample ──▶ TOP Sample
                  │
    Trim Approval─┘

    You CANNOT submit PP Sample until:
    • Lab Dip is approved
    • Fit Sample is approved
    • Trim Approval is done
    • 1st Proto is approved
```

## The Two-Level Approval Process

Each sample goes through **TWO approval stages**:

```
    SAMPLE APPROVAL STAGES
    ══════════════════════

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   FACTORY   │────────▶│  IMPORTER   │────────▶│   FINAL     │
    │  APPROVAL   │         │  APPROVAL   │         │  STATUS     │
    └─────────────┘         └─────────────┘         └─────────────┘

    Factory checks          Importer/Brand          Sample is
    their own work          reviews and             fully approved
    before sending          gives final OK          or rejected
```

### Why Two Levels?

1. **Factory Approval:** Factory's internal quality check before sending
2. **Importer Approval:** Brand owner's final approval

This prevents factories from sending substandard samples and wasting time/shipping costs.

## Submitting a Sample (Factory Perspective)

### Example: Submitting a Lab Dip Sample

**Scenario:** ABC Garments factory needs to submit lab dip samples for the Navy Blue t-shirt.

**Step 1:** Access the Sample Section
1. Log in as Factory user
2. Go to **My Assignments** → Select the PO
3. Go to the Style → Click **"Samples"**

**Step 2:** Create New Sample Submission
1. Click **"Submit New Sample"**
2. Select Sample Type: **Lab Dip**
3. Fill in details:

| Field | What to Enter | Example |
|-------|---------------|---------|
| Sample Reference | Your tracking code | LD-2025-001 |
| Submission Date | Date sending | January 18, 2025 |
| Quantity | Number of swatches | 3 |
| Notes | Additional info | "3 shade variations: Light, Standard, Dark" |

**Step 3:** Factory Self-Approval
1. After internal review, click **"Approve (Factory)"**
2. This sends the sample for importer review

```
    SAMPLE SUBMISSION FLOW
    ══════════════════════

    Factory                              Importer
    ───────                              ────────
       │                                    │
       │  1. Submit Sample                  │
       │  ────────────────▶                 │
       │                                    │
       │  2. Factory Approves               │
       │     (internal check)               │
       │  ────────────────▶                 │
       │                                    │
       │                     3. Importer Reviews
       │                                    │
       │                     4a. Approves ──┼──▶ Sample APPROVED
       │                                    │
       │  ◀────────────────                 │
       │  4b. Rejects with comments         │
       │                                    │
       │  5. Factory fixes issues           │
       │     and resubmits                  │
       │  ────────────────▶                 │
```

## Approving a Sample (Importer Perspective)

### Example: Approving a Lab Dip

**Step 1:** Review Pending Samples
1. Log in as Importer user
2. Go to **Samples** → Filter by "Pending Approval"
3. Click on the sample to review

**Step 2:** Review Sample Details
- View submitted reference number
- Check attached images/files
- Review factory notes

**Step 3:** Make Decision

**Option A - Approve:**
1. Click **"Approve"**
2. Sample status changes to **"Approved"**
3. Factory is notified

**Option B - Reject:**
1. Click **"Reject"**
2. Enter rejection reason:
   ```
   "Color is too light. Please refer to Pantone 19-4052 TCX.
   Need darker shade matching original swatch."
   ```
3. Factory is notified with feedback
4. Factory must resubmit

## Sample Status Overview

```
    SAMPLE STATUSES
    ═══════════════

    ┌─────────────┐
    │   PENDING   │  Sample submitted, waiting for factory approval
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  FACTORY    │  Factory has approved their work
    │  APPROVED   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────┐
    │                                     │
    ▼                                     ▼
┌─────────────┐                   ┌─────────────┐
│  APPROVED   │                   │  REJECTED   │
│   (Final)   │                   │             │
└─────────────┘                   └──────┬──────┘
                                         │
                                         ▼
                                  Factory resubmits
                                  (back to PENDING)
```

## Complete Sample Approval Timeline (Example)

Here's how samples might progress for a real order:

```
    SAMPLE TIMELINE FOR PO-2025-001
    ════════════════════════════════

    Style: Men's Navy T-Shirt (TS-MEN-001)

    DATE        SAMPLE TYPE      ACTION                 STATUS
    ────────    ───────────      ──────                 ──────
    Jan 18      Lab Dip          Factory submits        Pending
    Jan 19      Lab Dip          Factory approves       Factory OK
    Jan 20      Lab Dip          Importer approves      ✓ APPROVED

    Jan 20      Fit Sample       Factory submits        Pending
    Jan 21      Fit Sample       Factory approves       Factory OK
    Jan 22      Fit Sample       Importer REJECTS       Rejected
                                 "Shoulder too wide"
    Jan 24      Fit Sample       Factory resubmits      Pending
    Jan 25      Fit Sample       Importer approves      ✓ APPROVED

    Jan 22      Trim Approval    Factory submits        Pending
    Jan 23      Trim Approval    Importer approves      ✓ APPROVED

    Jan 25      1st Proto        Factory submits        Pending
    Jan 26      1st Proto        Importer approves      ✓ APPROVED

    Feb 16      Bulk Fabric      Factory confirms       ✓ APPROVED

    Feb 21      PP Sample        Factory submits        Pending
    Feb 23      PP Sample        Importer approves      ✓ APPROVED

    Feb 26      Production Start Factory confirms       ✓ APPROVED

    Mar 18      TOP Sample       Factory submits        Pending
    Mar 19      TOP Sample       Importer approves      ✓ APPROVED

    ════════════════════════════════════════════════════════════
    ALL SAMPLES APPROVED - READY FOR SHIPMENT
```

---

# 7. Production Tracking

**Production Tracking** monitors the manufacturing progress at the factory, from raw materials to finished goods.

## Production Stages

Production goes through these stages:

```
    PRODUCTION STAGES
    ═════════════════

    1. CUTTING
       └── Fabric is cut into pattern pieces

    2. SEWING
       └── Pieces are sewn together

    3. FINISHING
       └── Buttons, labels, final touches

    4. WASHING (if applicable)
       └── Garment wash/treatment

    5. IRONING/PRESSING
       └── Final pressing

    6. QUALITY CHECK
       └── Internal quality inspection

    7. PACKING
       └── Folding, tagging, boxing

    8. READY TO SHIP
       └── Goods ready for dispatch
```

## Recording Production Progress

### Example: Recording Daily Production Update

**Scenario:** Factory has completed cutting for 2,500 units today.

**Step 1:** Access Production Tracking
1. Log in as Factory user
2. Go to the Style → **"Production Tracking"**

**Step 2:** Add Production Update
1. Click **"Add Update"**
2. Fill in details:

| Field | What to Enter | Example |
|-------|---------------|---------|
| Production Stage | Select stage | Cutting |
| Date | Recording date | February 27, 2025 |
| Quantity Produced | Good units | 2,500 |
| Quantity Rejected | Defective units | 45 |
| Quantity Reworked | Fixed units | 30 |
| Notes | Additional info | "Minor fabric defects in 45 pieces" |

**Step 3:** Save
Click **"Save Update"**

### Understanding the Numbers

```
    PRODUCTION QUANTITY CALCULATION
    ═══════════════════════════════

    Quantity Produced:    2,500  (total pieces completed)
    Quantity Rejected:   -   45  (defective, cannot be fixed)
    Quantity Reworked:   +   30  (was defective, now fixed)
                         ──────
    Net Good Quantity:    2,485  (actual usable pieces)

    Acceptance Rate: 2,485 / 2,500 = 99.4%
```

## Production Dashboard View

```
    PRODUCTION TRACKING DASHBOARD
    ══════════════════════════════

    Style: TS-MEN-001          Total Order: 10,000 units
    Factory: ABC Garments      Target Date: March 25, 2025

    ┌────────────────────────────────────────────────────────────┐
    │  STAGE           COMPLETED    TARGET    PROGRESS           │
    ├────────────────────────────────────────────────────────────┤
    │  Cutting         10,000       10,000    ████████████ 100%  │
    │  Sewing           7,500       10,000    █████████░░░  75%  │
    │  Finishing        5,000       10,000    ██████░░░░░░  50%  │
    │  Packing          2,000       10,000    ██░░░░░░░░░░  20%  │
    │  Ready to Ship        0       10,000    ░░░░░░░░░░░░   0%  │
    └────────────────────────────────────────────────────────────┘

    Overall Completion: 45%

    On Track: ⚠️ SLIGHTLY BEHIND (expected 55% by this date)
```

## Production Timeline View

```
    PRODUCTION TIMELINE
    ═══════════════════

    February 2025
    ─────────────

    26 │ ▓▓▓ Cutting Started (2,500 units)
    27 │ ▓▓▓▓▓▓ Cutting (5,000 cumulative)
    28 │ ▓▓▓▓▓▓▓▓▓ Cutting Complete (10,000)
       │     ▓▓▓ Sewing Started (1,500 units)

    March 2025
    ──────────

     1 │     ▓▓▓▓▓▓ Sewing (3,000 cumulative)
     2 │     ▓▓▓▓▓▓▓▓ Sewing (5,000 cumulative)
     3 │         ▓▓▓ Finishing Started
    ...
    25 │             Target: All stages complete
```

---

# 8. Quality Inspection (AQL)

**AQL (Acceptable Quality Level)** is the international standard for quality inspection in manufacturing.

## What is AQL?

AQL defines how many items to inspect from a batch and how many defects are acceptable.

```
    AQL INSPECTION CONCEPT
    ══════════════════════

    Instead of checking ALL 10,000 units (impossible!),
    we check a SAMPLE based on statistical standards.

    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │   TOTAL LOT: 10,000 units                                   │
    │                                                             │
    │   ┌─────────────────────────────────────────────────────┐   │
    │   │ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ │   │
    │   │ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ │   │
    │   │ ○ ○ ○ ○ ● ○ ○ ○ ○ ● ○ ○ ○ ○ ○ ○ ● ○ ○ ○ ○ ○ ● ○ ○ │   │
    │   │ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ │   │
    │   └─────────────────────────────────────────────────────┘   │
    │                          │                                  │
    │                          ▼                                  │
    │                   SAMPLE: 315 units                         │
    │                   (randomly selected)                       │
    │                                                             │
    │   ● = Selected for inspection                               │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

## AQL Levels Explained

| AQL Level | Meaning | Used For |
|-----------|---------|----------|
| **0.65** | Very strict | Critical defects (safety issues) |
| **1.0** | Strict | High-end products |
| **1.5** | Standard | General products |
| **2.5** | Normal | Most common level |
| **4.0** | Relaxed | Lower-cost items |

## Defect Categories

```
    DEFECT SEVERITY LEVELS
    ══════════════════════

    ┌─────────────────────────────────────────────────────────────┐
    │  CRITICAL DEFECTS                                           │
    │  ─────────────────                                          │
    │  • Safety hazards (sharp edges, loose parts)                │
    │  • Regulatory violations                                    │
    │  • Product will definitely be returned                      │
    │                                                             │
    │  Tolerance: Usually 0 (any critical = FAIL)                 │
    └─────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │  MAJOR DEFECTS                                              │
    │  ─────────────                                              │
    │  • Affects function or appearance significantly             │
    │  • Wrong size, wrong color                                  │
    │  • Large stains, holes                                      │
    │  • Missing components                                       │
    │                                                             │
    │  Tolerance: Low (usually AQL 2.5)                           │
    └─────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │  MINOR DEFECTS                                              │
    │  ─────────────                                              │
    │  • Slight variations                                        │
    │  • Small marks that can be cleaned                          │
    │  • Slight uneven stitching (not noticeable)                 │
    │                                                             │
    │  Tolerance: Higher (usually AQL 4.0)                        │
    └─────────────────────────────────────────────────────────────┘
```

## Conducting an Inspection (Complete Example)

### Scenario
Inspect 10,000 T-shirts before shipment using AQL 2.5 for major defects.

### Step 1: Create Inspection Record

1. Go to the Style → **"Quality Inspections"**
2. Click **"New Inspection"**

### Step 2: System Calculates AQL Parameters

You enter:
- **Lot Size:** 10,000
- **AQL Level:** 2.5 (General Inspection Level II)

System calculates:
```
    AQL CALCULATION RESULT
    ══════════════════════

    Lot Size:      10,000 units
    AQL Level:     2.5

    ──────────────────────────────

    Sample Size:   315 units (must inspect this many)
    Accept Point:  14 (if defects ≤ 14, PASS)
    Reject Point:  15 (if defects ≥ 15, FAIL)
```

### Step 3: Conduct Physical Inspection

Inspector randomly selects 315 units and checks each one:

```
    INSPECTION CHECKLIST
    ════════════════════

    For each unit, check:

    [ ] Correct size label
    [ ] Color matches approved sample
    [ ] No holes or tears
    [ ] Stitching quality
    [ ] Print quality (if applicable)
    [ ] Buttons/zippers work
    [ ] No stains
    [ ] Correct packaging
```

### Step 4: Record Defects Found

| Defect Type | Category | Count |
|-------------|----------|-------|
| Loose thread | Minor | 8 |
| Small stain | Minor | 3 |
| Uneven stitching | Major | 5 |
| Wrong size label | Major | 2 |
| Hole in fabric | Major | 1 |
| **Total Defects** | | **19** |
| **Major Defects** | | **8** |

### Step 5: Determine Result

```
    INSPECTION RESULT
    ═════════════════

    Major Defects Found:  8
    Accept Point:         14
    Reject Point:         15

    8 < 14  →  PASSED ✓

    Result: LOT APPROVED FOR SHIPMENT
```

If major defects were 15 or more → **FAILED** → Factory must sort/rework.

### Step 6: Generate Certificate

After completing inspection:
1. Click **"Complete Inspection"**
2. System generates **Inspection Certificate** with:
   - Certificate number
   - Inspection date
   - Results summary
   - Inspector name
   - Pass/Fail status

---

## AQL Reference Table

```
    COMMON AQL SAMPLE SIZES
    ═══════════════════════

    Lot Size          Sample    Accept    Reject
    (units)           Size      Point     Point
    ─────────────────────────────────────────────
    2 - 8               2         0         1
    9 - 15              3         0         1
    16 - 25             5         0         1
    26 - 50             8         0         1
    51 - 90            13         1         2
    91 - 150           20         1         2
    151 - 280          32         2         3
    281 - 500          50         3         4
    501 - 1,200        80         5         6
    1,201 - 3,200     125         7         8
    3,201 - 10,000    200        10        11
    10,001 - 35,000   315        14        15
    35,001 - 150,000  500        21        22
    ─────────────────────────────────────────────

    (Based on AQL 2.5, General Inspection Level II)
```

---

# 9. Shipment Tracking

**Shipment Tracking** monitors goods from the factory to your warehouse.

## Shipment Information

```
    SHIPMENT RECORD
    ═══════════════

    ┌─────────────────────────────────────────────────────────────┐
    │  Shipment Ref: SHP-2025-001                                 │
    │  PO: PO-2025-001                                            │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  CARRIER INFO                    VESSEL INFO                │
    │  ────────────                    ───────────                │
    │  Carrier: Maersk                 Vessel: MSC Aurora         │
    │  Method: Sea Freight             Container: MSKU1234567     │
    │  Tracking #: MAEU123456789                                  │
    │                                                             │
    │  KEY DATES                                                  │
    │  ─────────                                                  │
    │  ETD (Departure): March 28, 2025                            │
    │  ETA (Arrival): April 20, 2025                              │
    │  In Warehouse: April 25, 2025                               │
    │                                                             │
    │  CARGO                                                      │
    │  ─────                                                      │
    │  Total Cartons: 250                                         │
    │  Total Units: 10,000                                        │
    │  Weight: 2,500 kg                                           │
    │  Volume: 15 CBM                                             │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

## Shipment Statuses

```
    SHIPMENT STATUS FLOW
    ════════════════════

    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │ PREPARING │───▶│DISPATCHED │───▶│IN TRANSIT │
    └───────────┘    └───────────┘    └───────────┘
    Goods being       Left the         On the way
    packed at         factory          (sea/air)
    factory
                                            │
                                            ▼
                     ┌───────────┐    ┌───────────┐
                     │ DELIVERED │◀───│  CUSTOMS  │
                     └───────────┘    └───────────┘
                     Received at       Clearing
                     warehouse         customs
```

## Creating a Shipment (Complete Example)

### Step 1: Create Shipment Record

1. Go to the PO → **"Shipments"** tab
2. Click **"Create Shipment"**

### Step 2: Enter Shipment Details

**Basic Information:**

| Field | What to Enter | Example |
|-------|---------------|---------|
| Shipment Reference | Your tracking code | SHP-2025-001 |
| Carrier Name | Shipping company | Maersk |
| Shipment Method | Sea/Air/Road/Courier | Sea Freight |
| Tracking Number | Carrier's tracking # | MAEU123456789 |

**Vessel Information (for sea freight):**

| Field | What to Enter | Example |
|-------|---------------|---------|
| Vessel Name | Ship name | MSC Aurora |
| Container Number | Container ID | MSKU1234567 |
| Bill of Lading | B/L number | MAEU-BL-12345 |

**Dates:**

| Field | What to Enter | Example |
|-------|---------------|---------|
| Estimated Dispatch | When leaving factory | March 28, 2025 |
| Estimated Arrival | When reaching port | April 20, 2025 |
| Estimated Delivery | When at warehouse | April 25, 2025 |

### Step 3: Add Items to Shipment

Select which styles/quantities are in this shipment:

| Style | Cartons | Units |
|-------|---------|-------|
| TS-MEN-001 | 250 | 10,000 |
| **Total** | **250** | **10,000** |

### Step 4: Save Shipment

Click **"Create Shipment"**

---

## Updating Shipment Status

As the shipment progresses, update its status:

### Example Timeline:

```
    SHIPMENT UPDATES
    ════════════════

    DATE          STATUS        UPDATE
    ────          ──────        ──────
    Mar 28        DISPATCHED    "Goods left factory, loaded on truck"
                               Actual Dispatch: Mar 28, 2025

    Mar 29        DISPATCHED    "Arrived at Ho Chi Minh port"

    Mar 30        IN TRANSIT    "Loaded on vessel MSC Aurora"
                               Vessel departed

    Apr 10        IN TRANSIT    "Vessel passed Singapore"

    Apr 20        IN TRANSIT    "Arrived Long Beach port"
                               Actual Arrival: Apr 20, 2025

    Apr 21        CUSTOMS       "Customs clearance in progress"

    Apr 23        CUSTOMS       "Customs cleared"

    Apr 25        DELIVERED     "Received at LA Warehouse"
                               Actual Delivery: Apr 25, 2025
```

## Public Tracking Link

Each shipment has a **public tracking token** that you can share with customers:

```
    PUBLIC TRACKING
    ═══════════════

    Share this link with your customer:

    https://yourplatform.com/track/abc123xyz789

    ┌─────────────────────────────────────────────────────────────┐
    │                    SHIPMENT TRACKING                        │
    │                                                             │
    │  Reference: SHP-2025-001                                    │
    │  Status: IN TRANSIT                                         │
    │                                                             │
    │  ○ Dispatched    ● In Transit    ○ Customs    ○ Delivered   │
    │  Mar 28          Apr 10          ---          ---           │
    │                                                             │
    │  Expected Delivery: April 25, 2025                          │
    │                                                             │
    │  Latest Update: April 10, 2025                              │
    │  "Vessel passed Singapore, on schedule"                     │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘

    No login required - anyone with the link can view status
```

---

# 10. Complete Workflow Diagram

Here's the **complete end-to-end workflow** of a purchase order:

```
═══════════════════════════════════════════════════════════════════════════════
                         COMPLETE WORKFLOW OVERVIEW
═══════════════════════════════════════════════════════════════════════════════

PHASE 1: ORDER CREATION (Day 1-2)
─────────────────────────────────

    ┌─────────────┐
    │  Retailer   │
    │ Places Order│
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐         ┌─────────────┐
    │  Create PO  │────────▶│ Add Styles  │
    │  (PO-2025-  │         │ (Products)  │
    │    001)     │         └──────┬──────┘
    └─────────────┘                │
           │                       ▼
           │              ┌─────────────┐
           │              │   Assign    │
           │              │   Factory   │
           │              └──────┬──────┘
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
              System generates:
              • Sample Schedule (8 milestones)
              • Date Calculations (ETA, In-Warehouse)


PHASE 2: SAMPLE APPROVAL (Day 3-45)
───────────────────────────────────

    Factory                                      Importer
    ───────                                      ────────
       │                                            │
       │  1. Lab Dip (Color)                        │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓
       │                                            │
       │  2. Fit Sample (Size)                      │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓
       │                                            │
       │  3. Trim Approval                          │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓
       │                                            │
       │  4. 1st Proto                              │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓
       │                                            │
       │  5. Bulk Fabric Confirmation               │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓
       │                                            │
       │  6. PP Sample                              │
       │  ──────────────────────────────────────▶   │
       │                                    ◀──────│ Approve ✓


PHASE 3: PRODUCTION (Day 45-70)
───────────────────────────────

    ┌─────────────────────────────────────────────────────────────┐
    │                    FACTORY PRODUCTION                       │
    │                                                             │
    │  Cutting ──▶ Sewing ──▶ Finishing ──▶ Packing ──▶ Ready    │
    │    100%       100%        100%         100%        100%     │
    │                                                             │
    │  Daily updates reported to platform                         │
    └─────────────────────────────────────────────────────────────┘
           │
           │  7. Production Start Confirmation
           │  8. TOP Sample (during production)
           │
           ▼

PHASE 4: QUALITY INSPECTION (Day 68-70)
───────────────────────────────────────

    ┌─────────────────────────────────────────────────────────────┐
    │                   AQL INSPECTION                            │
    │                                                             │
    │    Lot: 10,000    Sample: 315    Result: PASS              │
    │                                                             │
    │    Critical: 0    Major: 8    Minor: 11                    │
    │                                                             │
    │    Certificate Generated ✓                                  │
    └─────────────────────────────────────────────────────────────┘
           │
           ▼

PHASE 5: SHIPMENT (Day 70-95)
─────────────────────────────

    Factory          Port           Sea            Port         Warehouse
    (Vietnam)     (Ho Chi Minh)   (Transit)    (Long Beach)   (Los Angeles)
       │              │              │              │              │
       │──Loading────▶│              │              │              │
       │              │──Departure──▶│              │              │
       │              │              │──Sailing────▶│              │
       │              │              │   23 days    │──Customs────▶│
       │              │              │              │              │──Received!
       │              │              │              │              │
    Day 70         Day 72         Day 73        Day 95        Day 99

    Status: PREPARING ▶ DISPATCHED ▶ IN TRANSIT ▶ CUSTOMS ▶ DELIVERED


PHASE 6: COMPLETION
───────────────────

    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │  ✓ PO-2025-001 COMPLETED                                    │
    │                                                             │
    │  • 10,000 units delivered                                   │
    │  • All samples approved                                     │
    │  • Quality inspection passed                                │
    │  • Delivered on time                                        │
    │                                                             │
    │  Total Time: 84 days (Order to Delivery)                    │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
```

---

## Timeline Summary (Typical 90-Day Cycle)

```
    90-DAY ORDER TIMELINE
    ═════════════════════

    WEEK    DAYS     ACTIVITY
    ────    ────     ────────
     1      1-7      PO Creation, Factory Assignment
     2-3    8-21     Lab Dip, Fit Sample, Trim Approvals
     4-5    22-35    1st Proto, Bulk Fabric
     6      36-42    PP Sample Approval
     7-10   43-70    Production (Cutting → Packing)
     10     68-70    Quality Inspection
     11     71-77    Loading & Dispatch
     12-14  78-98    Sea Transit
     14     95-98    Customs Clearance
     14     99       Warehouse Delivery

    ────────────────────────────────────────────────────

    Days 1-7:    ████░░░░░░░░░░░░░░░░░░░░░░░░░░ Order
    Days 8-42:   ░░░░████████████░░░░░░░░░░░░░░ Samples
    Days 43-70:  ░░░░░░░░░░░░░░░░█████████░░░░░ Production
    Days 71-99:  ░░░░░░░░░░░░░░░░░░░░░░░░░█████ Shipping
```

---

# 11. User Roles & Permissions

## System Roles

| Role | Description | Typical Users |
|------|-------------|---------------|
| **Admin** | Full system access | IT Manager, System Owner |
| **Importer** | Manages POs, approves samples | Brand Owner, Merchandiser |
| **Factory** | Updates production, submits samples | Factory Staff |
| **Quality Inspector** | Conducts inspections | QC Team |
| **Agent** | Views assigned orders | Sales Agent |
| **Viewer** | Read-only access | External Stakeholders |

## Permission Matrix

```
    PERMISSION MATRIX
    ═════════════════

    Feature              Admin   Importer   Factory   Inspector   Agent
    ───────              ─────   ────────   ───────   ─────────   ─────
    Create PO              ✓        ✓          ✗          ✗         ✗
    View PO                ✓        ✓          ✓*         ✓*        ✓*
    Edit PO                ✓        ✓          ✗          ✗         ✗
    Delete PO              ✓        ✗          ✗          ✗         ✗

    Create Style           ✓        ✓          ✗          ✗         ✗
    View Style             ✓        ✓          ✓*         ✓*        ✓*

    Submit Sample          ✓        ✗          ✓          ✗         ✗
    Approve Sample         ✓        ✓          ✗          ✗         ✗

    Update Production      ✓        ✗          ✓          ✗         ✗
    View Production        ✓        ✓          ✓          ✓         ✓

    Create Inspection      ✓        ✓          ✗          ✓         ✗
    View Inspection        ✓        ✓          ✓          ✓         ✓

    Manage Shipment        ✓        ✓          ✗          ✗         ✗
    View Shipment          ✓        ✓          ✓          ✓         ✓

    Manage Users           ✓        ✗          ✗          ✗         ✗
    Manage Settings        ✓        ✗          ✗          ✗         ✗
    View Reports           ✓        ✓          ✗          ✗         ✓

    * = Only assigned/related items
```

---

# 12. Glossary

| Term | Definition |
|------|------------|
| **AQL** | Acceptable Quality Level - international standard for quality inspection |
| **B/L** | Bill of Lading - shipping document proving goods ownership |
| **CBM** | Cubic Meter - volume measurement for shipping |
| **DDP** | Delivered Duty Paid - seller pays all costs including duties |
| **ETA** | Estimated Time of Arrival |
| **ETD** | Estimated Time of Departure |
| **Ex-Factory** | Date when goods leave the factory |
| **FOB** | Free On Board - buyer pays shipping from port |
| **GSM** | Grams per Square Meter - fabric weight measurement |
| **Lab Dip** | Color sample to match approved shade |
| **Lot** | A batch of products for inspection |
| **MSRP** | Manufacturer's Suggested Retail Price |
| **PO** | Purchase Order |
| **PP Sample** | Pre-Production Sample - final sample before mass production |
| **Proto** | Prototype - early sample of the design |
| **QC** | Quality Control |
| **Style** | A specific product design with defined specifications |
| **TNA** | Time and Action - production timeline chart |
| **TOP** | Top of Production - sample taken during production |
| **Trim** | Accessories like buttons, zippers, labels |

---

# Quick Reference Cards

## Creating a PO - Quick Steps

```
1. Go to Purchase Orders → Create New
2. Enter: Retailer, Brand, Season
3. Enter: Ex-Factory Date, ETD
4. Set: Currency, Payment Terms, Shipping Term
5. Save PO
6. Add Styles (create new or add existing)
7. Assign Factory
8. Confirm PO
```

## Sample Approval - Quick Steps

```
FACTORY:
1. Go to assigned Style → Samples
2. Submit sample with reference
3. Approve (factory internal)

IMPORTER:
1. Go to Samples → Pending
2. Review sample
3. Approve or Reject with comments
```

## Quality Inspection - Quick Steps

```
1. Go to Style → Quality Inspections
2. Create new inspection
3. Enter lot size, select AQL level
4. System calculates sample size
5. Conduct physical inspection
6. Record defects found
7. Complete inspection
8. Generate certificate
```

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Platform:** Garment Supply Chain Management System

---

*This documentation is intended for business users. For technical documentation, please refer to the developer guides.*
