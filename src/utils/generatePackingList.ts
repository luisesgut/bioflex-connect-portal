import jsPDF from "jspdf";

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
  releaseNumber: string;
  itemNumber: string;
  description: string;
  quantity: number;
  units: string;
  pallets: number;
}

export async function generatePackingList({
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
}: PackingListParams): Promise<void> {
  // Group pallets by PO + description
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
    // Collect unique release numbers per group
    if (pallet.release_number && !group.releaseNumber.includes(pallet.release_number)) {
      group.releaseNumber = group.releaseNumber
        ? `${group.releaseNumber}, ${pallet.release_number}`
        : pallet.release_number;
    }
  });

  const products = Array.from(groups.values());
  const totalPallets = pallets.length;

  // Format ship date as DD/MM/YYYY
  const dateParts = shippingDate.split("T")[0].split("-");
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

  // Get unique release numbers
  const releaseNumbers = [...new Set(pallets.map((p) => p.release_number).filter(Boolean))];

  // Create PDF (landscape letter)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // === HEADER (logo) ===
  try {
    const logoImg = new Image();
    logoImg.src = "/images/bioflex-logo.png";
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => reject();
      setTimeout(() => resolve(), 1000);
    });
    const logoHeight = 14;
    const logoWidth = (logoImg.naturalWidth / logoImg.naturalHeight) * logoHeight;
    doc.addImage(logoImg, "PNG", margin, 8, logoWidth, logoHeight);
  } catch {
    // Fallback to text if image fails
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 80, 130);
    doc.text("bioflex", margin, 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Beyond packaging.", margin, 23);
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Packing List", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Revisión: 00", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.text("Código: LOG-FOR-05", pageWidth - margin, 14, { align: "right" });

  // === PACKING LIST underlined ===
  const plY = 32;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PACKING LIST", margin, plY);
  const plW = doc.getTextWidth("PACKING LIST");
  doc.setLineWidth(0.5);
  doc.line(margin, plY + 1, margin + plW, plY + 1);

  // === SHIP TO (center) ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SHIP TO", pageWidth / 2, plY, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let shipY = plY + 5;
  if (destination.address) {
    doc.text(destination.address, pageWidth / 2, shipY, { align: "center" });
    shipY += 4;
  }
  const cityLine = [destination.city, destination.state].filter(Boolean).join(" ") + (destination.zip_code ? ` ${destination.zip_code}` : "");
  if (cityLine.trim()) {
    doc.text(cityLine, pageWidth / 2, shipY, { align: "center" });
    shipY += 4;
  }

  // === Ship Date (right) ===
  doc.setFontSize(9);
  doc.text(`Ship Date: ${formattedDate}`, pageWidth - margin, plY, { align: "right" });

  const rightLabelX = pageWidth - margin - 40;
  const rightValueX = pageWidth - margin;
  const rightBlockWidth = rightValueX - rightLabelX - 2;

  const drawRightAlignedField = (
    label: string,
    value: string,
    startY: number,
  ): number => {
    doc.setFont("helvetica", "normal");
    doc.text(label, rightLabelX, startY);

    const safeValue = value || "-";
    const lines = doc.splitTextToSize(safeValue, rightBlockWidth) as string[];
    doc.setFont("helvetica", "bold");
    doc.text(lines, rightValueX, startY, { align: "right" });

    return startY + Math.max(lines.length, 1) * 4.2;
  };

  // === Client / Sales (left) ===
  let leftY = plY + 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Client: ${clientCode} – ${clientName}`, margin, leftY);
  leftY += 5;
  if (salesPerson) {
    doc.setFont("helvetica", "normal");
    doc.text(`Sales: ${salesPerson}`, margin, leftY);
    leftY += 5;
  }

  // === Load # / Invoice (right) ===
  let rightY = plY + 8;
  rightY = drawRightAlignedField("Load #:", loadNumber, rightY);
  rightY = drawRightAlignedField("Product Invoice", invoiceNumber || "-", rightY + 1);

  if (releaseNumbers.length > 0) {
    rightY = drawRightAlignedField("Release #", releaseNumbers.join(", "), rightY + 1);
  }

  // === TABLE (drawn manually) ===
  const tableTop = Math.max(leftY, shipY, rightY) + 6;
  const colWidths = [24, 22, 42, 90, 28, 18, 22]; // PO, RELEASE, ITEM, DESC, QTY, UNITS, PALLETS
  const headers = ["PO #", "RELEASE #", "ITEM #", "DESCRIPTION", "QUANTITY", "UNITS", "PALLETS"];
  const baseRowHeight = 6;
  const tableLeft = margin;

  // Header row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 130);
  doc.setDrawColor(0, 80, 130);
  doc.setLineWidth(0.3);

  let xPos = tableLeft;
  // Draw header underline
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  doc.line(tableLeft, tableTop + 2, tableLeft + totalWidth, tableTop + 2);

  headers.forEach((header, i) => {
    const cellCenter = xPos + colWidths[i] / 2;
    doc.text(header, cellCenter, tableTop, { align: "center" });
    xPos += colWidths[i];
  });

  // Helper: calculate how many lines a text will occupy in a given width
  const getTextLines = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth) as string[];
  };

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8);
  let currentY = tableTop + baseRowHeight + 2;

  products.forEach((product) => {
    // Pre-calculate row height based on longest wrapped text
    const itemMaxW = colWidths[2] - 2;
    const descMaxW = colWidths[3] - 2;
    const itemLines = getTextLines(product.itemNumber, itemMaxW);
    const descLines = getTextLines(product.description, descMaxW);
    const maxLines = Math.max(itemLines.length, descLines.length, 1);
    const rowHeight = Math.max(baseRowHeight, maxLines * 4 + 2);

    xPos = tableLeft;
    const vals = [
      product.poNumber,
      product.releaseNumber,
      product.itemNumber,
      product.description,
      product.quantity.toLocaleString(),
      product.units,
      product.pallets.toString(),
    ];
    vals.forEach((val, i) => {
      const cellCenter = xPos + colWidths[i] / 2;
      if (i === 2 || i === 3) {
        // ITEM # and DESCRIPTION: left-aligned with wrapping
        const maxW = colWidths[i] - 2;
        doc.text(val, xPos + 1, currentY, { maxWidth: maxW });
      } else {
        doc.text(val, cellCenter, currentY, { align: "center" });
      }
      xPos += colWidths[i];
    });
    currentY += rowHeight;
  });

  // Total row
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 130);
  xPos = tableLeft;
  for (let i = 0; i < 5; i++) xPos += colWidths[i];
  doc.text("TOTAL", xPos + colWidths[5] / 2, currentY, { align: "center" });
  xPos += colWidths[5];
  doc.text(totalPallets.toString(), xPos + colWidths[6] / 2, currentY, { align: "center" });

  // === DOWNLOAD ===
  const date = shippingDate.split("T")[0].split("-").reverse().join(".");
  const destName = destination.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const fileName = `PL_${destName}_${loadNumber}.${date}.pdf`;

  doc.save(fileName);
}
