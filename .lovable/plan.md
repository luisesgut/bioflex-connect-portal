

## Plan: Auto-recalculate Roll Diameter & Weight on structure/core changes

### Problem
Currently, `computeRollUpdates` only runs when **Impressions per Roll** or **Meters per Roll** are typed. Changing the structure layers (adding/removing/modifying) or changing the core size does **not** trigger recalculation.

### Solution
Add a `useEffect` in `RFQItemForm.tsx` that watches `data.structure_layers`, `data.core_size_inches`, `data.width`, `measureUnit`, and `materialDensityMap`. When any of these change **and** `meters_per_roll` already has a value, it re-runs `computeRollUpdates` and calls `update()` with the new diameter and weight.

### Changes

**`src/components/rfq/RFQItemForm.tsx`** — Add one `useEffect` (after the `computeRollUpdates` definition, ~line 375):

```tsx
// Auto-recalculate roll dimensions when structure, core, or width changes
useEffect(() => {
  if (!isFilm) return;
  const meters = Number(data.meters_per_roll);
  if (!meters || meters <= 0) return;

  const rollUpdates = computeRollUpdates(meters, data);
  if (
    rollUpdates.diameter_per_roll !== data.diameter_per_roll ||
    rollUpdates.weight_kg_per_roll !== data.weight_kg_per_roll
  ) {
    onChange({ ...data, ...rollUpdates });
  }
}, [
  data.structure_layers,
  data.core_size_inches,
  data.width,
  measureUnit,
  materialDensityMap,
]);
```

This ensures any change to layers, core size, width, or unit system immediately recalculates diameter and weight — making the formula truly "live."

