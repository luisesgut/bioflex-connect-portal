

# Auto-fill POTR Excel: Shipped & On Floor Quantities

## What This Does
When you upload the POTR Excel file, the system will automatically fill in two columns:
- **Quantity Already Shipped** — from SAP order data (`cantidad_enviada`)
- **Quantity On Floor At BioFlex** — from current inventory pallets (available stock by product)

The system matches each row using the **DP PO#** column in the Excel to look up the corresponding data in the database.

## User Flow
1. New page or section accessible from the sidebar: **"POTR Update"**
2. Upload the POTR Excel file (.xlsx)
3. System parses the file, identifies PO numbers from the "DP" column
4. Queries the database for shipped quantities and floor inventory
5. Shows a preview table with the values that will be filled in
6. Download the updated Excel with the two columns auto-populated

## Data Sources
- **Quantity Already Shipped**: `sap_orders.cantidad_enviada` matched by `po_number`
- **Quantity On Floor At BioFlex**: `inventory_pallets` grouped by `pt_code` (sum of `stock` where status = available), linked through `sap_orders.pt_code`

## Matching Logic
1. Parse Excel → find header row with "Item #", "DP", etc.
2. For each data row, extract the DP PO number
3. Query `sap_orders` for all matching PO numbers → get `cantidad_enviada` (shipped) and `pt_code`
4. Query `inventory_pallets` grouped by `pt_code` → get available stock (on floor)
5. Write values back into the correct Excel columns

## Technical Plan

### New file: `src/pages/POTRUpdate.tsx`
- File upload input accepting `.xlsx`
- Parse with `xlsx` library (already in project)
- Find header row and column indices for "DP", "Already Shipped", "On Floor At BioFlex"
- Fetch `sap_orders` (po_number, cantidad_enviada, pt_code) and `inventory_pallets` (pt_code, sum of stock)
- Display preview table showing PO#, Item#, current values vs new values
- "Download Updated POTR" button that writes values back into the original Excel and triggers download

### Update: `src/App.tsx`
- Add route `/potr-update`

### Update: `src/components/layout/Sidebar.tsx`
- Add sidebar link for POTR Update (admin only)

### Key Details
- Uses existing `xlsx` library for read/write
- No database changes needed — read-only queries
- Column matching is flexible (searches for "Already Shipped" and "On Floor" in header text)
- Preserves all existing Excel formatting and data; only overwrites the two target columns
- Preview shows matched vs unmatched rows before download

