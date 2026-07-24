import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { Printer, ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
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
import { listLabels, type Label } from "@/lib/labels";
import { useWebsiteName } from "@/lib/settings";

const searchSchema = z.object({
  ids: z.string().optional(),
});

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print Labels — ShippingLabelsDashboard" },
      { name: "description", content: "Select labels and print them on A4 in flexible grid layouts." },
      { property: "og:title", content: "Print Labels — ShippingLabelsDashboard" },
      { property: "og:description", content: "Print your saved shipping labels on A4." },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: PrintPage,
});

type LayoutKey = "single" | "half2" | "grid4" | "grid8";

interface LayoutConfig {
  key: LayoutKey;
  title: string;
  description: string;
  perPage: number;
  pageClass: string;
  size: "full" | "half" | "compact" | "mini";
}

const LAYOUTS: Record<LayoutKey, LayoutConfig> = {
  single: {
    key: "single",
    title: "1 per page (Large)",
    description: "Full A4 — big QR, big barcode, big text",
    perPage: 1,
    pageClass: "print-page-single",
    size: "full",
  },
  half2: {
    key: "half2",
    title: "2 per page (Half page each)",
    description: "Top and bottom half — each label fills its half",
    perPage: 2,
    pageClass: "print-grid-half2",
    size: "half",
  },
  grid4: {
    key: "grid4",
    title: "4 per page (2×2 grid)",
    description: "Classic 4-up grid",
    perPage: 4,
    pageClass: "print-grid-4",
    size: "compact",
  },
  grid8: {
    key: "grid8",
    title: "8 per page (2×4 grid)",
    description: "Compact 2 columns by 4 rows",
    perPage: 8,
    pageClass: "print-grid-8",
    size: "mini",
  },
};

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function PrintPage() {
  const { ids } = Route.useSearch();
  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [layoutKey, setLayoutKey] = useState<LayoutKey>("grid4");
  const [websiteName, setWebsiteNameValue] = useWebsiteName();

  useEffect(() => {
    if (ids) setSelected(new Set(ids.split(",").filter(Boolean)));
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

  const selectedLabels: Label[] = useMemo(
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

  // If only 1 selected, use single-page automatically for a nicer default,
  // unless the user explicitly picked a grid layout other than grid4.
  const effectiveLayout: LayoutConfig =
    selectedLabels.length === 1 && layoutKey === "grid4" ? LAYOUTS.single : LAYOUTS[layoutKey];

  const pages = useMemo(
    () => chunk(selectedLabels, effectiveLayout.perPage),
    [selectedLabels, effectiveLayout.perPage],
  );

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
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={layoutKey} onValueChange={(v) => setLayoutKey(v as LayoutKey)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LAYOUTS).map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => window.print()} disabled={!canPrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print {selectedLabels.length > 0 ? `(${selectedLabels.length})` : ""}
            </Button>
          </div>
        </div>

        {/* Settings row */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <UILabel htmlFor="site" className="text-xs uppercase tracking-wider text-muted-foreground">
                Website name (shown on every label footer)
              </UILabel>
              <Input
                id="site"
                value={websiteName}
                onChange={(e) => setWebsiteNameValue(e.target.value)}
                placeholder="shriradhagovindstore.com"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              "Thank you for your order — {websiteName || "your site"}" appears on every label.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Select labels to print</CardTitle>
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {selected.size === filtered.length && filtered.length > 0 ? "Clear" : "Select all"}
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
                  <div className="p-6 text-center text-muted-foreground text-sm">No labels found.</div>
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
              <CardTitle>
                Preview · {effectiveLayout.title} ({selectedLabels.length} selected)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLabels.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  Pick one or more labels on the left to preview and print.
                </div>
              ) : (
                <div className="space-y-4 max-h-[640px] overflow-y-auto">
                  {pages.map((page, pi) => (
                    <div
                      key={pi}
                      className="border rounded-md bg-white p-3 shadow-sm"
                      style={{ aspectRatio: "210 / 297" }}
                    >
                      <PreviewGrid layout={effectiveLayout} page={page} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print area — kept in the DOM (off-screen) so QR/barcode SVGs render. */}
      <div className="print-area" aria-hidden>
        {pages.map((page, pi) => (
          <div key={pi} className={"print-page " + effectiveLayout.pageClass}>
            {effectiveLayout.key === "single"
              ? page.map((l) => <ShippingLabel key={l.id} label={l} size="full" />)
              : page.map((l) => (
                  <div key={l.id} className="print-cell">
                    <ShippingLabel label={l} size={effectiveLayout.size} />
                  </div>
                ))}
          </div>
        ))}
      </div>
    </>
  );
}

function PreviewGrid({ layout, page }: { layout: LayoutConfig; page: Label[] }) {
  if (layout.key === "single") {
    return (
      <div className="h-full">
        {page.map((l) => (
          <ShippingLabel key={l.id} label={l} size="full" />
        ))}
      </div>
    );
  }

  if (layout.key === "half2") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr 1fr",
          gap: "4mm",
          height: "100%",
        }}
      >
        {page.map((l) => (
          <div key={l.id} className="min-w-0 min-h-0 flex">
            <ShippingLabel label={l} size="half" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "3mm",
        alignContent: "start",
      }}
    >
      {page.map((l) => (
        <div key={l.id} className="min-w-0">
          <ShippingLabel label={l} size={layout.size} />
        </div>
      ))}
    </div>
  );
}
