import { supabase } from "@/integrations/supabase/client";

const SAP_ENDPOINT = "http://172.16.10.31/api/vwStockDestiny";
const SAP_TIMEOUT_MS = 30000;
const INSERT_BATCH_SIZE = 500;

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

type SapInventoryInsertRow = {
  pt_code: string;
  description: string;
  stock: number;
  unit: string;
  gross_weight: number | null;
  net_weight: number | null;
  traceability: string;
  bfx_order: string | null;
  pieces: number | null;
  pallet_type: string;
  status: string;
  fecha: string;
  raw_data: unknown;
  synced_at: string;
};

export async function syncSapInventoryFromEndpoint() {
  const sapResponse = await fetch(SAP_ENDPOINT, {
    signal: AbortSignal.timeout(SAP_TIMEOUT_MS),
  });

  if (!sapResponse.ok) {
    throw new Error(`SAP API unavailable (status: ${sapResponse.status})`);
  }

  const sapData = (await sapResponse.json()) as SapEndpointItem[];
  if (!Array.isArray(sapData)) {
    throw new Error("Unexpected SAP response format");
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  const transformedData: SapInventoryInsertRow[] = sapData.map((item) => {
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

  let insertedCount = 0;

  for (let i = 0; i < transformedData.length; i += INSERT_BATCH_SIZE) {
    const batch = transformedData.slice(i, i + INSERT_BATCH_SIZE);
    const { error: insertError } = await supabase.from("sap_inventory").insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert inventory: ${insertError.message}`);
    }
    insertedCount += batch.length;
  }

  // Replace snapshot only after a successful full insert to avoid empty-table windows.
  const { error: cleanupError } = await supabase
    .from("sap_inventory")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .neq("synced_at", now);

  if (cleanupError) {
    throw new Error(`Failed to cleanup previous snapshot: ${cleanupError.message}`);
  }

  return {
    success: true,
    count: insertedCount,
    synced_at: now,
  };
}
