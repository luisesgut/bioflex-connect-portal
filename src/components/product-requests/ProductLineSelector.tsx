import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, Layers, Film, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Database still uses bag_no_wicket_zipper and bag_zipper, but UI shows 4 categories
// Sello Lateral handles both with/without zipper via questionnaire
export type ProductLine = 
  | "sello_lateral"
  | "bag_wicket"
  | "film"
  | "pouch";

interface ProductLineOption {
  value: ProductLine;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
}

const productLineOptions: ProductLineOption[] = [
  {
    value: "sello_lateral",
    labelKey: "productLine.sello_lateral",
    descriptionKey: "productLine.sello_lateral.desc",
    icon: Package,
  },
  {
    value: "bag_wicket",
    labelKey: "productLine.bag_wicket",
    descriptionKey: "productLine.bag_wicket.desc",
    icon: Layers,
  },
  {
    value: "film",
    labelKey: "productLine.film",
    descriptionKey: "productLine.film.desc",
    icon: Film,
  },
  {
    value: "pouch",
    labelKey: "productLine.pouch",
    descriptionKey: "productLine.pouch.desc",
    icon: ShoppingBag,
  },
];

interface ProductLineSelectorProps {
  value: ProductLine | null;
  onChange: (value: ProductLine) => void;
}

export function ProductLineSelector({ value, onChange }: ProductLineSelectorProps) {
  const { t } = useLanguage();
  
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
      {productLineOptions.map((line) => {
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
                <CardTitle className="text-base">{t(line.labelKey)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{t(line.descriptionKey)}</CardDescription>
              {isSelected && (
                <Badge className="mt-2" variant="secondary">{t('productLine.selected')}</Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function getProductLineLabel(value: ProductLine, t?: (key: string) => string): string {
  if (t) {
    const option = productLineOptions.find(l => l.value === value);
    return option ? t(option.labelKey) : value;
  }
  // Fallback labels when t is not available
  const fallbackLabels: Record<ProductLine, string> = {
    sello_lateral: "Side Seal Bag",
    bag_wicket: "Wicket Bag",
    film: "Film / Rollstock",
    pouch: "Stand Up Pouch",
  };
  return fallbackLabels[value] || value;
}