/**
 * Normal function version (no Edge Function / no Deno.serve).
 * This helper performs a GET to the SAP endpoint and returns normalized rows.
 */

export const SAP_INVENTORY_ENDPOINT = "http://172.16.10.31/api/vwStockDestiny";

interface SapEndpointItem {
  fecha?: string | null;
  claveProducto?: string | null;
  nombreProducto?: string | null;
  totalUnits?: number | null;
  cantidad?: number | null;
  uom?: string | null;
  unidad?: string | null;
  pesoBruto?: number | null;
  pesoNeto?: number | null;
  lote?: string | null;
  po?: string | null;
  cajas?: number | null;
  asignadoAentrega?: boolean | null;
}

export interface NormalizedSapInventoryItem {
  pt_code: string;
  description: string;
  stock: number;
  unit: string;
  gross_weight: number | null;
  net_weight: number | null;
  traceability: string;
  bfx_order: string | null;
  pieces: number | null;
  pallet_type: "CASES";
  status: "available" | "assigned";
  fecha: string;
  raw_data: unknown;
  synced_at: string;
}

export async function getSapInventory(endpoint = SAP_INVENTORY_ENDPOINT) {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`SAP API unavailable (status: ${response.status})`);
  }

  const payload = (await response.json()) as SapEndpointItem[];
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected SAP response format");
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  // NOTE: When fecha is not provided by SAP, the caller should
  // supply existing fecha values to preserve historical dates.
  const rows: NormalizedSapInventoryItem[] = payload.map((item) => {
    let fechaFormatted = today;
    if (item.fecha) {
      const d = new Date(item.fecha);
      if (!Number.isNaN(d.getTime())) {
        fechaFormatted = d.toISOString().split("T")[0];
      }
    }

    return {
      pt_code: item.claveProducto || "",
      description: item.nombreProducto || "",
      stock: item.totalUnits ?? item.cantidad ?? 0,
      unit: item.uom || item.unidad || "MIL",
      gross_weight: item.pesoBruto ?? null,
      net_weight: item.pesoNeto ?? null,
      traceability: item.lote || "",
      bfx_order: item.po || null,
      pieces: item.cajas ?? null,
      pallet_type: "CASES",
      status: item.asignadoAentrega === true ? "assigned" : "available",
      fecha: fechaFormatted,
      raw_data: item,
      synced_at: now,
    };
  });

  return {
    success: true,
    count: rows.length,
    synced_at: now,
    rows,
  };
}

