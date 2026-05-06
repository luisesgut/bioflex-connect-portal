import jsPDF from "jspdf";

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
  unit: string;
  palletDetails?: PalletDetail[];
}

interface LoadInfo {
  loadNumber: string;
  shippingDate: string;
}

const MARGIN = 12;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CHECK_SIZE = 3.5;

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function generateLoadChecklist(
  loadInfo: LoadInfo,
  products: ProductSummary[],
  totalPallets: number
): void {
  const doc = new jsPDF();
  let y = MARGIN;

  const addText = (text: string, x: number, _y: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    doc.setFontSize(opts?.size || 8);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(0, 0, 0);
    doc.text(text, x, _y);
  };

  const addRightText = (text: string, x: number, _y: number, opts?: { bold?: boolean; size?: number }) => {
    doc.setFontSize(opts?.size || 8);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(text, x, _y, { align: "right" });
  };

  const drawCheckbox = (x: number, _y: number) => {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.rect(x, _y - CHECK_SIZE + 0.5, CHECK_SIZE, CHECK_SIZE);
  };

  const checkPage = (needed = 12) => {
    if (y > PAGE_HEIGHT - MARGIN - needed) {
      doc.addPage();
      y = MARGIN;
      // Mini header on continuation pages
      doc.setFillColor(30, 41, 59);
      doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 6, "F");
      addText(`${loadInfo.loadNumber} — Lista de Verificacion de Carga (cont.)`, MARGIN + 2, y, { bold: true, size: 8, color: [255, 255, 255] });
      y += 6;
    }
  };

  const date = loadInfo.shippingDate.split("T")[0];

  // ── Header ──
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 14, "F");

  addText("LISTA DE VERIFICACION DE CARGA", MARGIN + 3, y + 1, { bold: true, size: 14, color: [255, 255, 255] });
  addText(`${loadInfo.loadNumber}  ·  ${date}`, MARGIN + 3, y + 7, { size: 9, color: [200, 210, 220] });

  // Summary badge area
  const totalUnits = products.reduce((s, p) => s + p.totalUnits, 0);
  const totalGross = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNet = products.reduce((s, p) => s + p.totalNetWeight, 0);
  const summaryX = MARGIN + CONTENT_WIDTH - 2;
  addRightText(`${totalPallets} Tarimas  ·  ${fmt(totalUnits)} pzas  ·  ${fmt(totalGross)} kg bruto`, summaryX, y + 1, { bold: true, size: 8 });
  doc.setTextColor(200, 210, 220);
  addRightText(`${products.length} producto(s)  ·  ${fmt(totalNet)} kg neto`, summaryX, y + 7, { size: 8 });

  y += 15;

  // ── Signature / date line ──
  addText("Fecha: _______________     Verificado por: ___________________________________     Firma: ___________________________", MARGIN + 2, y, { size: 7 });
  y += 6;

  // Column positions for pallet table
  const colCheck = MARGIN + 1;
  const colNum = MARGIN + 6;
  const colTraza = MARGIN + 14;
  const colPiezas = MARGIN + 80;
  const colCajas = MARGIN + 100;
  const colBruto = MARGIN + 118;
  const colNeto = MARGIN + 140;
  const colOk = MARGIN + 160;
  const colNotes = MARGIN + 168;

  // ── Product sections ──
  products.forEach((p, pIdx) => {
    checkPage(25);

    // Product header bar
    doc.setFillColor(51, 65, 85); // slate-700
    doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 7, "F");
    const titleText = p.ptCode ? `${p.ptCode} — ${p.description}` : p.description;
    addText(`${pIdx + 1}. ${titleText}`, MARGIN + 2, y, { bold: true, size: 8, color: [255, 255, 255] });
    addRightText(`${p.totalPallets} tarimas`, MARGIN + CONTENT_WIDTH - 2, y, { bold: true, size: 8 });
    doc.setTextColor(255, 255, 255);
    y += 5;

    // Product metadata row
    const metaParts: string[] = [];
    if (p.destination) metaParts.push(`Dest: ${p.destination}`);
    if (p.salesOrder) metaParts.push(`SO: ${p.salesOrder}`);
    if (p.poNumber) metaParts.push(`PO: ${p.poNumber}`);
    if (p.releaseNumber) metaParts.push(`Rel: ${p.releaseNumber}`);
    metaParts.push(`${fmt(p.totalUnits)} pzas`);
    metaParts.push(`${fmt(p.totalGrossWeight, 1)} kg bruto`);

    addText(metaParts.join("   ·   "), MARGIN + 2, y, { size: 7 });
    y += 5;

    // Table header
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 5, "F");
    addText("✓", colCheck + 0.5, y, { bold: true, size: 7 });
    addText("#", colNum, y, { bold: true, size: 7 });
    addText("Trazabilidad", colTraza, y, { bold: true, size: 7 });
    addText("Piezas", colPiezas, y, { bold: true, size: 7 });
    addText("Cajas", colCajas, y, { bold: true, size: 7 });
    addText("Bruto", colBruto, y, { bold: true, size: 7 });
    addText("Neto", colNeto, y, { bold: true, size: 7 });
    addText("OK", colOk, y, { bold: true, size: 7 });
    addText("Notas", colNotes, y, { bold: true, size: 7 });
    y += 4;

    // Pallet rows
    if (p.palletDetails && p.palletDetails.length > 0) {
      p.palletDetails.forEach((pd, i) => {
        checkPage(5);

        // Alternating row shading
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(MARGIN, y - 3.2, CONTENT_WIDTH, 4.2, "F");
        }

        drawCheckbox(colCheck, y);
        addText(String(pd.palletIndex), colNum, y, { size: 7 });
        addText(pd.traceability || "—", colTraza, y, { size: 6 });
        addRightText(fmt(pd.pieces), colPiezas + 16, y, { size: 7 });
        addRightText(fmt(pd.boxes || 0), colCajas + 14, y, { size: 7 });
        addRightText(fmt(pd.grossWeight, 1), colBruto + 16, y, { size: 7 });
        addRightText(fmt(pd.netWeight, 1), colNeto + 16, y, { size: 7 });
        drawCheckbox(colOk + 1, y);
        // Notes area: just a dotted line
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([0.5, 0.8], 0);
        doc.line(colNotes, y, MARGIN + CONTENT_WIDTH - 1, y);
        doc.setLineDashPattern([], 0);

        y += 4.2;
      });
    }

    // Totals row
    checkPage(6);
    doc.setFillColor(203, 213, 225); // slate-300
    doc.rect(MARGIN, y - 3.2, CONTENT_WIDTH, 5, "F");
    addText("TOTAL", colNum, y, { bold: true, size: 7 });
    addRightText(fmt(p.totalUnits), colPiezas + 16, y, { bold: true, size: 7 });
    const totalBoxes = p.palletDetails?.reduce((s, pd) => s + (pd.boxes || 0), 0) || 0;
    addRightText(fmt(totalBoxes), colCajas + 14, y, { bold: true, size: 7 });
    addRightText(fmt(p.totalGrossWeight, 1), colBruto + 16, y, { bold: true, size: 7 });
    addRightText(fmt(p.totalNetWeight, 1), colNeto + 16, y, { bold: true, size: 7 });
    y += 7;
  });

  // ── Footer summary ──
  checkPage(25);
  y += 2;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y += 5;

  addText("RESUMEN DE CARGA", MARGIN + 2, y, { bold: true, size: 10 });
  y += 5;

  const summaryRows: [string, string][] = [
    ["Total Tarimas", String(totalPallets)],
    ["Total Piezas", fmt(totalUnits)],
    ["Peso Bruto Total", `${fmt(totalGross, 1)} kg`],
    ["Peso Neto Total", `${fmt(totalNet, 1)} kg`],
    ["Productos", String(products.length)],
  ];

  const col1X = MARGIN + 4;
  const col1ValX = MARGIN + 45;
  const col2X = MARGIN + 80;
  const col2ValX = MARGIN + 120;

  for (let i = 0; i < summaryRows.length; i += 2) {
    const [lbl1, val1] = summaryRows[i];
    addText(lbl1, col1X, y, { bold: true, size: 8 });
    addText(val1, col1ValX, y, { size: 8 });
    if (i + 1 < summaryRows.length) {
      const [lbl2, val2] = summaryRows[i + 1];
      addText(lbl2, col2X, y, { bold: true, size: 8 });
      addText(val2, col2ValX, y, { size: 8 });
    }
    y += 4.5;
  }

  y += 6;

  // Final sign-off
  addText("Carga verificada y completa:   ☐ Si   ☐ No", MARGIN + 2, y, { size: 8 });
  y += 6;
  addText("Comentarios: ___________________________________________________________________________________", MARGIN + 2, y, { size: 7 });
  y += 10;
  addText("Firma: _______________________________          Fecha: ______________          Hora: ______________", MARGIN + 2, y, { size: 7 });

  // Download
  const fileName = `Checklist_${loadInfo.loadNumber}_${date}.pdf`;
  doc.save(fileName);
}
