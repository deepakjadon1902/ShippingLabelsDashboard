import { PackageSearch, PlusCircle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export interface TableEmptyStateProps {
  title?: string;
  description?: string;
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export function TableEmptyState({
  title = "No shipments found",
  description = "No parcels match your current search queries or operational filters.",
  isFiltered = false,
  onClearFilters,
}: TableEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-4 ring-8 ring-muted/20">
        <PackageSearch className="h-7 w-7 text-primary/70" />
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {isFiltered && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="text-xs gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Clear active filters
          </Button>
        )}
        <Button asChild size="sm" className="text-xs gap-1.5">
          <Link to="/create">
            <PlusCircle className="h-3 w-3" />
            Create new shipment
          </Link>
        </Button>
      </div>
    </div>
  );
}
