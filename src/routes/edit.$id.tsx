import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShippingLabel } from "@/components/shipping-label";
import {
  COMMON_COURIERS,
  getLabel,
  updateLabel,
  STATUSES,
  type Label,
  type LabelInput,
  type LabelStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit Label — Shipping Labels" },
      { name: "description", content: "Edit an existing shipping label." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditLabelPage,
});

const OTHER = "__other__";

function EditLabelPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["labels", id],
    queryFn: () => getLabel(id),
  });

  const [form, setForm] = useState<LabelInput | null>(null);
  const [courierSelection, setCourierSelection] = useState<string>("");
  const [customCourier, setCustomCourier] = useState("");

  useEffect(() => {
    if (data) {
      setForm({
        receiver_name: data.receiver_name,
        receiver_address_line1: data.receiver_address_line1,
        receiver_address_line2: data.receiver_address_line2 ?? "",
        receiver_city: data.receiver_city,
        receiver_state: data.receiver_state,
        receiver_pincode: data.receiver_pincode,
        receiver_mobile_1: data.receiver_mobile_1,
        receiver_mobile_2: data.receiver_mobile_2 ?? "",
        courier_name: data.courier_name,
        tracking_id: data.tracking_id,
        order_reference: data.order_reference ?? "",
        status: data.status,
        notes: data.notes ?? "",
      });
      if (COMMON_COURIERS.includes(data.courier_name)) {
        setCourierSelection(data.courier_name);
      } else {
        setCourierSelection(OTHER);
        setCustomCourier(data.courier_name);
      }
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: LabelInput) => updateLabel(id, input),
    onSuccess: () => {
      toast.success("Label updated");
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCourier = courierSelection === OTHER ? customCourier : courierSelection;

  const previewLabel: Label | null = useMemo(() => {
    if (!form) return null;
    return {
      id,
      created_at: data?.created_at ?? new Date().toISOString(),
      ...form,
      courier_name: activeCourier || "—",
      tracking_id: form.tracking_id || "—",
      receiver_address_line2: form.receiver_address_line2 || null,
      receiver_mobile_2: form.receiver_mobile_2 || null,
      order_reference: form.order_reference || null,
      notes: form.notes || null,
    };
  }, [form, id, data, activeCourier]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-6 text-destructive">{(error as Error).message}</div>;
  if (!data || !form || !previewLabel)
    return <div className="p-6 text-muted-foreground">Label not found.</div>;

  function set<K extends keyof LabelInput>(key: K, value: LabelInput[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!activeCourier.trim()) {
      toast.error("Courier is required");
      return;
    }
    mutation.mutate({
      ...form,
      courier_name: activeCourier.trim(),
      receiver_address_line2: form.receiver_address_line2?.trim() || null,
      receiver_mobile_2: form.receiver_mobile_2?.trim() || null,
      order_reference: form.order_reference?.trim() || null,
      notes: form.notes?.trim() || null,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Edit label</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Field label="Full name *">
                  <Input value={form.receiver_name} onChange={(e) => set("receiver_name", e.target.value)} required />
                </Field>
                <Field label="Address line 1 *">
                  <Input value={form.receiver_address_line1} onChange={(e) => set("receiver_address_line1", e.target.value)} required />
                </Field>
                <Field label="Address line 2">
                  <Input value={form.receiver_address_line2 ?? ""} onChange={(e) => set("receiver_address_line2", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="City *"><Input value={form.receiver_city} onChange={(e) => set("receiver_city", e.target.value)} required /></Field>
                  <Field label="State *"><Input value={form.receiver_state} onChange={(e) => set("receiver_state", e.target.value)} required /></Field>
                  <Field label="Pincode *"><Input value={form.receiver_pincode} onChange={(e) => set("receiver_pincode", e.target.value)} required /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mobile 1 *"><Input value={form.receiver_mobile_1} onChange={(e) => set("receiver_mobile_1", e.target.value)} required /></Field>
                  <Field label="Mobile 2"><Input value={form.receiver_mobile_2 ?? ""} onChange={(e) => set("receiver_mobile_2", e.target.value)} /></Field>
                </div>
                <Field label="Courier *">
                  <Select value={courierSelection} onValueChange={setCourierSelection}>
                    <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                    <SelectContent>
                      {COMMON_COURIERS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other (type manually)</SelectItem>
                    </SelectContent>
                  </Select>
                  {courierSelection === OTHER && (
                    <Input
                      className="mt-2"
                      value={customCourier}
                      placeholder="Enter courier name"
                      onChange={(e) => setCustomCourier(e.target.value)}
                    />
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tracking / AWB *"><Input value={form.tracking_id} onChange={(e) => set("tracking_id", e.target.value)} required /></Field>
                  <Field label="Order reference"><Input value={form.order_reference ?? ""} onChange={(e) => set("order_reference", e.target.value)} /></Field>
                </div>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => set("status", v as LabelStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes">
                  <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: "/print", search: { ids: id } })}
                >
                  Print this label
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Live preview</div>
          <div className="aspect-[3/4] w-full max-w-sm">
            <ShippingLabel label={previewLabel} size="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <UILabel className="text-xs">{label}</UILabel>
      {children}
    </div>
  );
}
