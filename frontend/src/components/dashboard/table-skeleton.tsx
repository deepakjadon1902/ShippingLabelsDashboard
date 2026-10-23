import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TableSkeleton({ rowCount = 6 }: { rowCount?: number }) {
  return (
    <div className="table-wrapper rounded-md border" tabIndex={0} role="region" aria-label="Loading shipments table">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 text-xs">
            <TableHead className="min-w-[180px]">Customer & Destination</TableHead>
            <TableHead className="min-w-[150px]">AWB & Courier</TableHead>
            <TableHead className="min-w-[130px]">Status & Flags</TableHead>
            <TableHead className="min-w-[160px]">Current Location</TableHead>
            <TableHead className="min-w-[180px]">Latest Activity</TableHead>
            <TableHead className="min-w-[130px]">Delivery Timeline</TableHead>
            <TableHead className="min-w-[90px]">TAT</TableHead>
            <TableHead className="min-w-[110px]">Last Sync</TableHead>
            <TableHead className="text-right min-w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, idx) => (
            <TableRow key={idx} className="hover:bg-transparent">
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-36" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-2.5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded" />
              </TableCell>
              <TableCell className="space-y-1">
                <Skeleton className="h-2.5 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
