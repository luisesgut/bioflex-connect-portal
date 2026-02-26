import * as XLSX from "xlsx";
import * as fs from "fs";

const data = fs.readFileSync("public/temp-potr.xlsx");
const wb = XLSX.read(data);

for (const sheetName of wb.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length > 0) {
    console.log("Columns:", Object.keys(rows[0]));
    console.log("First 3 rows:", JSON.stringify(rows.slice(0, 3), null, 2));
    console.log(`Total rows: ${rows.length}`);
  } else {
    console.log("(empty)");
  }
}
