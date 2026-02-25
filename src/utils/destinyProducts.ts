export const DESTINY_DATOS_ENDPOINT = "http://172.16.10.31/api/DestinyDatos";

interface DestinyDatosApiItem {
  nombreProducto?: string | null;
  codigoProducto?: string | null;
  printCard?: string | null;
  tipoEmpaque?: string | null;
  unidadesPorTarima?: number | null;
  piezasTotalePorCaja?: number | null;
  paquetePorCaja?: number | null;
  piezasPorPaquete?: number | null;
}

export interface DestinyProduct {
  codigoProducto: string | null;
  customer_item: string | null;
  item_description: string | null;
  printCard: string | null;
  tipoEmpaque: string | null;
  unidadesPorTarima: number | null;
  piezasTotalePorCaja: number | null;
  paquetePorCaja: number | null;
  piezasPorPaquete: number | null;
  piecesPerPallet: number | null;
}

export const normalizeDestinyCode = (value: string | null | undefined) => value?.trim().toUpperCase() || "";

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const splitNombreProducto = (value: string | null | undefined) => {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return {
      customer_item: null,
      item_description: null,
    };
  }

  const firstSpace = normalized.indexOf(" ");
  if (firstSpace === -1) {
    return {
      customer_item: normalized,
      item_description: null,
    };
  }

  return {
    customer_item: normalized.slice(0, firstSpace),
    item_description: normalized.slice(firstSpace + 1).trim() || null,
  };
};

/**
 * Maps SAP "tipo_empaque" to the product_line enum value.
 * Returns null if no match is found.
 */
export function mapTipoEmpaqueToProductLine(tipoEmpaque: string | null | undefined): string | null {
  if (!tipoEmpaque) return null;
  const te = tipoEmpaque.toLowerCase();
  if (te.includes("wicket")) return "bag_wicket";
  if (te.includes("sello lateral")) return "bag_no_wicket_zipper";
  if (te.includes("zipper")) return "bag_zipper";
  if (te.includes("bobina")) return "film";
  if (te.includes("stand up pouch") || te.includes("laminado")) return "pouch";
  return null;
}

export async function fetchDestinyProducts(endpoint = DESTINY_DATOS_ENDPOINT): Promise<DestinyProduct[]> {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`DestinyDatos API unavailable (status: ${response.status})`);
  }

  const payload = (await response.json()) as DestinyDatosApiItem[];
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected DestinyDatos response format");
  }

  return payload.map((item) => {
    const unidadesPorTarima = parseNullableNumber(item.unidadesPorTarima);
    const piezasTotalePorCaja = parseNullableNumber(item.piezasTotalePorCaja);
    const piecesPerPallet =
      unidadesPorTarima !== null && piezasTotalePorCaja !== null
        ? unidadesPorTarima * piezasTotalePorCaja
        : null;
    const { customer_item, item_description } = splitNombreProducto(item.nombreProducto);

    return {
      codigoProducto: item.codigoProducto || null,
      customer_item,
      item_description,
      printCard: item.printCard || null,
      tipoEmpaque: item.tipoEmpaque || null,
      unidadesPorTarima,
      piezasTotalePorCaja,
      paquetePorCaja: parseNullableNumber(item.paquetePorCaja),
      piezasPorPaquete: parseNullableNumber(item.piezasPorPaquete),
      piecesPerPallet,
    };
  });
}
