

## POTR Update: Add Missing SAP POs

### What changes
When a POTR Excel is uploaded, the system will fetch ALL open POs from `sap_orders` and identify which ones are NOT already in the Excel file. These "missing" POs will be appended as new rows at the bottom of both the preview table and the downloaded Excel.

POs without an assigned Sales Order (`pedido`) will be sorted to the very bottom.

### How it works

1. **After parsing the Excel POs**, fetch all `sap_orders` (all rows, not filtered by PO list)
2. **Filter out** POs that already exist in the Excel
3. **For each missing SAP PO**, create a new entry with:
   - `poNumber` = `po_number`
   - `itemCode` = `pt_code`
   - `description` = `producto`
   - `newShipped` = `cantidad_enviada`
   - `salesOrder` = `pedido`
   - `pricePerThousand` = `precio`
   - `dueDate` = `fecha_vencimiento` (the "PO Date Due")
   - On Floor / Other Stock: calculated same as existing rows using inventory pallets
   - Mark these with a new flag `isFromSAP: true` and `rowIndex: -1` (not in Excel)
4. **Sort missing POs**: those with a Sales Order first, unassigned (`pedido` is null) at the bottom
5. **Append to matches array** after the Excel-based rows

### Preview table updates
- Add a **"PO Date Due"** column
- Add a new badge state: "Solo SAP" (for rows only in SAP, not in Excel) — shown in a distinct color
- Add a badge count for "nuevas de SAP"
- Rows from SAP-only will have a highlighted background

### Excel download updates
- Append the missing SAP rows after the last data row in the Excel
- Fill all columns: DP, Item#, Description, Shipped, On Floor, Sales Order, Other Stock, Price, and add PO Date Due
- Unassigned Sales Orders go at the bottom

### Technical details

**File**: `src/pages/POTRUpdate.tsx`

- Extend `POTRMatch` interface: add `isFromSAP: boolean`, `dueDate: string | null`
- Change the SAP query from `.in("po_number", poNumbers)` to fetching ALL sap_orders (no filter), then split into "in Excel" vs "not in Excel"
- For inventory lookups, collect ptCodes from ALL SAP orders (not just Excel ones)
- Sort: Excel rows first (original order), then SAP-only rows sorted by `pedido` (assigned first, null last)
- In `handleDownload`: after writing matched Excel rows, append new rows for SAP-only POs with a "PO Date Due" column

