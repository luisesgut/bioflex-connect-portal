import jsPDF from "jspdf";

interface LoadInfo {
  loadNumber: string;
  shippingDate: string;
}

interface ProductSummary {
  description: string;
  destination: string;
  totalPallets: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  sapNumber: string | null;
  poNumber: string | null;
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

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function generateCustomsPDF(
  loadInfo: LoadInfo,
  products: ProductSummary[],
  totalPallets: number,
  freightCost: number
): void {
  const doc = new jsPDF();
  let y = MARGIN;

  const addText = (text: string, x: number, _y: number, opts?: { bold?: boolean; size?: number }) => {
    doc.setFontSize(opts?.size || 9);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(text, x, _y);
  };

  const checkPage = () => {
    if (y > 270) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Header
  const date = loadInfo.shippingDate.split("T")[0];
  addText(`Customs Document — ${loadInfo.loadNumber}`, MARGIN, y, { bold: true, size: 14 });
  y += 6;
  addText(`Date: ${date}`, MARGIN, y, { size: 10 });
  y += 10;

  // Product details
  products.forEach((p) => {
    checkPage();
    addText(p.description, MARGIN, y, { bold: true, size: 10 });
    y += 5;
    addText(`Destination: ${p.destination}`, MARGIN, y);
    y += 5;

    const rows = [
      ["SAP", p.sapNumber || "-"],
      ["PO Number", p.poNumber || "-"],
      ["Piezas por caja", p.piecesPerPallet.toLocaleString()],
      ["Cajas por tarima", String(p.palletsPerBox)],
      ["Total piezas x tarima", p.totalPiecesPerPallet.toLocaleString()],
      [p.unit === "bags" ? "Total cajas emb." : "Total rollos emb.", String(p.totalBoxesOrRolls)],
      ["Total piezas embar.", p.totalPieces.toLocaleString()],
      ["Precio por pieza", `$${p.pricePerPiece.toFixed(5)}`],
      ["Precio por millar", `$${fmt(p.pricePerThousand)}`],
      ["Total $", `$${fmt(p.totalPrice)}`],
      ["Peso Bruto", `${fmt(p.totalGrossWeight)} kg`],
      ["Peso Neto", `${fmt(p.totalNetWeight)} kg`],
      ["CE", p.customsEquivalent.toFixed(9)],
      ["Valor Aduanal", `$${fmt(p.customsValue)}`],
    ];

    rows.forEach(([label, value]) => {
      checkPage();
      addText(label, MARGIN + 2, y);
      addText(value, MARGIN + 60, y);
      y += 4;
    });

    y += 4;
    doc.setDrawColor(200);
    doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    y += 6;
  });

  // Summary
  checkPage();
  const totalProductValue = products.reduce((s, p) => s + p.totalPrice, 0);
  const totalGross = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNet = products.reduce((s, p) => s + p.totalNetWeight, 0);

  addText("RESUMEN", MARGIN, y, { bold: true, size: 11 });
  y += 6;

  const summary = [
    ["Total Tarimas", String(totalPallets)],
    ["$ Producto", `$${fmt(totalProductValue)}`],
    ["Flete", `$${fmt(freightCost)}`],
    ["Total", `$${fmt(totalProductValue + freightCost)}`],
    ["Peso Bruto Total", `${fmt(totalGross)} kg`],
    ["Peso Neto Total", `${fmt(totalNet)} kg`],
  ];

  summary.forEach(([label, value]) => {
    checkPage();
    addText(label, MARGIN + 2, y, { bold: true });
    addText(value, MARGIN + 60, y);
    y += 5;
  });

  // Download
  const fileName = `${loadInfo.loadNumber}.${date.split("-").reverse().join(".")}.pdf`;
  doc.save(fileName);
}
