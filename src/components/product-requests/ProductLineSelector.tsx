import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, Layers, Archive, Film, ShoppingBag } from "lucide-react";

export type ProductLine = 
  | "bag_no_wicket_zipper"
  | "bag_wicket"
  | "bag_zipper"
  | "film"
  | "pouch";

interface ProductLineOption {
  value: ProductLine;
  label: string;
  description: string;
  icon: React.ElementType;
}

const productLines: ProductLineOption[] = [
  {
    value: "bag_no_wicket_zipper",
    label: "Sello Lateral (Sin Wicket/Zipper)",
    description: "Bolsas de sello lateral sin wicket ni zipper",
    icon: Package,
  },
  {
    value: "bag_wicket",
    label: "Bolsa Wicket",
    description: "Bolsas con wicket para líneas de empaque automatizado",
    icon: Layers,
  },
  {
    value: "bag_zipper",
    label: "Sello Lateral con Zipper",
    description: "Bolsas de sello lateral con cierre resellable",
    icon: Archive,
  },
  {
    value: "film",
    label: "Bobina / Rollstock",
    description: "Rollos de película impresos para máquinas form-fill-seal",
    icon: Film,
  },
  {
    value: "pouch",
    label: "Stand Up Pouch",
    description: "Pouches laminados con fuelle de fondo (Doypack)",
    icon: ShoppingBag,
  },
];

interface ProductLineSelectorProps {
  value: ProductLine | null;
  onChange: (value: ProductLine) => void;
}

export function ProductLineSelector({ value, onChange }: ProductLineSelectorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {productLines.map((line) => {
        const Icon = line.icon;
        const isSelected = value === line.value;
        
        return (
          <Card
            key={line.value}
            className={cn(
              "cursor-pointer transition-all hover:border-primary/50",
              isSelected && "border-primary ring-2 ring-primary/20"
            )}
            onClick={() => onChange(line.value)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{line.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{line.description}</CardDescription>
              {isSelected && (
                <Badge className="mt-2" variant="secondary">Selected</Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function getProductLineLabel(value: ProductLine): string {
  return productLines.find(l => l.value === value)?.label || value;
}