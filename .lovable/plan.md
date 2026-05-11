## Cambios en Billing Validation

El sistema de facturación solo permite facturar el item una sola vez. Hay que ajustar la lógica de agrupación de productos en `buildFromReleasedPallets` (en `src/components/shipping/CustomsReviewDialog.tsx`) y agregar totales globales al final del PDF de aduana.

### Escenario 1 — Mismo producto a varios destinos

Hoy agrupamos por `descripción + destino`, así que un mismo producto que va a 2 destinos genera 2 renglones (cada uno con su valor aduanal).

Cambio: agrupar **solo por producto** (`pt_code`, fallback a `description`), sumando pesos brutos y netos de TODAS las tarimas sin importar el destino. El campo `destination` del renglón mostrará los destinos involucrados concatenados (ej. `"DEST_A, DEST_B"`). El desglose de tarimas en el PDF seguirá listando cada tarima individualmente.

### Escenario 2 — Mismo producto en varias POs en el mismo camión

Al unificar por producto, las tarimas que vengan de POs distintas con el mismo `pt_code` quedarán en un solo renglón. El precio por millar a usar será el **menor** `price_per_thousand` entre todas las POs involucradas. Los campos `poNumber` y `salesOrder` mostrarán las POs/SOs combinadas.

Cálculo derivado (sin cambios):
- `totalPrice = (totalUnits / 1000) * pricePerThousand` (precio mínimo)
- `ce = totalPrice / totalNetWeight`
- `ceTruncated = floor(ce * 100) / 100`
- `customsValue = ceTruncated * totalNetWeight`

### Total de cajas / bobinas al final del PDF

En el bloque "RESUMEN DE CARGA" de `generateCustomsPDF.ts`, agregar dos renglones nuevos:
- **Total Cajas**: suma de `boxes` de todas las tarimas cuyo producto tenga `unit !== "MIL"` (cajas).
- **Total Bobinas**: suma de tarimas (cuenta) cuyo producto tenga `unit === "MIL"` (rollos / bobinas).

Solo mostrar el renglón si su total es > 0, para que cargas mixtas o de un solo tipo se vean limpias.

### Truck layout (sin cambios funcionales)

`palletsByDestination` y el orden de destinos siguen calculándose desde `load_pallets` directamente, no desde el agrupado de facturación, así el diagrama del checklist no se ve afectado.

### Archivos a modificar

- **`src/components/shipping/CustomsReviewDialog.tsx`**
  - `buildFromReleasedPallets`: cambiar key de agrupación a solo `pt_code` (fallback `description`).
  - Recolectar todas las POs por producto y elegir la de menor `price_per_thousand`.
  - Concatenar destinos únicos, PO numbers y sales orders en el resumen.
  - Calcular `palletsByDestination` directamente desde las tarimas crudas.
- **`src/utils/generateCustomsPDF.ts`**
  - Agregar `Total Cajas` y `Total Bobinas` al RESUMEN DE CARGA (condicional > 0).
  - Ajustar encabezado de producto para mostrar múltiples destinos / POs cuando aplique.
- **`src/utils/generateLoadChecklist.ts`**
  - Mismo ajuste de encabezado para mostrar destinos / POs concatenados.

### Pseudocódigo clave

```ts
// Agrupar por producto
const key = lp.pallet.pt_code || lp.pallet.description;

// PO con precio más bajo por producto
const lowestPrice = Math.min(...pos.map(p => p.price).filter(p => p > 0));
group.pricePerThousand = lowestPrice;
group.poNumber  = [...new Set(pos.map(p => p.po))].join(", ");
group.salesOrder = [...new Set(pos.map(p => p.so).filter(Boolean))].join(", ");
group.destination = [...new Set(palletsOfProduct.map(p => p.destination))].join(", ");

// Totales en PDF
const totalCajas   = products
  .filter(p => p.unit !== "MIL")
  .reduce((s, p) => s + (p.palletDetails?.reduce((a, d) => a + (d.boxes || 0), 0) || 0), 0);
const totalBobinas = products
  .filter(p => p.unit === "MIL")
  .reduce((s, p) => s + p.totalPallets, 0); // 1 bobina por tarima
```
