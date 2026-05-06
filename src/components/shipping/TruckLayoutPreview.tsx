import { useMemo } from "react";

const DEST_COLORS = [
  { bg: "bg-blue-500", text: "text-white", hex: "#3b82f6" },
  { bg: "bg-amber-500", text: "text-white", hex: "#f59e0b" },
  { bg: "bg-emerald-500", text: "text-white", hex: "#10b981" },
  { bg: "bg-rose-500", text: "text-white", hex: "#f43f5e" },
  { bg: "bg-violet-500", text: "text-white", hex: "#8b5cf6" },
  { bg: "bg-cyan-500", text: "text-white", hex: "#06b6d4" },
];

export const DEST_COLOR_PALETTE = DEST_COLORS;

export interface TruckSlot {
  destination: string;
  colorIndex: number;
}

export function buildTruckSlots(
  destinationOrder: string[],
  palletsByDestination: Record<string, number>
): TruckSlot[] {
  const slots: TruckSlot[] = [];
  // Fill from position 0 (doors/rear) upward
  destinationOrder.forEach((dest, colorIndex) => {
    const count = palletsByDestination[dest] || 0;
    for (let i = 0; i < count; i++) {
      if (slots.length >= 30) break;
      slots.push({ destination: dest, colorIndex: colorIndex % DEST_COLORS.length });
    }
  });
  return slots;
}

interface TruckLayoutPreviewProps {
  destinationOrder: string[];
  palletsByDestination: Record<string, number>;
  getDestinationLabel?: (code: string) => string;
}

export function TruckLayoutPreview({
  destinationOrder,
  palletsByDestination,
  getDestinationLabel,
}: TruckLayoutPreviewProps) {
  const slots = useMemo(
    () => buildTruckSlots(destinationOrder, palletsByDestination),
    [destinationOrder, palletsByDestination]
  );

  const label = (code: string) => (getDestinationLabel ? getDestinationLabel(code) : code);

  // Grid: 2 columns x 15 rows. Row 0 = doors (bottom of visual), row 14 = front
  const rows = 15;
  const grid: (TruckSlot | null)[][] = Array.from({ length: rows }, () => [null, null]);

  // Fill: slot 0 → row 0 col 0, slot 1 → row 0 col 1, slot 2 → row 1 col 0, etc.
  slots.forEach((slot, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    if (row < rows) grid[row][col] = slot;
  });

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {destinationOrder.map((dest, i) => {
          const c = DEST_COLORS[i % DEST_COLORS.length];
          const count = palletsByDestination[dest] || 0;
          return (
            <div key={dest} className="flex items-center gap-1.5 text-xs">
              <span className={`inline-block w-3 h-3 rounded-sm ${c.bg}`} />
              <span className="font-medium">{label(dest)}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          );
        })}
      </div>

      {/* Truck diagram */}
      <div className="border rounded-lg p-2 bg-muted/20 inline-block">
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium">
          FRENTE DEL CAMIÓN
        </p>

        <div className="border-2 border-muted-foreground/30 rounded-md overflow-hidden">
          {/* Rows from top (front) to bottom (doors) */}
          {[...grid].reverse().map((row, visualRow) => (
            <div key={visualRow} className="flex">
              {row.map((slot, col) => {
                const c = slot ? DEST_COLORS[slot.colorIndex] : null;
                return (
                  <div
                    key={col}
                    className={`w-10 h-6 border border-muted-foreground/20 flex items-center justify-center text-[8px] font-bold ${
                      c ? `${c.bg} ${c.text}` : "bg-muted/40 text-muted-foreground/30"
                    }`}
                  >
                    {slot ? (slot.destination.length > 4 ? slot.destination.slice(0, 4) : slot.destination) : "·"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-1 font-medium">
          ← COMPUERTAS →
        </p>
      </div>
    </div>
  );
}
