import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  createLabel,
  STATUSES,
  type Label,
  type LabelInput,
  type LabelStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create Label — Shipping Labels" },
      { name: "description", content: "Add a new parcel label with receiver details, courier and tracking." },
      { property: "og:title", content: "Create Label — Shipping Labels" },
      { property: "og:description", content: "Add a new parcel label with receiver details, courier and tracking." },
    ],
  }),
  component: CreateLabelPage,
});

const OTHER = "__other__";

const emptyForm: LabelInput = {
  receiver_name: "",
  receiver_address_line1: "",
  receiver_address_line2: "",
  receiver_city: "",
  receiver_state: "",
  receiver_pincode: "",
  receiver_mobile_1: "",
  receiver_mobile_2: "",
  courier_name: "",
  tracking_id: "",
  order_reference: "",
  status: "Pending",
  notes: "",
};

function CreateLabelPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LabelInput>(emptyForm);
  const [courierSelection, setCourierSelection] = useState<string>("");
  const [customCourier, setCustomCourier] = useState("");
  const [saved, setSaved] = useState<Label | null>(null);

  const activeCourier = courierSelection === OTHER ? customCourier : courierSelection;

  const isValid = useMemo(() => {
    return (
      form.receiver_name.trim() &&
      form.receiver_address_line1.trim() &&
      form.receiver_city.trim() &&
      form.receiver_state.trim() &&
      form.receiver_pincode.trim() &&
      form.receiver_mobile_1.trim() &&
      activeCourier.trim() &&
      form.tracking_id.trim()
    );
  }, [form, activeCourier]);

  const previewLabel: Label = {
    id: "preview",
    created_at: new Date().toISOString(),
    ...form,
    courier_name: activeCourier || "—",
    tracking_id: form.tracking_id || "—",
    receiver_address_line2: form.receiver_address_line2 || null,
    receiver_mobile_2: form.receiver_mobile_2 || null,
    order_reference: form.order_reference || null,
    notes: form.notes || null,
  };

  const mutation = useMutation({
    mutationFn: (input: LabelInput) => createLabel(input),
    onSuccess: (data) => {
      setSaved(data);
      toast.success("Label saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please fill all required fields");
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

  function set<K extends keyof LabelInput>(key: K, value: LabelInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>New shipping label</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Section title="Receiver">
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
                <Field label="City *">
                  <Input value={form.receiver_city} onChange={(e) => set("receiver_city", e.target.value)} required />
                </Field>
                <Field label="State *">
                  <Input value={form.receiver_state} onChange={(e) => set("receiver_state", e.target.value)} required />
                </Field>
                <Field label="Pincode *">
                  <Input value={form.receiver_pincode} onChange={(e) => set("receiver_pincode", e.target.value)} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile 1 *">
                  <Input value={form.receiver_mobile_1} onChange={(e) => set("receiver_mobile_1", e.target.value)} required />
                </Field>
                <Field label="Mobile 2">
                  <Input value={form.receiver_mobile_2 ?? ""} onChange={(e) => set("receiver_mobile_2", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section title="Shipment">
              <Field label="Courier *">
                <Select value={courierSelection} onValueChange={setCourierSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
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
                    placeholder="Enter courier name"
                    value={customCourier}
                    onChange={(e) => setCustomCourier(e.target.value)}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tracking / AWB *">
                  <Input value={form.tracking_id} onChange={(e) => set("tracking_id", e.target.value)} required />
                </Field>
                <Field label="Order reference">
                  <Input value={form.order_reference ?? ""} onChange={(e) => set("order_reference", e.target.value)} />
                </Field>
              </div>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v as LabelStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </Section>

            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save label"}
              </Button>
              {saved && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate({ to: "/print", search: { ids: saved.id } })
                    }
                  >
                    Print this label
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setForm(emptyForm);
                      setCourierSelection("");
                      setCustomCourier("");
                      setSaved(null);
                    }}
                  >
                    Create another
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Live preview</div>
        <div className="aspect-[3/4] w-full max-w-sm">
          <ShippingLabel label={previewLabel} size="compact" />
        </div>
        <p className="text-xs text-muted-foreground">
          This is roughly how each label will print. The QR encodes the tracking URL when a known courier is selected, otherwise the tracking ID itself.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
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
