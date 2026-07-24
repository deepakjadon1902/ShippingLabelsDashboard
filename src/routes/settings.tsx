import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, KeyRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTrackingCredsStatus } from "@/lib/tracking.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Courier API Credentials" },
      { name: "description", content: "Configure Delhivery, DTDC and TrackingMore API keys for automatic tracking updates." },
      { property: "og:title", content: "Settings — Courier API Credentials" },
      { property: "og:description", content: "Manage your courier tracking API keys." },
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

function SettingsPage() {
  const fetchCreds = useServerFn(getTrackingCredsStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["tracking-creds"],
    queryFn: () => fetchCreds(),
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Courier API Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          API keys are stored as encrypted server secrets — never exposed to the browser.
        </p>
      </div>

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
                note="Unified tracker for Shadowfax, Xpressbees, Ecom Express, India Post."
              />
              <div className="flex items-start justify-between gap-4 py-3 border-t mt-2">
                <div className="flex items-start gap-3">
                  <KeyRound className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Shree Maruti Courier</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      No tracking API available — status must be updated manually from the dashboard.
                    </div>
                  </div>
                </div>
                <Badge variant="outline">Manual only</Badge>
              </div>
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
            Only labels whose status is not Delivered or RTO are processed. Shree Maruti Courier
            labels are always skipped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where to get each key</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          <div>
            <strong className="text-foreground">Delhivery</strong> — From your Delhivery One /
            client dashboard: Settings → API → Production Token. Confirm the correct token with
            your developer (Deepak) since checkout is already integrated.
          </div>
          <div>
            <strong className="text-foreground">DTDC</strong> — Provided by your DTDC account
            manager. Ask for the tracking API access token (api-key header value).
          </div>
          <div>
            <strong className="text-foreground">TrackingMore</strong> — Sign up at{" "}
            <a className="underline" href="https://www.trackingmore.com" target="_blank" rel="noreferrer">
              trackingmore.com
            </a>
            . Go to <em>User Center → API Key</em> and copy the key. New tracking numbers for
            Shadowfax / Xpressbees / Ecom Express / India Post are automatically registered when
            you create the label.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
