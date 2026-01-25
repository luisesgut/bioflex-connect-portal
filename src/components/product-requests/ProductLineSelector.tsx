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
    label: "Bag (No Wicket/Zipper)",
    description: "Side seal bags without wicket or zipper closure",
    icon: Package,
  },
  {
    value: "bag_wicket",
    label: "Bag Wicket",
    description: "Bags with wicket for automated packaging lines",
    icon: Layers,
  },
  {
    value: "bag_zipper",
    label: "Bag with Zipper",
    description: "Side seal bags with zipper/resealable closure",
    icon: Archive,
  },
  {
    value: "film",
    label: "Film / Roll Stock",
    description: "Printed film rolls for form-fill-seal machines",
    icon: Film,
  },
  {
    value: "pouch",
    label: "Stand Up Pouch",
    description: "Laminated stand up pouches with bottom gusset",
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