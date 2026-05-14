import ExcelJS from "exceljs";
import { getWeekRangeLabel, parseISODateLocal } from "@/utils/destinyWeek";
import type { AssignmentRow, DestinyFamily, WeeklyCapacityRow } from "@/hooks/useDestinyPlan";

interface POMeta {
  id: string;
  po_number: string;
  customer: string | null;
  product_name: string | null;
  pt_code: string | null;
  total_quantity: number;
  requested_delivery_date: string | null;
}

interface FacilityClosure {
  closure_date: string;
  facility: string;
  note: string | null;
}

export interface GeneratePOTRParams {
  weekStarts: string[]; // ISO yyyy-mm-dd, sorted asc
  families: DestinyFamily[];
  capacities: WeeklyCapacityRow[];
  assignments: AssignmentRow[];
  poMap: Map<string, POMeta>;
  closures: FacilityClosure[];
  fileName?: string;
}

export async function generateDestinyPOTR(params: GeneratePOTRParams): Promise<void> {
  const { weekStarts, families, capacities, assignments, poMap, closures } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bioflex Portal";
  wb.created = new Date();

  // ----- Sheet 1: Open POs by Week + Family -----
  const ws = wb.addWorksheet("Open POs");
  ws.columns = [
    { header: "Week", key: "week", width: 22 },
    { header: "Family", key: "family", width: 22 },
    { header: "PO #", key: "po", width: 14 },
    { header: "Customer", key: "customer", width: 26 },
    { header: "Item", key: "item", width: 30 },
    { header: "PT Code", key: "pt", width: 14 },
    { header: "Assigned Qty", key: "qty", width: 14 },
    { header: "PO Total Qty", key: "total", width: 14 },
    { header: "Requested Delivery", key: "del", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  const familyById = new Map(families.map((f) => [f.id, f]));
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.week_start !== b.week_start) return a.week_start.localeCompare(b.week_start);
    const fa = familyById.get(a.family_id)?.sort_order ?? 0;
    const fb = familyById.get(b.family_id)?.sort_order ?? 0;
    return fa - fb;
  });

  for (const a of sortedAssignments) {
    if (!weekStarts.includes(a.week_start)) continue;
    const family = familyById.get(a.family_id);
    const po = poMap.get(a.purchase_order_id);
    ws.addRow({
      week: getWeekRangeLabel(parseISODateLocal(a.week_start)),
      family: family?.name ?? "—",
      po: po?.po_number ?? "—",
      customer: po?.customer ?? "",
      item: po?.product_name ?? "",
      pt: po?.pt_code ?? "",
      qty: a.assigned_quantity,
      total: po?.total_quantity ?? 0,
      del: po?.requested_delivery_date ?? "",
    });
  }

  // ----- Sheet 2: Capacity by Week -----
  const wsCap = wb.addWorksheet("Weekly Capacity");
  const capCols: Partial<ExcelJS.Column>[] = [
    { header: "Family", key: "family", width: 24 },
    ...weekStarts.map((w) => ({
      header: getWeekRangeLabel(parseISODateLocal(w)),
      key: w,
      width: 18,
    })),
  ];
  wsCap.columns = capCols as ExcelJS.Column[];
  wsCap.getRow(1).font = { bold: true };

  const capByKey = new Map(capacities.map((c) => [`${c.family_id}__${c.week_start}`, c.weekly_capacity]));
  for (const f of families) {
    const row: Record<string, unknown> = { family: f.name };
    for (const w of weekStarts) {
      row[w] = capByKey.get(`${f.id}__${w}`) ?? f.default_weekly_capacity;
    }
    wsCap.addRow(row);
  }

  // Used capacity row
  wsCap.addRow({});
  const usageHead = wsCap.addRow({ family: "ASSIGNED" });
  usageHead.font = { bold: true };
  for (const f of families) {
    const row: Record<string, unknown> = { family: f.name };
    for (const w of weekStarts) {
      const used = assignments
        .filter((a) => a.family_id === f.id && a.week_start === w)
        .reduce((s, a) => s + Number(a.assigned_quantity), 0);
      row[w] = used;
    }
    wsCap.addRow(row);
  }

  // ----- Sheet 3: Facility Closures -----
  const wsCl = wb.addWorksheet("Facility Closures");
  wsCl.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Facility", key: "facility", width: 18 },
    { header: "Note", key: "note", width: 40 },
  ];
  wsCl.getRow(1).font = { bold: true };
  for (const c of [...closures].sort((a, b) => a.closure_date.localeCompare(b.closure_date))) {
    wsCl.addRow({ date: c.closure_date, facility: c.facility, note: c.note ?? "" });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = params.fileName ?? `POTR_Destiny_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export type { POMeta, FacilityClosure };
