import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShippingLabel } from "@/components/shipping-label";
import type { Label as ShipLabel } from "@/lib/labels";
import { getTrackingCredsStatus } from "@/lib/tracking.functions";
import { useSenderProfiles, type SenderProfile } from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Sender Profiles & Courier APIs" },
      { name: "description", content: "Manage return-address profiles and courier tracking API keys." },
      { property: "og:title", content: "Settings — Sender Profiles & Courier APIs" },
      { property: "og:description", content: "Manage return-address profiles and courier tracking API keys." },
    ],
  }),
  component: SettingsPage,
});

function CredRow({ label, configured, note }: { label: string; configured: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <KeyRound className="h-4 w-4 mt-1 text-muted-foreground" />
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
        </div>
      </div>
      {configured ? (
        <Badge className="bg-green-100 text-green-900 border-green-200 gap-1" variant="outline">
          <CheckCircle2 className="h-3 w-3" /> Configured
        </Badge>
      ) : (
        <Badge className="bg-red-100 text-red-900 border-red-200 gap-1" variant="outline">
          <XCircle className="h-3 w-3" /> Missing
        </Badge>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  saved,
  onChange,
  onSave,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  saved: string;
  onChange: (v: string) => void;
  onSave: () => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const dirty = value !== saved;
  return (
    <div className="space-y-1.5">
      <UILabel className="text-xs">{label}</UILabel>
      <div className="flex gap-2 items-start">
        {multiline ? (
          <Textarea
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        ) : (
          <Input
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        )}
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={!dirty}
          onClick={onSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function SenderEditor({
  title,
  value,
  onChange,
  onSaveField,
  saved,
}: {
  title: string;
  value: SenderProfile;
  onChange: (v: SenderProfile) => void;
  onSaveField: (key: keyof SenderProfile) => void;
  saved: SenderProfile;
}) {
  function set<K extends keyof SenderProfile>(key: K, v: SenderProfile[K]) {
    onChange({ ...value, [key]: v });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldRow
          label="Company name"
          value={value.name}
          saved={saved.name}
          onChange={(v) => set("name", v)}
          onSave={() => onSaveField("name")}
        />
        <FieldRow
          label="Full address"
          multiline
          value={value.address}
          saved={saved.address}
          onChange={(v) => set("address", v)}
          onSave={() => onSaveField("address")}
        />
        <FieldRow
          label="Phone"
          value={value.phone}
          saved={saved.phone}
          onChange={(v) => set("phone", v)}
          onSave={() => onSaveField("phone")}
        />
        <FieldRow
          label="Website"
          value={value.website}
          saved={saved.website}
          onChange={(v) => set("website", v)}
          onSave={() => onSaveField("website")}
        />
        <FieldRow
          label="Google Review link"
          value={value.review_url}
          saved={saved.review_url}
          placeholder="https://g.page/r/xxxxxxxx/review"
          onChange={(v) => set("review_url", v)}
          onSave={() => onSaveField("review_url")}
        />
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const fetchCreds = useServerFn(getTrackingCredsStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["tracking-creds"],
    queryFn: () => fetchCreds(),
  });

  const [profiles, saveProfiles] = useSenderProfiles();
  const [draft, setDraft] = useState<[SenderProfile, SenderProfile]>(profiles);
  const [previewIdx, setPreviewIdx] = useState<0 | 1>(0);

  // Keep the draft in sync when profiles change from another tab.
  // Simple approach: reset draft to persisted whenever we mount.
  // (We're not using useEffect to avoid overwriting user edits on save.)

  const previewSender = draft[previewIdx];
  const previewLabel: ShipLabel = {
    id: "preview",
    created_at: new Date().toISOString(),
    receiver_name: "Ramesh Kumar",
    receiver_address_line1: "12, Radha Nagar, Near Iskcon Temple",
    receiver_address_line2: "Opp. Central Park",
    receiver_city: "Vrindavan",
    receiver_state: "Uttar Pradesh",
    receiver_pincode: "281121",
    receiver_mobile_1: "9876543210",
    receiver_mobile_2: null,
    courier_name: "Delhivery",
    tracking_id: "1234567890",
    order_reference: "SRG-0001",
    status: "Pending",
    notes: null,
    sender_name: previewSender.name || null,
    sender_address: previewSender.address || null,
    sender_phone: previewSender.phone || null,
    sender_website: previewSender.website || null,
    sender_review_url: previewSender.review_url || null,
  };

  function handleSave() {
    saveProfiles(draft);
    toast.success("Sender profiles saved");
  }

  function handleReset() {
    setDraft(profiles);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage sender return-address profiles and courier tracking API keys.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Sender profiles</h3>
            <p className="text-sm text-muted-foreground">
              Save two return addresses. Pick one on each label. Past labels keep their snapshot.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
            <Button onClick={handleSave}>Save profiles</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SenderEditor
            title="Profile 1"
            value={draft[0]}
            onChange={(v) => setDraft([v, draft[1]])}
          />
          <SenderEditor
            title="Profile 2"
            value={draft[1]}
            onChange={(v) => setDraft([draft[0], v])}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sample label preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={previewIdx === 0 ? "default" : "outline"}
                onClick={() => setPreviewIdx(0)}
              >
                Preview with Profile 1
              </Button>
              <Button
                size="sm"
                variant={previewIdx === 1 ? "default" : "outline"}
                onClick={() => setPreviewIdx(1)}
              >
                Preview with Profile 2
              </Button>
            </div>
            <div className="w-full max-w-md">
              <ShippingLabel label={previewLabel} size="compact" />
            </div>
            <p className="text-xs text-muted-foreground">
              Save profiles above to lock in changes. The preview updates live as you edit.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Live tracking credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : (
            <>
              <CredRow
                label="Delhivery API token"
                configured={!!data?.delhivery}
                note="Direct API. Used for labels where Courier = Delhivery."
              />
              <CredRow
                label="DTDC API token"
                configured={!!data?.dtdc}
                note="Direct API. Used for labels where Courier = DTDC."
              />
              <CredRow
                label="TrackingMore API key"
                configured={!!data?.trackingmore}
                note="Unified tracker for Shadowfax, Xpressbees, Ecom Express, India Post, Shree Maruti."
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to update or rotate keys</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            To add, replace or rotate any of the keys above, just tell the assistant in chat —
            e.g. <em>"update my Delhivery API token"</em> — and a secure prompt will open for
            you to paste the value. Keys are stored on the server and used only by the twice-daily
            refresh job and the manual "Refresh" buttons on the dashboard.
          </p>
          <p>
            Automatic refresh runs at <strong>09:00 IST</strong> and <strong>18:00 IST</strong> daily.
            Only labels whose status is not Delivered or RTO are processed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
