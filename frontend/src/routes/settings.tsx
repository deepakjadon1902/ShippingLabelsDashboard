import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShippingLabel } from "@/components/shipping-label";
import {
  getTrackingCredsStatus,
  getTrackingControls,
  updateTrackingControls,
  resetTrackingCircuitBreaker,
  type Label as ShipLabel,
  type TrackingUsageStats,
} from "@/lib/labels";
import {
  createSenderProfile,
  deleteSenderProfile,
  listSenderProfiles,
  updateSenderProfile,
  type SenderProfile,
} from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings - Sender Profiles & Courier APIs" },
      {
        name: "description",
        content: "Manage return-address profiles and courier tracking API keys.",
      },
    ],
  }),
  component: SettingsPage,
});

function CredRow({
  label,
  configured,
  note,
}: {
  label: string;
  configured: boolean;
  note: string;
}) {
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

function formatProviderName(providerKey: string): string {
  switch (providerKey) {
    case "trackcourier_account1":
      return "TrackCourier (Account 1 - Primary)";
    case "trackcourier_account2":
      return "TrackCourier (Account 2 - Secondary)";
    case "trackcourier_account3":
      return "TrackCourier (Account 3 - Tertiary)";
    case "delhivery":
      return "Delhivery Direct";
    case "dtdc":
      return "DTDC Direct";
    case "shadowfax":
      return "Shadowfax Direct";
    case "ekart":
      return "Ekart Logistics";
    case "shree_maruti":
      return "Shree Maruti Courier";
    default:
      return providerKey;
  }
}

function emptyDraft(profile?: SenderProfile): SenderProfile {
  return {
    id: profile?.id ?? "",
    name: profile?.name ?? "",
    address: profile?.address ?? "",
    phone: profile?.phone ?? "",
    website: profile?.website ?? "",
    review_url: profile?.review_url ?? "",
    sort_order: profile?.sort_order ?? 0,
  };
}

function isMongoId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function SettingsPage() {
  const qc = useQueryClient();
  const { data: creds, isLoading: credsLoading } = useQuery({
    queryKey: ["tracking-creds"],
    queryFn: getTrackingCredsStatus,
  });
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["sender-profiles"],
    queryFn: listSenderProfiles,
  });
  const { data: trackingStats, isLoading: statsLoading } = useQuery({
    queryKey: ["tracking-controls"],
    queryFn: getTrackingControls,
  });

  const resetBreakerMutation = useMutation({
    mutationFn: (provider: string) => resetTrackingCircuitBreaker(provider),
    onSuccess: (_data, provider) => {
      qc.invalidateQueries({ queryKey: ["tracking-controls"] });
      toast.success(`Circuit breaker for ${formatProviderName(provider)} reset`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to reset breaker: ${err.message}`);
    },
  });

  const updateControlsMutation = useMutation({
    mutationFn: (updates: Partial<TrackingUsageStats["settings"]>) => updateTrackingControls(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracking-controls"] });
      toast.success("Tracking settings updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update settings: ${err.message}`);
    },
  });

  const [drafts, setDrafts] = useState<Record<string, SenderProfile>>({});
  const [previewId, setPreviewId] = useState<string>("");

  useEffect(() => {
    setDrafts(Object.fromEntries(profiles.map((profile) => [profile.id, emptyDraft(profile)])));
    if (!previewId && profiles[0]) setPreviewId(profiles[0].id);
    if (previewId && !profiles.some((profile) => profile.id === previewId)) {
      setPreviewId(profiles[0]?.id ?? "");
    }
  }, [profiles, previewId]);

  const saveMutation = useMutation({
    mutationFn: (profile: SenderProfile) => {
      if (!isMongoId(profile.id)) throw new Error("Refresh profiles before saving this profile");
      return updateSenderProfile(profile.id, profile);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sender-profiles"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createSenderProfile({
        name: `Profile ${profiles.length + 1}`,
        sort_order: profiles.length,
      }),
    onSuccess: async (profile) => {
      await qc.invalidateQueries({ queryKey: ["sender-profiles"] });
      setPreviewId(profile.id);
      toast.success("Profile added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!isMongoId(id)) throw new Error("Refresh profiles before deleting this profile");
      return deleteSenderProfile(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sender-profiles"] });
      toast.success("Profile deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewSender = useMemo(
    () => drafts[previewId] ?? profiles.find((profile) => profile.id === previewId) ?? profiles[0],
    [drafts, previewId, profiles],
  );

  const previewLabel: ShipLabel | null = previewSender
    ? {
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
        sender_profile_id: previewSender.id || null,
      }
    : null;

  function setDraft(id: string, patch: Partial<SenderProfile>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...emptyDraft(profiles.find((profile) => profile.id === id)),
        ...current[id],
        ...patch,
      },
    }));
  }

  function saveAll() {
    for (const profile of profiles) {
      const draft = drafts[profile.id];
      if (draft) saveMutation.mutate(draft);
    }
  }

  function discardChanges() {
    setDrafts(Object.fromEntries(profiles.map((profile) => [profile.id, emptyDraft(profile)])));
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sender profiles are saved in the database and can be selected while creating or printing
          labels.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Sender profiles</h3>
            <p className="text-sm text-muted-foreground">
              Select a profile for preview, edit it, save it, or delete it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => createMutation.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Add profile
            </Button>
            <Button variant="ghost" onClick={discardChanges}>
              Discard changes
            </Button>
            <Button onClick={saveAll}>Save all</Button>
          </div>
        </div>

        {profilesLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Loading profiles...
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => {
              const draft = drafts[profile.id] ?? emptyDraft(profile);
              return (
                <Card
                  key={profile.id}
                  className={previewId === profile.id ? "ring-2 ring-primary/40" : ""}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle className="text-base">{draft.name || "Unnamed profile"}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={previewId === profile.id ? "default" : "outline"}
                        onClick={() => setPreviewId(profile.id)}
                      >
                        Select
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete profile"
                        onClick={() => {
                          if (window.confirm(`Delete ${draft.name || "this profile"}?`)) {
                            deleteMutation.mutate(profile.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ProfileField
                      label="Company name"
                      value={draft.name}
                      onChange={(name) => setDraft(profile.id, { name })}
                    />
                    <ProfileField
                      label="Full address"
                      value={draft.address}
                      multiline
                      onChange={(address) => setDraft(profile.id, { address })}
                    />
                    <ProfileField
                      label="Phone"
                      value={draft.phone}
                      onChange={(phone) => setDraft(profile.id, { phone })}
                    />
                    <ProfileField
                      label="Website"
                      value={draft.website}
                      onChange={(website) => setDraft(profile.id, { website })}
                    />
                    <ProfileField
                      label="Google Review link"
                      value={draft.review_url}
                      placeholder="https://g.page/r/xxxxxxxx/review"
                      onChange={(review_url) => setDraft(profile.id, { review_url })}
                    />
                    <Button
                      className="w-full"
                      onClick={() => saveMutation.mutate(draft)}
                      disabled={saveMutation.isPending || !isMongoId(profile.id)}
                    >
                      Save profile
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sample label preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewLabel ? (
              <div className="w-full max-w-md">
                <ShippingLabel label={previewLabel} size="compact" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add a profile to preview labels.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Live tracking credentials</CardTitle>
          <CardDescription>
            Direct courier API keys and multi-tier TrackCourier accounts for fallback tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {credsLoading ? (
            <p className="text-sm text-muted-foreground">Checking...</p>
          ) : (
            <>
              <CredRow
                label="Delhivery API token"
                configured={!!creds?.delhivery}
                note="Direct API. Used for labels where Courier = Delhivery."
              />
              <CredRow
                label="DTDC API token"
                configured={!!creds?.dtdc}
                note="Direct API. Used for labels where Courier = DTDC."
              />
              <CredRow
                label="Shadowfax Direct API"
                configured={!!creds?.shadowfax}
                note="Direct API (SHADOWFAX_API_TOKEN + SHADOWFAX_BASE_URL). Used for Shadowfax labels."
              />
              <CredRow
                label="TrackCourier Account 1 (Primary)"
                configured={!!creds?.trackcourier_account1}
                note="Primary key (TRACKCOURIER_API_KEY). India Post & initial fallback."
              />
              <CredRow
                label="TrackCourier Account 2 (Secondary)"
                configured={!!creds?.trackcourier_account2}
                note="Secondary key (TRACKCOURIER_BACKUP_API_KEY). Automatic failover when Account 1 is exhausted."
              />
              <CredRow
                label="TrackCourier Account 3 (Tertiary)"
                configured={!!creds?.trackcourier_account3}
                note="Tertiary key (TRACKCOURIER_TERTIARY_API_KEY). Failover when Accounts 1 & 2 are exhausted."
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tracking Quotas & Circuit Breakers</CardTitle>
              <CardDescription className="mt-1">
                Real-time usage tracking, failover circuit breakers, and monthly quota protection across all accounts.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["tracking-controls"] })}
              disabled={statsLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Refresh stats
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {statsLoading || !trackingStats ? (
            <p className="text-sm text-muted-foreground">Loading tracking usage and circuit breakers...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xs text-muted-foreground font-medium">Today's Usage</div>
                  <div className="text-xl font-bold mt-1">
                    {trackingStats.global.usedToday} / {trackingStats.global.dailyBudget}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {trackingStats.global.remainingDaily} remaining today
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xs text-muted-foreground font-medium">Monthly Usage</div>
                  <div className="text-xl font-bold mt-1">
                    {trackingStats.global.usedThisMonth} / {trackingStats.global.monthlyBudget}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {trackingStats.global.remainingMonthly} remaining this month
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xs text-muted-foreground font-medium">TrackCourier Acc 1</div>
                  <div className="text-base font-semibold mt-1 flex items-center gap-1.5">
                    {trackingStats.providers["trackcourier_account1"]?.isCircuitBreakerTripped ? (
                      <Badge variant="destructive" className="text-xs">Tripped (402)</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">Active</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Used: {trackingStats.providers["trackcourier_account1"]?.usedThisMonth ?? 0}
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg border">
                  <div className="text-xs text-muted-foreground font-medium">TrackCourier Acc 2 & 3</div>
                  <div className="text-base font-semibold mt-1 flex items-center gap-1.5">
                    {trackingStats.providers["trackcourier_account2"]?.isCircuitBreakerTripped ? (
                      <Badge variant="destructive" className="text-xs">Acc 2 Tripped</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">Acc 2 Active</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Acc 3: {trackingStats.providers["trackcourier_account3"]?.isCircuitBreakerTripped ? "Tripped" : "Ready"}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-sm font-semibold">Master Controls</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Live Tracking</div>
                      <div className="text-xs text-muted-foreground">Master switch for upstream APIs</div>
                    </div>
                    <Switch
                      checked={trackingStats.settings.externalTrackingEnabled}
                      onCheckedChange={(checked) =>
                        updateControlsMutation.mutate({ externalTrackingEnabled: checked })
                      }
                      disabled={updateControlsMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Auto-Refresh</div>
                      <div className="text-xs text-muted-foreground">Disabled by default to protect quotas</div>
                    </div>
                    <Switch
                      checked={trackingStats.settings.autoRefreshEnabled}
                      onCheckedChange={(checked) =>
                        updateControlsMutation.mutate({ autoRefreshEnabled: checked })
                      }
                      disabled={updateControlsMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Scheduled Sync</div>
                      <div className="text-xs text-muted-foreground">Periodic background queries</div>
                    </div>
                    <Switch
                      checked={trackingStats.settings.scheduledSyncEnabled}
                      onCheckedChange={(checked) =>
                        updateControlsMutation.mutate({ scheduledSyncEnabled: checked })
                      }
                      disabled={updateControlsMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-semibold">Provider Health & Quota Limits</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Daily Usage</TableHead>
                        <TableHead>Monthly Usage</TableHead>
                        <TableHead>Circuit Breaker</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(trackingStats.providers).map(([providerKey, provider]) => {
                        return (
                          <TableRow key={providerKey}>
                            <TableCell className="font-medium text-sm">
                              {formatProviderName(providerKey)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {provider.usedToday} / {provider.dailyBudget}
                            </TableCell>
                            <TableCell className="text-xs">
                              {provider.usedThisMonth} / {provider.monthlyBudget}
                            </TableCell>
                            <TableCell>
                              {provider.isCircuitBreakerTripped ? (
                                <div className="space-y-0.5">
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <ShieldAlert className="h-3 w-3" /> Tripped
                                  </Badge>
                                  {provider.circuitBreakerReason && (
                                    <div className="text-[11px] text-destructive max-w-[200px] truncate" title={provider.circuitBreakerReason}>
                                      {provider.circuitBreakerReason}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-xs text-green-700 border-green-300 bg-green-50">
                                  <ShieldCheck className="h-3 w-3" /> Healthy
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {provider.isCircuitBreakerTripped ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => resetBreakerMutation.mutate(providerKey)}
                                  disabled={resetBreakerMutation.isPending}
                                >
                                  Reset Breaker
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <UILabel className="text-xs">{label}</UILabel>
      {multiline ? (
        <Textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
