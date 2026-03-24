import * as XLSX from "xlsx";

interface PackingListPallet {
  description: string;
  customer_lot: string | null;
  bfx_order: string | null;
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
  customer_item: string | null;
}

interface PackingListExcelParams {
  loadNumber: string;
  shippingDate: string;
  invoiceNumber: string;
  freightInvoiceNumber?: string;
  destination: DestinationInfo;
  pallets: PackingListPallet[];
  poInfoMap: Map<string, POInfo>;
  resolveCustomerPO: (pallet: PackingListPallet) => string;
  clientCode?: string;
  clientName?: string;
  salesPerson?: string;
}

interface ProductRow {
  poNumber: string;
  releaseNumber: string;
  itemNumber: string;
  description: string;
  quantity: number;
  units: string;
  pallets: number;
}

export function generatePackingListExcel({
  loadNumber,
  shippingDate,
  invoiceNumber,
  freightInvoiceNumber = "",
  destination,
  pallets,
  poInfoMap,
  resolveCustomerPO,
  clientCode = "CL0000103",
  clientName = "DESTINY PACKAGING, LLC",
  salesPerson = "",
}: PackingListExcelParams): void {
  const groups = new Map<string, ProductRow>();

  pallets.forEach((pallet) => {
    const customerPO = resolveCustomerPO(pallet);
    const key = `${customerPO}__${pallet.description}`;

    if (!groups.has(key)) {
      const poInfo = poInfoMap.get(customerPO);
      groups.set(key, {
        poNumber: customerPO,
        releaseNumber: pallet.release_number || "",
        itemNumber: poInfo?.customer_item || "",
        description: pallet.description,
        quantity: 0,
        units: "PZA",
        pallets: 0,
      });
    }

    const group = groups.get(key)!;
    group.quantity += pallet.quantity;
    group.pallets += 1;
    if (pallet.release_number && !group.releaseNumber.includes(pallet.release_number)) {
      group.releaseNumber = group.releaseNumber
        ? `${group.releaseNumber}, ${pallet.release_number}`
        : pallet.release_number;
    }
  });

  const products = Array.from(groups.values());
  const totalPallets = pallets.length;

  const dateParts = shippingDate.split("T")[0].split("-");
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  // Release numbers no longer displayed in header
  const cityLine = [destination.city, destination.state].filter(Boolean).join(" ") + (destination.zip_code ? ` ${destination.zip_code}` : "");

  const data: (string | number | null)[][] = [];

  // Row 1-2: Header
  data.push(["bioflex", "", "", "Packing List", "", "", "Código: LOG-FOR-05"]);
  data.push(["Beyond packaging.", "", "", "Revisión: 00", "", "", ""]);
  // Row 3: blank
  data.push([]);
  // Row 4-6: PACKING LIST / SHIP TO / Ship Date
  data.push(["PACKING LIST", "", "", "SHIP TO", "", "", `Ship Date: ${formattedDate}`]);
  data.push(["", "", "", destination.address || "", "", "", ""]);
  data.push(["", "", "", cityLine || "", "", "", ""]);
  // Row 7: blank
  data.push([]);
  // Row 8-10: Client, Sales, Release / Load, Invoice, Release
  data.push([`Client: ${clientCode} – ${clientName}`, "", "", "", "", "Load #:", loadNumber]);
  data.push([salesPerson ? `Sales: ${salesPerson}` : "", "", "", "", "", "Product Invoice", invoiceNumber || "-"]);
  data.push(["", "", "", "", "", "Load Invoice", invoiceNumber || "-"]);
  // Row 11: blank
  data.push([]);
  // Row 12: Table headers
  data.push(["PO #", "RELEASE #", "ITEM #", "DESCRIPTION", "QUANTITY", "UNITS", "PALLETS"]);

  products.forEach((product) => {
    data.push([
      product.poNumber,
      product.releaseNumber,
      product.itemNumber,
      product.description,
      product.quantity,
      product.units,
      product.pallets,
    ]);
  });

  // Total row
  data.push(["", "", "", "", "", "TOTAL", totalPallets]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
    { wch: 55 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
  ];

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
    { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
    { s: { r: 4, c: 3 }, e: { r: 4, c: 5 } },
    { s: { r: 5, c: 3 }, e: { r: 5, c: 5 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Packing List");

  const date = shippingDate.split("T")[0].split("-").reverse().join(".");
  const destName = destination.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const fileName = `PL_${destName}_${loadNumber}.${date}.xlsx`;

  XLSX.writeFile(wb, fileName);
}