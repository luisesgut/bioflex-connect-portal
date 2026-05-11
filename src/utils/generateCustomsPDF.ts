import jsPDF from "jspdf";

interface LoadInfo {
  loadNumber: string;
  shippingDate: string;
}

interface PalletDetail {
  palletIndex: number;
  grossWeight: number;
  netWeight: number;
  pieces: number;
  boxes?: number;
  traceability?: string;
}

interface ProductSummary {
  description: string;
  destination: string;
  salesOrder: string | null;
  poNumber: string | null;
  releaseNumber: string | null;
  ptCode?: string | null;
  totalPallets: number;
  totalUnits: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  pricePerThousand: number;
  totalPrice: number;
  ce: number;
  ceTruncated: number;
  customsValue: number;
  unit: string;
  palletDetails?: PalletDetail[];
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
  freightCost: number,
  exchangeRate: number = 17.5
): void {
  const doc = new jsPDF();
  let y = MARGIN;

  const addText = (text: string, x: number, _y: number, opts?: { bold?: boolean; size?: number }) => {
    doc.setFontSize(opts?.size || 9);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(text, x, _y);
  };

  const addRightText = (text: string, x: number, _y: number, opts?: { bold?: boolean; size?: number }) => {
    doc.setFontSize(opts?.size || 9);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(text, x, _y, { align: "right" });
  };

  const checkPage = (needed = 10) => {
    if (y > 280 - needed) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Header
  const date = loadInfo.shippingDate.split("T")[0];
  addText(`Documento de Aduana — ${loadInfo.loadNumber}`, MARGIN, y, { bold: true, size: 14 });
  y += 6;
  addText(`Fecha: ${date}`, MARGIN, y, { size: 10 });
  y += 10;

  // Product details
  products.forEach((p) => {
    checkPage(30);

    // Product title bar
    doc.setFillColor(0, 51, 102);
    doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(255, 255, 255);
    const titleText = p.ptCode ? `${p.ptCode} — ${p.description}` : p.description;
    addText(titleText, MARGIN + 2, y, { bold: true, size: 10 });
    doc.setTextColor(0, 0, 0);
    y += 8;

    // Metadata rows — two columns
    const meta: [string, string][] = [
      ["Destino", p.destination],
      ["Sales Order", p.salesOrder || "-"],
      ["PO Cliente", p.poNumber || "-"],
      ["Release", p.releaseNumber || "-"],
    ];

    const col2X = MARGIN + CONTENT_WIDTH / 2;
    for (let i = 0; i < meta.length; i += 2) {
      const [lbl1, val1] = meta[i];
      addText(lbl1, MARGIN + 2, y, { bold: true });
      addText(val1, MARGIN + 30, y);
      if (i + 1 < meta.length) {
        const [lbl2, val2] = meta[i + 1];
        addText(lbl2, col2X, y, { bold: true });
        addText(val2, col2X + 28, y);
      }
      y += 4;
    }

    y += 2;

    // Pallet breakdown table
    if (p.palletDetails && p.palletDetails.length > 0) {
      checkPage(20);
      // Table header
      const colTarima = MARGIN + 2;
      const colTraza = MARGIN + 18;
      const colPiezas = MARGIN + 60;
      const colBoxes = MARGIN + 85;
      const colBruto = MARGIN + 110;
      const colNeto = MARGIN + 145;

      doc.setFillColor(200, 200, 200);
      doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 5, "F");
      addText("Tarima", colTarima, y, { bold: true, size: 8 });
      addText("Trazabilidad", colTraza, y, { bold: true, size: 8 });
      addText("Piezas", colPiezas, y, { bold: true, size: 8 });
      addText("Cajas", colBoxes, y, { bold: true, size: 8 });
      addText("Bruto", colBruto, y, { bold: true, size: 8 });
      addText("Neto", colNeto, y, { bold: true, size: 8 });
      y += 5;

      let totalPieces = 0;
      let totalBoxes = 0;
      p.palletDetails.forEach((pd) => {
        checkPage(5);
        addText(String(pd.palletIndex), colTarima, y, { size: 8 });
        addText(pd.traceability || "—", colTraza, y, { size: 7 });
        addRightText(fmt(pd.pieces, 0), colPiezas + 20, y, { size: 8 });
        addRightText(fmt(pd.boxes || 0, 0), colBoxes + 20, y, { size: 8 });
        addRightText(fmt(pd.grossWeight), colBruto + 25, y, { size: 8 });
        addRightText(fmt(pd.netWeight), colNeto + 25, y, { size: 8 });
        totalPieces += pd.pieces;
        totalBoxes += pd.boxes || 0;
        y += 4;
      });

      // Totals row
      checkPage(8);
      doc.setFillColor(240, 240, 240);
      doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 5, "F");
      addText(String(p.palletDetails.length), colTarima, y, { bold: true, size: 8 });
      addRightText(fmt(totalPieces, 0), colPiezas + 20, y, { bold: true, size: 8 });
      addRightText(fmt(totalBoxes, 0), colBoxes + 20, y, { bold: true, size: 8 });
      addRightText(fmt(p.totalGrossWeight), colBruto + 25, y, { bold: true, size: 8 });
      addRightText(fmt(p.totalNetWeight), colNeto + 25, y, { bold: true, size: 8 });
      y += 6;
    }

    y += 2;

    // Summary fields — two columns
    const rows: [string, string][] = [
      ["Total Tarimas", String(p.totalPallets)],
      ["Total Unidades", p.totalUnits.toLocaleString()],
      ["Precio por Millar", `$${fmt(p.pricePerThousand)}`],
      ["Total $", `$${fmt(p.totalPrice)}`],
      ["Peso Bruto", `${fmt(p.totalGrossWeight)} kg`],
      ["Peso Neto", `${fmt(p.totalNetWeight)} kg`],
      ["CE", p.ce.toFixed(6)],
      ["CE Truncado", p.ceTruncated.toFixed(2)],
      ["Valor Aduanal", `$${fmt(p.customsValue)}`],
    ];

    for (let i = 0; i < rows.length; i += 2) {
      checkPage();
      const [lbl1, val1] = rows[i];
      addText(lbl1, MARGIN + 2, y, { bold: true });
      addText(val1, MARGIN + 30, y);
      if (i + 1 < rows.length) {
        const [lbl2, val2] = rows[i + 1];
        addText(lbl2, col2X, y, { bold: true });
        addText(val2, col2X + 28, y);
      }
      y += 4;
    }

    y += 4;
    doc.setDrawColor(200);
    doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    y += 6;
  });

  // Summary
  checkPage(40);
  const totalProductValue = products.reduce((s, p) => s + p.totalPrice, 0);
  const totalGross = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNet = products.reduce((s, p) => s + p.totalNetWeight, 0);

  doc.setFillColor(0, 51, 102);
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, "F");
  doc.setTextColor(255, 255, 255);
  addText("RESUMEN DE CARGA", MARGIN + 2, y, { bold: true, size: 11 });
  doc.setTextColor(0, 0, 0);
  y += 8;

  const freightWithoutIVA = freightCost / 1.16;

  // Totales de cajas y bobinas
  const totalCajas = products
    .filter(p => p.unit !== "MIL")
    .reduce((s, p) => s + (p.palletDetails?.reduce((a, d) => a + (d.boxes || 0), 0) || 0), 0);
  const totalBobinas = products
    .filter(p => p.unit === "MIL")
    .reduce((s, p) => s + p.totalPallets, 0);

  const summary: [string, string][] = [
    ["Total Tarimas", String(totalPallets)],
    ...(totalCajas > 0 ? [["Total Cajas", fmt(totalCajas, 0)] as [string, string]] : []),
    ...(totalBobinas > 0 ? [["Total Bobinas", fmt(totalBobinas, 0)] as [string, string]] : []),
    ["$ Producto", `$${fmt(totalProductValue)}`],
    ["Flete", `$${fmt(freightCost)}`],
    ["Flete sin IVA", `$${fmt(freightWithoutIVA)}`],
    ["Total (USD)", `$${fmt(totalProductValue + freightCost)}`],
    ["Tipo de Cambio", fmt(exchangeRate, 4)],
    ["Total (MXN)", `$${fmt((totalProductValue + freightCost) * exchangeRate)}`],
    ["Peso Bruto Total", `${fmt(totalGross)} kg`],
    ["Peso Neto Total", `${fmt(totalNet)} kg`],
  ];

  summary.forEach(([label, value]) => {
    checkPage();
    addText(label, MARGIN + 2, y, { bold: true });
    addText(value, MARGIN + 50, y);
    y += 5;
  });

  // Download
  const fileName = `${loadInfo.loadNumber}.${date.split("-").reverse().join(".")}.pdf`;
  doc.save(fileName);
}
