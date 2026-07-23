import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { Printer, ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShippingLabel } from "@/components/shipping-label";
import { listLabels } from "@/lib/labels";

const searchSchema = z.object({
  ids: z.string().optional(),
});

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print Labels — Shipping Labels" },
      { name: "description", content: "Select labels and print them on A4 in a 4-up grid or full-page single." },
      { property: "og:title", content: "Print Labels — Shipping Labels" },
      { property: "og:description", content: "Print your saved shipping labels on A4." },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: PrintPage,
});

function PrintPage() {
  const { ids } = Route.useSearch();
  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "single">("grid");

  // Preselect from ?ids= query param
  useEffect(() => {
    if (ids) {
      setSelected(new Set(ids.split(",").filter(Boolean)));
    }
  }, [ids]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return labels;
    return labels.filter(
      (l) =>
        l.receiver_name.toLowerCase().includes(s) ||
        l.tracking_id.toLowerCase().includes(s) ||
        (l.order_reference ?? "").toLowerCase().includes(s),
    );
  }, [labels, search]);

  const selectedLabels = useMemo(
    () => labels.filter((l) => selected.has(l.id)),
    [labels, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }

  const canPrint = selectedLabels.length > 0;
  const effectiveLayout: "grid" | "single" =
    layout === "single" || selectedLabels.length === 1 ? "single" : "grid";

  // Chunk into pages of 4 for grid layout
  const pages: (typeof selectedLabels)[] = useMemo(() => {
    if (effectiveLayout === "single") return selectedLabels.map((l) => [l]);
    const chunks: (typeof selectedLabels)[] = [];
    for (let i = 0; i < selectedLabels.length; i += 4) {
      chunks.push(selectedLabels.slice(i, i + 4));
    }
    return chunks;
  }, [selectedLabels, effectiveLayout]);

  return (
    <>
      {/* Screen UI */}
      <div className="no-print p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <div className="flex gap-2 items-center">
            <Select value={layout} onValueChange={(v) => setLayout(v as "grid" | "single")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">A4 • 4 labels per page</SelectItem>
                <SelectItem value="single">A4 • 1 label per page</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => window.print()} disabled={!canPrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print {selectedLabels.length > 0 ? `(${selectedLabels.length})` : ""}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Select labels to print</CardTitle>
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {selected.size === filtered.length && filtered.length > 0
                  ? "Clear"
                  : "Select all"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search name, tracking ID, order ref…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="rounded-md border max-h-[520px] overflow-y-auto divide-y">
                {isLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No labels found.
                  </div>
                ) : (
                  filtered.map((l) => (
                    <label
                      key={l.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggle(l.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{l.receiver_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.courier_name} • <span className="font-mono">{l.tracking_id}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleDateString()}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview ({selectedLabels.length} selected)</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLabels.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  Pick one or more labels on the left to preview and print.
                </div>
              ) : (
                <div className="space-y-4 max-h-[560px] overflow-y-auto">
                  {pages.map((page, pi) => (
                    <div
                      key={pi}
                      className="border rounded-md bg-white p-3 shadow-sm"
                      style={{ aspectRatio: "210 / 297" }}
                    >
                      <div
                        className={
                          effectiveLayout === "single"
                            ? "h-full"
                            : "grid grid-cols-2 grid-rows-2 gap-2 h-full"
                        }
                      >
                        {page.map((l) => (
                          <ShippingLabel
                            key={l.id}
                            label={l}
                            size={effectiveLayout === "single" ? "full" : "compact"}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print area — kept in the DOM (off-screen) so QR/barcode SVGs
          render before print, then shown by @media print CSS. */}
      <div className="print-area" aria-hidden>
        {effectiveLayout === "grid"
          ? pages.map((page, pi) => (
              <div key={pi} className="print-page print-grid">
                {page.map((l) => (
                  <div key={l.id} className="print-cell">
                    <ShippingLabel label={l} size="compact" />
                  </div>
                ))}
              </div>
            ))
          : selectedLabels.map((l, i) => (
              <div
                key={l.id}
                className="print-page print-page-single"
                data-last={i === selectedLabels.length - 1 ? "true" : undefined}
              >
                <ShippingLabel label={l} size="full" />
              </div>
            ))}
      </div>
    </>
  );
}
