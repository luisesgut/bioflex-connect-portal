import * as XLSX from "xlsx";

interface PackingListPallet {
  description: string;
  customer_lot: string | null;
  quantity: number;
  release_number: string | null;
  pt_code: string;
  gross_weight: number | null;
  net_weight: number | null;
  pieces: number | null;
  unit: string;
}

interface DestinationInfo {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface POInfo {
  sales_order_number: string | null;
}

interface PackingListParams {
  loadNumber: string;
  shippingDate: string;
  invoiceNumber: string;
  destination: DestinationInfo;
  pallets: PackingListPallet[];
  poInfoMap: Map<string, POInfo>;
  resolveCustomerPO: (pallet: PackingListPallet) => string;
}

interface ProductGroup {
  description: string;
  customerPO: string;
  salesOrder: string;
  releaseNumbers: Set<string>;
  totalQuantity: number;
  palletCount: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  unit: string;
}

export function generatePackingList({
  loadNumber,
  shippingDate,
  invoiceNumber,
  destination,
  pallets,
  poInfoMap,
  resolveCustomerPO,
}: PackingListParams): void {
  // Group pallets by description + customer PO
  const groups = new Map<string, ProductGroup>();

  pallets.forEach((pallet) => {
    const customerPO = resolveCustomerPO(pallet);
    const key = `${pallet.description}__${customerPO}`;

    if (!groups.has(key)) {
      const poInfo = poInfoMap.get(customerPO);
      groups.set(key, {
        description: pallet.description,
        customerPO,
        salesOrder: poInfo?.sales_order_number || "-",
        releaseNumbers: new Set(),
        totalQuantity: 0,
        palletCount: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        unit: pallet.unit,
      });
    }

    const group = groups.get(key)!;
    if (pallet.release_number) group.releaseNumbers.add(pallet.release_number);
    group.totalQuantity += pallet.quantity;
    group.palletCount += 1;
    group.totalGrossWeight += pallet.gross_weight || 0;
    group.totalNetWeight += pallet.net_weight || 0;
  });

  const products = Array.from(groups.values());

  // Build address string
  const addressParts = [
    destination.address,
    destination.city,
    destination.state,
    destination.zip_code,
  ].filter(Boolean);
  const addressStr = addressParts.length > 0 ? addressParts.join(", ") : destination.name;

  // Totals
  const totalPallets = pallets.length;
  const totalQuantity = products.reduce((s, p) => s + p.totalQuantity, 0);
  const totalGross = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNet = products.reduce((s, p) => s + p.totalNetWeight, 0);

  // Build worksheet data
  const wsData: (string | number | null)[][] = [];

  // Header
  wsData.push(["PACKING LIST"]);
  wsData.push([]);
  wsData.push(["Load #", loadNumber, "", "Invoice #", invoiceNumber]);
  wsData.push(["Ship Date", shippingDate.split("T")[0]]);
  wsData.push([]);
  wsData.push(["Ship To:"]);
  wsData.push([destination.name]);
  if (destination.address) wsData.push([destination.address]);
  if (destination.city || destination.state || destination.zip_code) {
    wsData.push([
      [destination.city, destination.state].filter(Boolean).join(", ") +
        (destination.zip_code ? ` ${destination.zip_code}` : ""),
    ]);
  }
  wsData.push([]);

  // Product detail table header
  wsData.push(["Description", "Customer PO", "Sales Order", "Release #", "Volume", "Pallets", "Gross Wt (kg)", "Net Wt (kg)"]);

  // Product rows
  products.forEach((product) => {
    wsData.push([
      product.description,
      product.customerPO,
      product.salesOrder,
      Array.from(product.releaseNumbers).join(", ") || "-",
      product.totalQuantity,
      product.palletCount,
      Math.round(product.totalGrossWeight * 100) / 100,
      Math.round(product.totalNetWeight * 100) / 100,
    ]);
  });

  // Totals row
  wsData.push([]);
  wsData.push([
    "TOTAL",
    "",
    "",
    "",
    totalQuantity,
    totalPallets,
    Math.round(totalGross * 100) / 100,
    Math.round(totalNet * 100) / 100,
  ]);

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [
    { wch: 35 }, // Description
    { wch: 15 }, // Customer PO
    { wch: 14 }, // Sales Order
    { wch: 18 }, // Release #
    { wch: 12 }, // Volume
    { wch: 10 }, // Pallets
    { wch: 14 }, // Gross Wt
    { wch: 14 }, // Net Wt
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Packing List");

  // Generate filename: PL_DESTINATION_LOAD.DATE.xlsx
  const date = shippingDate.split("T")[0].split("-").reverse().join(".");
  const destName = destination.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const fileName = `PL_${destName}_${loadNumber}.${date}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
