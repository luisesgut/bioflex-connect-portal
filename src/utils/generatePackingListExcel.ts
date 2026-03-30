import ExcelJS from "exceljs";

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

const DARK_TEAL = "005082";
const BODY_GRAY = "323232";

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
  const cityLine = [destination.city, destination.state].filter(Boolean).join(" ") + (destination.zip_code ? ` ${destination.zip_code}` : "");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Packing List", {
    pageSetup: { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Column widths (A-I to give more room)
  ws.columns = [
    { width: 12 },  // A - PO#
    { width: 18 },  // B - Release
    { width: 18 },  // C - Item
    { width: 50 },  // D - Description
    { width: 14 },  // E - Quantity
    { width: 10 },  // F - Units
    { width: 12 },  // G - Pallets
    { width: 18 },  // H - labels
    { width: 16 },  // I - values
  ];

  const defaultFont: Partial<ExcelJS.Font> = { name: "Arial", size: 10, color: { argb: BODY_GRAY } };
  const boldTeal: Partial<ExcelJS.Font> = { name: "Arial", size: 10, bold: true, color: { argb: DARK_TEAL } };
  const boldBlack: Partial<ExcelJS.Font> = { name: "Arial", size: 10, bold: true, color: { argb: "000000" } };

  // --- Row 1: bioflex | Packing List | Código ---
  const r1 = ws.getRow(1);
  r1.getCell(1).value = "bioflex";
  r1.getCell(1).font = { name: "Arial", size: 16, bold: true, color: { argb: DARK_TEAL } };
  ws.mergeCells("D1:F1");
  r1.getCell(4).value = "Packing List";
  r1.getCell(4).font = { name: "Arial", size: 14, bold: true, color: { argb: "000000" } };
  r1.getCell(4).alignment = { horizontal: "center" };
  r1.getCell(9).value = "Código: LOG-FOR-05";
  r1.getCell(9).font = { ...defaultFont, size: 9 };
  r1.getCell(9).alignment = { horizontal: "right" };

  // --- Row 2: Beyond packaging | Revisión ---
  const r2 = ws.getRow(2);
  r2.getCell(1).value = "Beyond packaging.";
  r2.getCell(1).font = { name: "Arial", size: 8, italic: true, color: { argb: "666666" } };
  ws.mergeCells("D2:F2");
  r2.getCell(4).value = "Revisión: 00";
  r2.getCell(4).font = { ...defaultFont, size: 9 };
  r2.getCell(4).alignment = { horizontal: "center" };

  // --- Row 4: PACKING LIST | SHIP TO | Ship Date ---
  const r4 = ws.getRow(4);
  r4.getCell(1).value = "PACKING LIST";
  r4.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "000000" } };
  r4.getCell(1).border = { bottom: { style: "thin", color: { argb: "000000" } } };
  ws.mergeCells("D4:F4");
  r4.getCell(4).value = "SHIP TO";
  r4.getCell(4).font = { name: "Arial", size: 11, bold: true, color: { argb: "000000" } };
  r4.getCell(4).alignment = { horizontal: "center" };
  ws.mergeCells("H4:I4");
  r4.getCell(8).value = `Ship Date: ${formattedDate}`;
  r4.getCell(8).font = defaultFont;
  r4.getCell(8).alignment = { horizontal: "right" };

  // --- Row 5-6: Address ---
  if (destination.address) {
    ws.mergeCells("D5:F5");
    const r5 = ws.getRow(5);
    r5.getCell(4).value = destination.address;
    r5.getCell(4).font = defaultFont;
    r5.getCell(4).alignment = { horizontal: "center" };
  }
  if (cityLine.trim()) {
    ws.mergeCells("D6:F6");
    const r6 = ws.getRow(6);
    r6.getCell(4).value = cityLine;
    r6.getCell(4).font = defaultFont;
    r6.getCell(4).alignment = { horizontal: "center" };
  }

  // --- Row 8: Client | Load # ---
  const r8 = ws.getRow(8);
  ws.mergeCells("A8:D8");
  r8.getCell(1).value = `Client: ${clientCode} – ${clientName}`;
  r8.getCell(1).font = boldBlack;
  r8.getCell(8).value = "Load #:";
  r8.getCell(8).font = defaultFont;
  r8.getCell(8).alignment = { horizontal: "right" };
  r8.getCell(9).value = loadNumber;
  r8.getCell(9).font = boldBlack;
  r8.getCell(9).alignment = { horizontal: "right" };

  // --- Row 9: Sales | Product Invoice ---
  const r9 = ws.getRow(9);
  if (salesPerson) {
    r9.getCell(1).value = `Sales: ${salesPerson}`;
    r9.getCell(1).font = defaultFont;
  }
  r9.getCell(8).value = "Product Invoice";
  r9.getCell(8).font = defaultFont;
  r9.getCell(8).alignment = { horizontal: "right" };
  r9.getCell(9).value = invoiceNumber || "-";
  r9.getCell(9).font = boldBlack;
  r9.getCell(9).alignment = { horizontal: "right" };

  // --- Row 10: Load Invoice ---
  const r10 = ws.getRow(10);
  r10.getCell(8).value = "Load Invoice";
  r10.getCell(8).font = defaultFont;
  r10.getCell(8).alignment = { horizontal: "right" };
  r10.getCell(9).value = freightInvoiceNumber || "-";
  r10.getCell(9).font = boldBlack;
  r10.getCell(9).alignment = { horizontal: "right" };

  // --- Row 12: Table headers ---
  const headerRow = 12;
  const headers = ["PO #", "RELEASE #", "ITEM #", "DESCRIPTION", "QUANTITY", "UNITS", "PALLETS"];
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: DARK_TEAL } };
    cell.alignment = { horizontal: i >= 4 ? "right" : "left" };
    cell.border = { bottom: { style: "thin", color: { argb: DARK_TEAL } } };
  });

  // --- Data rows ---
  let rowIdx = headerRow + 1;
  products.forEach((product) => {
    const row = ws.getRow(rowIdx);
    const vals: (string | number)[] = [
      product.poNumber,
      product.releaseNumber,
      product.itemNumber,
      product.description,
      product.quantity,
      product.units,
      product.pallets,
    ];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = defaultFont;
      cell.alignment = { horizontal: i >= 4 ? "right" : "left" };
      if (i === 4 && typeof v === "number") {
        cell.numFmt = "#,##0";
      }
    });
    rowIdx++;
  });

  // --- Total row ---
  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(6).value = "TOTAL";
  totalRow.getCell(6).font = boldTeal;
  totalRow.getCell(6).alignment = { horizontal: "right" };
  totalRow.getCell(7).value = totalPallets;
  totalRow.getCell(7).font = boldTeal;
  totalRow.getCell(7).alignment = { horizontal: "right" };

  // --- Download ---
  const date = shippingDate.split("T")[0].split("-").reverse().join(".");
  const destName = destination.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const fileName = `PL_${destName}_${loadNumber}.${date}.xlsx`;

  wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  });
}
