

## Problem

The "Date" column in the Stock Verification tables on OrderDetail always shows "—" because:

1. The code tries to fetch `fecha` from the SAP endpoint (`http://172.16.10.31/api/vwStockDestiny`) directly, but this is a private network IP that's unreachable from the hosted preview.
2. The `detallesAlmacen` objects from the order endpoint (`CatOrden/open-with-orden`) don't include `fecha`.
3. Since both sources fail, the date is always null.

The Inventory page works correctly because it reads from the `sap_inventory` table in the database (which was synced from SAP and contains the `fecha` field).

## Solution

Replace the direct SAP inventory endpoint fetch with a query to the `sap_inventory` database table, matching by `traceability` (which equals the `lote` field in `detallesAlmacen`).

### Changes in `src/pages/OrderDetail.tsx`:

1. **Remove** the `fetch(SAP_INVENTORY_ENDPOINT, ...)` call and the `SAP_INVENTORY_ENDPOINT` constant.
2. **Add** a Supabase query to `sap_inventory` table to get `traceability` and `fecha` for all records.
3. **Build** the `fechaByLote` map using `traceability` as the key (it corresponds to `lote` in `detallesAlmacen`).
4. The rest of the `enrichWithFecha` logic stays the same.

```typescript
// Instead of:
// fetch("http://172.16.10.31/api/vwStockDestiny", ...)

// Use:
const { data: sapInvData } = await supabase
  .from('sap_inventory')
  .select('traceability, fecha');

let fechaByLote: Record<string, string> = {};
if (sapInvData) {
  for (const item of sapInvData) {
    if (item.traceability && item.fecha && !fechaByLote[item.traceability]) {
      fechaByLote[item.traceability] = item.fecha;
    }
  }
}
```

This ensures dates are always available since the database is accessible from anywhere, unlike the private SAP endpoint.

