
## What we're building

When a load has multiple destinations, the user needs to:
1. See the list of unique destinations in the Billing Validation dialog
2. Drag/reorder them to set the delivery order (first destination = unloaded first = pallets near truck doors)
3. See a visual truck layout in the dialog showing pallet positions color-coded by destination
4. Get that same truck layout printed in the Floor Checklist PDF

### Truck layout spec
- 30 max positions: 2 columns x 15 rows
- Row 1 (bottom of diagram) = closest to doors (rear of truck)
- First delivery destination fills from the doors inward
- Each destination gets a distinct color

---

## Technical plan

### 1. Destination Order UI in CustomsReviewDialog

**File: `src/components/shipping/CustomsReviewDialog.tsx`**

- Extract unique destinations from loaded products
- Add state: `destinationOrder: string[]` — ordered list of destination codes (index 0 = first delivery = near doors)
- Add a new section before the product cards: "Orden de Destinos" with a sortable list (drag-and-drop using simple up/down buttons to keep it lightweight)
- Assign a color palette (up to 5-6 colors) mapped by destination order index
- Show a mini truck layout grid (2 cols x 15 rows) below the destination list, filling positions from the bottom (doors) upward per destination order, using the actual pallet count per destination
- Persist `destinationOrder` inside `validated_data` alongside `products`, `freightCost`, `exchangeRate`

### 2. Truck Layout Component

**New file: `src/components/shipping/TruckLayoutPreview.tsx`**

- Props: `destinationOrder: string[]`, `palletsByDestination: Record<string, number>`, `colorMap: Record<string, string>`
- Renders a 2x15 grid (max 30 slots), fills from bottom with pallets grouped by destination in order
- Color-coded cells with destination labels, empty slots shown as gray
- Labels: "COMPUERTAS" at the bottom, "FRENTE" at the top

### 3. Floor Checklist PDF — Truck Layout Diagram

**File: `src/utils/generateLoadChecklist.ts`**

- Accept new parameter: `destinationOrder: string[]`
- After the header and before product sections, draw a truck layout diagram:
  - Rectangle representing the truck (2 columns x 15 rows of pallet slots)
  - Fill from bottom (doors) according to destination order
  - Color-coded rectangles with destination abbreviation text
  - Legend showing color-to-destination mapping
  - Labels: "COMPUERTAS (Puertas)" at bottom, "FRENTE DEL CAMION" at top

### 4. Wire up the data flow

**File: `src/components/shipping/BillingValidationCard.tsx`**

- When generating the Floor Checklist, extract `destinationOrder` from `validated_data` and pass it to `generateLoadChecklist`
- Fallback: if no order saved, use destinations in the order they appear in products

### Files changed
- `src/components/shipping/CustomsReviewDialog.tsx` — destination ordering UI + mini truck preview + persist order
- `src/components/shipping/TruckLayoutPreview.tsx` — new reusable truck layout component
- `src/utils/generateLoadChecklist.ts` — add truck diagram to PDF
- `src/components/shipping/BillingValidationCard.tsx` — pass destination order to checklist generator
