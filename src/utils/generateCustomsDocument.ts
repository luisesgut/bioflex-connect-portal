import * as XLSX from "xlsx";

interface PalletData {
  pt_code: string;
  description: string;
  destination: string | null;
  quantity: number;
  gross_weight: number | null;
  net_weight: number | null;
  pieces: number | null;
  unit: string;
  customer_lot: string | null;
  bfx_order: string | null;
}

interface ProductSummary {
  description: string;
  destination: string;
  pallets: {
    palletNumber: number | string;
    grossWeight: number;
    netWeight: number;
  }[];
  totalPallets: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  sapNumber: string | null;
  poNumber: string | null;
  releaseNumber: string | null;
  piecesPerPallet: number;
  palletsPerBox: number;
  totalPiecesPerPallet: number;
  totalBoxesOrRolls: number;
  totalPieces: number;
  pricePerPiece: number;
  pricePerThousand: number;
  totalPrice: number;
  customsEquivalent: number;
  customsValue: number;
  unit: string;
}

interface LoadInfo {
  loadNumber: string;
  shippingDate: string;
  releaseNumber: string | null;
}

interface OrderInfo {
  customer_lot: string;
  sales_order_number: string | null;
  price_per_thousand: number | null;
  pieces_per_pallet: number | null;
  piezas_por_paquete: number | null;
}

const FREIGHT_COST = 5000; // USD
const FULL_LOAD_PALLETS = 24;

export function generateCustomsDocument(
  loadInfo: LoadInfo,
  pallets: PalletData[],
  orderInfo: Map<string, OrderInfo>
): void {
  // Group pallets by description and destination
  const groupedProducts = new Map<string, ProductSummary>();

  pallets.forEach((pallet, index) => {
    const key = `${pallet.description}__${pallet.destination || "tbd"}`;
    
    // Get order info from customer_lot
    const order = pallet.customer_lot ? orderInfo.get(pallet.customer_lot) : null;
    
    if (!groupedProducts.has(key)) {
      const pricePerThousand = order?.price_per_thousand || 0;
      const piecesPerPallet = order?.pieces_per_pallet || 50000;
      const piecesPerPackage = order?.piezas_por_paquete || 1000;
      const totalPiecesPerPallet = piecesPerPallet;
      
      groupedProducts.set(key, {
        description: pallet.description,
        destination: pallet.destination || "TBD",
        pallets: [],
        totalPallets: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        sapNumber: order?.sales_order_number || null,
        poNumber: pallet.customer_lot,
        releaseNumber: null,
        piecesPerPallet: piecesPerPackage,
        palletsPerBox: Math.floor(piecesPerPallet / piecesPerPackage) || 50,
        totalPiecesPerPallet,
        totalBoxesOrRolls: 0,
        totalPieces: 0,
        pricePerPiece: pricePerThousand / 1000,
        pricePerThousand,
        totalPrice: 0,
        customsEquivalent: 0,
        customsValue: 0,
        unit: pallet.unit,
      });
    }

    const group = groupedProducts.get(key)!;
    
    // Add pallet data
    const isPartialPallet = (pallet.pieces || 0) < 50;
    const palletNumber = isPartialPallet 
      ? `${pallet.pieces || 0} ${pallet.unit === "bags" ? "bxs" : "rolls"}`
      : group.pallets.length + 1;
    
    group.pallets.push({
      palletNumber,
      grossWeight: pallet.gross_weight || 0,
      netWeight: pallet.net_weight || 0,
    });
    
    group.totalPallets = group.pallets.filter(p => typeof p.palletNumber === "number").length;
    group.totalGrossWeight += pallet.gross_weight || 0;
    group.totalNetWeight += pallet.net_weight || 0;
    group.totalPieces += pallet.quantity;
    
    // Calculate boxes/rolls
    if (!isPartialPallet) {
      group.totalBoxesOrRolls += group.palletsPerBox;
    } else {
      group.totalBoxesOrRolls += pallet.pieces || 0;
    }
  });

  // Calculate totals for each product
  groupedProducts.forEach((product) => {
    product.totalPrice = (product.totalPieces / 1000) * product.pricePerThousand;
    
    // Customs value calculation: total price / net weight, truncated to 2 digits
    if (product.totalNetWeight > 0) {
      product.customsEquivalent = product.totalPrice / product.totalNetWeight;
      product.customsValue = Math.floor(product.customsEquivalent * 100) / 100 * product.totalNetWeight;
    }
  });

  // Calculate summary totals
  const allProducts = Array.from(groupedProducts.values());
  const totalProductValue = allProducts.reduce((sum, p) => sum + p.totalPrice, 0);
  const totalPallets = pallets.length;
  const totalGrossWeight = allProducts.reduce((sum, p) => sum + p.totalGrossWeight, 0);
  const totalNetWeight = allProducts.reduce((sum, p) => sum + p.totalNetWeight, 0);
  
  // Calculate proportional freight for less than 24 pallets
  const freightCost = totalPallets < FULL_LOAD_PALLETS 
    ? (totalPallets / FULL_LOAD_PALLETS) * FREIGHT_COST 
    : 0;
  
  const totalWithFreight = totalProductValue + freightCost;
  
  // Get unique destinations
  const uniqueDestinations = [...new Set(allProducts.map(p => p.destination))];
  
  // Calculate totals by unit type
  const totalBoxes = allProducts
    .filter(p => p.unit === "bags")
    .reduce((sum, p) => sum + p.totalBoxesOrRolls, 0);
  const totalRolls = allProducts
    .filter(p => p.unit !== "bags")
    .reduce((sum, p) => sum + p.totalBoxesOrRolls, 0);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Group products by destination for display
  const productsByDestination = new Map<string, ProductSummary[]>();
  allProducts.forEach(product => {
    const dest = product.destination;
    if (!productsByDestination.has(dest)) {
      productsByDestination.set(dest, []);
    }
    productsByDestination.get(dest)!.push(product);
  });

  // Create main worksheet data
  const wsData: (string | number | null)[][] = [];

  // Header row with destinations
  const headerRow: (string | number | null)[] = [];
  productsByDestination.forEach((products, destination) => {
    products.forEach(product => {
      headerRow.push("", "", destination.charAt(0).toUpperCase() + destination.slice(1));
    });
  });
  wsData.push(headerRow);

  // Product names row
  const productRow: (string | number | null)[] = [];
  productsByDestination.forEach((products) => {
    products.forEach(product => {
      productRow.push(product.description, "", "");
    });
  });
  wsData.push(productRow);

  // Tarima/Bruto/Neto headers
  const headerLabels: (string | number | null)[] = [];
  productsByDestination.forEach((products) => {
    products.forEach(() => {
      headerLabels.push("Tarima", "Bruto", "Neto", "");
    });
  });
  wsData.push(headerLabels);

  // Find max pallets across all products
  const maxPallets = Math.max(...allProducts.map(p => p.pallets.length));

  // Add pallet rows
  for (let i = 0; i < maxPallets; i++) {
    const row: (string | number | null)[] = [];
    productsByDestination.forEach((products) => {
      products.forEach(product => {
        if (i < product.pallets.length) {
          const pallet = product.pallets[i];
          row.push(pallet.palletNumber, pallet.grossWeight.toFixed(2), pallet.netWeight.toFixed(2), "");
        } else {
          row.push("", "", "", "");
        }
      });
    });
    wsData.push(row);
  }

  // Empty rows
  wsData.push([]);

  // Totals row
  const totalsRow: (string | number | null)[] = [];
  productsByDestination.forEach((products) => {
    products.forEach(product => {
      totalsRow.push(product.totalPallets || "", product.totalGrossWeight.toFixed(2), product.totalNetWeight.toFixed(2), "");
    });
  });
  wsData.push(totalsRow);

  wsData.push([]);

  // Product details section
  productsByDestination.forEach((products) => {
    products.forEach(product => {
      wsData.push([product.description]);
      wsData.push(["SAP", "", product.sapNumber || "-"]);
      wsData.push(["Número de Pedido", "", product.poNumber || "-"]);
      wsData.push(["Release", "", product.releaseNumber || "-"]);
      wsData.push(["Piezas por caja", "", product.piecesPerPallet.toLocaleString()]);
      wsData.push(["Cajas por tarima", "", product.palletsPerBox]);
      wsData.push(["Total piezas x tarima", "", product.totalPiecesPerPallet.toLocaleString()]);
      wsData.push([product.unit === "bags" ? "Total de cajas emb." : "Total de rollos emb.", "", product.totalBoxesOrRolls]);
      wsData.push(["Total piezas embar.", "", product.totalPieces.toLocaleString()]);
      wsData.push(["Precio por pieza", "", `$${product.pricePerPiece.toFixed(5)}`]);
      wsData.push(["Precio por millar", "Normal", `$${product.pricePerThousand.toFixed(2)}`]);
      wsData.push(["Total $", "", `$${product.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      wsData.push(["", "Bruto", "Neto"]);
      wsData.push(["", product.totalGrossWeight.toFixed(2), product.totalNetWeight.toFixed(2)]);
      wsData.push(["CE", product.customsEquivalent.toFixed(9), "Valor aduana"]);
      wsData.push(["valor aduanal", Math.floor(product.customsEquivalent * 100) / 100, `$${product.customsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      wsData.push([]);
    });
  });

  wsData.push([]);

  // Summary section
  wsData.push(["$ Producto", `$${totalProductValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "", "Total Tarimas", totalPallets]);
  wsData.push(["Flete", `$${freightCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `$${freightCost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`, "Total de Cajas", totalBoxes || "-"]);
  wsData.push(["Total", `$${totalWithFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `$${(totalProductValue + freightCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Total de bobinas", totalRolls || "-"]);
  wsData.push([]);
  wsData.push(["Bruto", totalGrossWeight.toFixed(2), "", ...uniqueDestinations.map(d => d.charAt(0).toUpperCase() + d.slice(1))]);
  wsData.push(["Neto", totalNetWeight.toFixed(2)]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = Array(20).fill({ wch: 15 });

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Customs Document");

  // Generate filename
  const date = loadInfo.shippingDate.split("T")[0];
  const fileName = `${loadInfo.loadNumber}.${date.split("-").reverse().join(".")}.xlsx`;

  // Download file
  XLSX.writeFile(wb, fileName);
}
