export const DESTINY_DATOS_ENDPOINT = "http://172.16.10.31/api/DestinyDatos";

interface DestinyDatosApiItem {
  et?: number | null;
  nombreProducto?: string | number | null;
  codigoProducto?: string | number | null;
  activa?: boolean | null;
  descripcionCliente?: string | number | null;
  printCard?: string | number | null;
  tipoEmpaque?: string | number | null;
  unidadesPorTarima?: number | null;
  piezasTotalePorCaja?: number | null;
  piezasTotalesPorCaja?: number | null;
  paquetePorCaja?: number | null;
  piezasPorPaquete?: number | null;
}

export interface DestinyProduct {
  et: number | null;
  codigoProducto: string | null;
  activa: boolean | null;
  descripcionCliente: string | null;
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

const toCleanString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const normalizeDestinyCode = (value: unknown) => toCleanString(value).toUpperCase();

export const buildDestinyLookupKeys = (value: unknown) => {
  const normalized = normalizeDestinyCode(value);
  if (!normalized) return [];

  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  return compact && compact !== normalized ? [normalized, compact] : [normalized];
};

export const findDestinyProductByCodes = <T>(
  destinyByCode: Record<string, T>,
  values: unknown[],
) => {
  for (const value of values) {
    const keys = buildDestinyLookupKeys(value);
    for (const key of keys) {
      const match = destinyByCode[key];
      if (match) return match;
    }
  }
  return undefined;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const splitNombreProducto = (value: unknown) => {
  const normalized = toCleanString(value).replace(/\s+/g, " ");
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

/**
 * Maps a product_line enum value to the human-readable Item Type label.
 */
export function mapProductLineToItemType(productLine: string | null | undefined): string | null {
  if (!productLine) return null;
  switch (productLine) {
    case "bag_wicket": return "Bag Wicket";
    case "bag_no_wicket_zipper": return "Bag No Wicket/Zipper";
    case "bag_zipper": return "Bag Zipper";
    case "film": return "Film";
    case "pouch": return "Bag Pouch";
    default: return null;
  }
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
    const piezasTotalePorCaja = parseNullableNumber(item.piezasTotalePorCaja ?? item.piezasTotalesPorCaja);
    const piecesPerPallet =
      unidadesPorTarima !== null && piezasTotalePorCaja !== null
        ? unidadesPorTarima * piezasTotalePorCaja
        : null;
    const { customer_item, item_description } = splitNombreProducto(item.nombreProducto);

    return {
      et: parseNullableNumber(item.et),
      codigoProducto: toCleanString(item.codigoProducto) || null,
      activa: typeof item.activa === "boolean" ? item.activa : null,
      descripcionCliente: toCleanString(item.descripcionCliente) || null,
      customer_item,
      item_description,
      printCard: toCleanString(item.printCard) || null,
      tipoEmpaque: toCleanString(item.tipoEmpaque) || null,
      unidadesPorTarima,
      piezasTotalePorCaja,
      paquetePorCaja: parseNullableNumber(item.paquetePorCaja),
      piezasPorPaquete: parseNullableNumber(item.piezasPorPaquete),
      piecesPerPallet,
    };
  });
}
