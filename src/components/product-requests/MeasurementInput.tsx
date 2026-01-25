import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MeasurementInputProps {
  id: string;
  label: string;
  valueInches: string;
  onChange: (valueInches: string) => void;
  placeholder?: string;
  className?: string;
}

// Convert inches to cm
function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function MeasurementInput({
  id,
  label,
  valueInches,
  onChange,
  placeholder = "0",
  className,
}: MeasurementInputProps) {
  const numValue = parseFloat(valueInches);
  const cmValue = !isNaN(numValue) ? inchesToCm(numValue).toFixed(2) : "";

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="relative">
            <Input
              id={id}
              type="number"
              step="0.01"
              value={valueInches}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              in
            </span>
          </div>
        </div>
        <div className="w-24">
          <div className="relative">
            <Input
              type="text"
              value={cmValue}
              disabled
              className="bg-muted pr-10 text-muted-foreground"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              cm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThicknessInputProps {
  id: string;
  label: string;
  value: string;
  unit: "gauge" | "microns";
  onValueChange: (value: string) => void;
  onUnitChange: (unit: "gauge" | "microns") => void;
  className?: string;
}

// Convert gauge to microns (1 gauge ≈ 0.254 microns or 1 mil = 25.4 microns)
function gaugeToMicrons(gauge: number): number {
  return gauge * 25.4; // gauge in mils to microns
}

function micronsToGauge(microns: number): number {
  return microns / 25.4;
}

export function ThicknessInput({
  id,
  label,
  value,
  unit,
  onValueChange,
  onUnitChange,
  className,
}: ThicknessInputProps) {
  const numValue = parseFloat(value);
  const convertedValue = !isNaN(numValue)
    ? unit === "gauge"
      ? gaugeToMicrons(numValue).toFixed(1)
      : micronsToGauge(numValue).toFixed(2)
    : "";
  const convertedUnit = unit === "gauge" ? "μm" : "ga";

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="relative">
            <Input
              id={id}
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="0"
              className="pr-12"
            />
            <select
              value={unit}
              onChange={(e) => onUnitChange(e.target.value as "gauge" | "microns")}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-sm bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              <option value="gauge">ga</option>
              <option value="microns">μm</option>
            </select>
          </div>
        </div>
        <div className="w-24">
          <div className="relative">
            <Input
              type="text"
              value={convertedValue}
              disabled
              className="bg-muted pr-10 text-muted-foreground"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {convertedUnit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}