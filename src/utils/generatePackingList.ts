import jsPDF from "jspdf";
import "jspdf-autotable";

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
  customer_item: string | null;
}

interface PackingListParams {
  loadNumber: string;
  shippingDate: string;
  invoiceNumber: string;
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
  lotNumber: string;
  itemNumber: string;
  description: string;
  quantity: number;
  units: string;
  pallets: number;
}

export function generatePackingList({
  loadNumber,
  shippingDate,
  invoiceNumber,
  destination,
  pallets,
  poInfoMap,
  resolveCustomerPO,
  clientCode = "CL0000103",
  clientName = "DESTINY PACKAGING, LLC",
  salesPerson = "",
}: PackingListParams): void {
  // Group pallets by PO + description
  const groups = new Map<string, ProductRow>();

  pallets.forEach((pallet) => {
    const customerPO = resolveCustomerPO(pallet);
    const key = `${customerPO}__${pallet.description}`;

    if (!groups.has(key)) {
      const poInfo = poInfoMap.get(customerPO);
      groups.set(key, {
        poNumber: customerPO,
        lotNumber: poInfo?.sales_order_number || "",
        itemNumber: poInfo?.customer_item || "",
        description: pallet.description,
        quantity: 0,
        units: pallet.unit === "bags" ? "PZA" : "PZA",
        pallets: 0,
      });
    }

    const group = groups.get(key)!;
    group.quantity += pallet.quantity;
    group.pallets += 1;
  });

  const products = Array.from(groups.values());
  const totalPallets = pallets.length;

  // Build address
  const addressParts = [destination.address].filter(Boolean);
  const cityLine = [destination.city, destination.state].filter(Boolean).join(" ");
  const fullCityLine = cityLine + (destination.zip_code ? ` ${destination.zip_code}` : "");

  // Format ship date as DD/MM/YYYY
  const dateParts = shippingDate.split("T")[0].split("-");
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

  // Get unique release numbers
  const releaseNumbers = [...new Set(pallets.map((p) => p.release_number).filter(Boolean))];

  // Create PDF (letter size)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // === HEADER SECTION ===
  // Bioflex logo (text-based)
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 130);
  doc.text("bioflex", margin, 18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Beyond packaging.", margin, 23);

  // Center: Packing List title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Packing List", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Revisión: 00", pageWidth / 2, 20, { align: "center" });

  // Right: Code
  doc.setFontSize(9);
  doc.text("Código: LOG-FOR-05", pageWidth - margin, 14, { align: "right" });

  // === PACKING LIST UNDERLINED TITLE ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const plTitleY = 32;
  doc.text("PACKING LIST", margin, plTitleY);
  const plTextWidth = doc.getTextWidth("PACKING LIST");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, plTitleY + 1, margin + plTextWidth, plTitleY + 1);

  // === SHIP TO (center) ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SHIP TO", pageWidth / 2, plTitleY, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  let shipToY = plTitleY + 5;
  if (addressParts.length > 0) {
    doc.text(addressParts[0]!, pageWidth / 2, shipToY, { align: "center" });
    shipToY += 4;
  }
  if (fullCityLine) {
    doc.text(fullCityLine, pageWidth / 2, shipToY, { align: "center" });
    shipToY += 4;
  }

  // === Ship Date (right) ===
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Ship Date: ${formattedDate}`, pageWidth - margin, plTitleY, { align: "right" });

  // === Client and Sales (left) ===
  let leftY = plTitleY + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Client: ${clientCode} – ${clientName}`, margin, leftY);
  leftY += 5;
  if (salesPerson) {
    doc.setFont("helvetica", "normal");
    doc.text(`Sales: ${salesPerson}`, margin, leftY);
    leftY += 5;
  }

  // === Load #, Invoice (right side) ===
  let rightY = plTitleY + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Load #
  doc.text("Load #:", pageWidth - margin - 40, rightY);
  doc.setFont("helvetica", "bold");
  doc.text(loadNumber, pageWidth - margin, rightY, { align: "right" });
  rightY += 5;

  // Product Invoice
  doc.setFont("helvetica", "normal");
  doc.text("Product Invoice", pageWidth - margin - 40, rightY);
  doc.setFont("helvetica", "bold");
  doc.text(invoiceNumber || "-", pageWidth - margin, rightY, { align: "right" });
  rightY += 5;

  // Release numbers
  if (releaseNumbers.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Release #", pageWidth - margin - 40, rightY);
    doc.setFont("helvetica", "bold");
    doc.text(releaseNumbers.join(", "), pageWidth - margin, rightY, { align: "right" });
    rightY += 5;
  }

  // === TABLE ===
  const tableStartY = Math.max(leftY, rightY) + 8;

  const tableColumns = [
    { header: "PO #", dataKey: "poNumber" },
    { header: "LOT #", dataKey: "lotNumber" },
    { header: "ITEM #", dataKey: "itemNumber" },
    { header: "DESCRIPTION", dataKey: "description" },
    { header: "QUANTITY", dataKey: "quantity" },
    { header: "UNITS", dataKey: "units" },
    { header: "PALLETS", dataKey: "pallets" },
  ];

  const tableRows = products.map((p) => ({
    poNumber: p.poNumber,
    lotNumber: p.lotNumber,
    itemNumber: p.itemNumber,
    description: p.description,
    quantity: p.quantity.toLocaleString(),
    units: p.units,
    pallets: p.pallets.toString(),
  }));

  // Add total row
  tableRows.push({
    poNumber: "",
    lotNumber: "",
    itemNumber: "",
    description: "",
    quantity: "",
    units: "TOTAL",
    pallets: totalPallets.toString(),
  });

  (doc as any).autoTable({
    columns: tableColumns,
    body: tableRows,
    startY: tableStartY,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 80, 130],
      fontStyle: "bold",
      lineColor: [0, 80, 130],
      lineWidth: 0.3,
      halign: "center",
    },
    bodyStyles: {
      textColor: [50, 50, 50],
    },
    columnStyles: {
      poNumber: { halign: "center", cellWidth: 25 },
      lotNumber: { halign: "center", cellWidth: 25 },
      itemNumber: { halign: "center", cellWidth: 35 },
      description: { cellWidth: "auto" },
      quantity: { halign: "center", cellWidth: 28 },
      units: { halign: "center", cellWidth: 20 },
      pallets: { halign: "center", cellWidth: 22 },
    },
    didParseCell: (data: any) => {
      // Style the total row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [0, 80, 130];
      }
    },
  });

  // === DOWNLOAD ===
  const date = shippingDate.split("T")[0].split("-").reverse().join(".");
  const destName = destination.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const fileName = `PL_${destName}_${loadNumber}.${date}.pdf`;

  doc.save(fileName);
}
