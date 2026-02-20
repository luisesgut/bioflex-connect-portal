import { useState, useMemo } from "react";
import { Filter, ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FilterableColumnHeaderProps {
  title: string;
  options: string[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (direction: "asc" | "desc" | null) => void;
  showSort?: boolean;
  align?: "left" | "right";
}

export function FilterableColumnHeader({
  title,
  options,
  selectedValues,
  onFilterChange,
  sortDirection,
  onSortChange,
  showSort = false,
  align = "left",
}: FilterableColumnHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const uniqueOptions = [...new Set(options.filter(Boolean))];
    if (!searchQuery) return uniqueOptions;
    return uniqueOptions.filter((option) =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleSelectAll = () => {
    if (selectedValues.length === filteredOptions.length) {
      onFilterChange([]);
    } else {
      onFilterChange(filteredOptions);
    }
  };

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onFilterChange(selectedValues.filter((v) => v !== value));
    } else {
      onFilterChange([...selectedValues, value]);
    }
  };

  const handleClearFilters = () => {
    onFilterChange([]);
    setSearchQuery("");
  };

  const handleSortClick = () => {
    if (!onSortChange) return;
    if (sortDirection === null) {
      onSortChange("asc");
    } else if (sortDirection === "asc") {
      onSortChange("desc");
    } else {
      onSortChange(null);
    }
  };

  const hasActiveFilters = selectedValues.length > 0;

  return (
    <div
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-muted-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto p-0 font-medium uppercase tracking-wider text-xs hover:bg-transparent",
                hasActiveFilters && "text-primary"
              )}
            >
              {title}
              <Filter
                className={cn(
                  "ml-1 h-3 w-3",
                  hasActiveFilters ? "text-primary" : "text-muted-foreground"
                )}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align={align === "right" ? "end" : "start"}>
            <div className="p-2 border-b">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="p-2 border-b flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSelectAll}
              >
                {selectedValues.length === filteredOptions.length ? "Deselect All" : "Select All"}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleClearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No options found
                  </p>
                ) : (
                  filteredOptions.map((option) => (
                    <div
                      key={option}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => handleToggle(option)}
                    >
                      <Checkbox
                        checked={selectedValues.includes(option)}
                        onCheckedChange={() => handleToggle(option)}
                      />
                      <span className="text-sm truncate">{option}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {showSort && onSortChange && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={handleSortClick}
          >
            {sortDirection === "asc" ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : sortDirection === "desc" ? (
              <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
