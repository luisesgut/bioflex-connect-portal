

## Plan: Remove Pallet Size & Auto-calculate Rolls/Layer

### Changes in `src/components/rfq/RFQItemForm.tsx`

1. **Remove Pallet Size field** (lines 1200-1210) — all pallets are 1×1.2m, no need for a selector.

2. **Add `useEffect` to auto-calculate `rolls_per_floor`** when `diameter_per_roll` changes (Film only). Rolls lie flat on a 1000×1200mm pallet:
   - `rolls_per_row = floor(1200 / diameter_mm)`
   - `rows = floor(1000 / diameter_mm)`  
   - `rolls_per_floor = rolls_per_row × rows`
   - Auto-fills the field but keeps it editable for manual override.

3. **Make the Rolls/Layer field show it's auto-calculated** — add a subtle hint or muted background when auto-filled.

### Changes in `src/pages/CreateRFQ.tsx`

- Hardcode `pallet_dimensions: "1 x 1.2 mts"` in the submit payload so the DB always gets the standard value.

### Auto-calc logic
```text
Pallet: 1000mm × 1200mm
Roll diameter: D mm (from diameter_per_roll)
Rolls/layer = floor(1200/D) × floor(1000/D)
```

