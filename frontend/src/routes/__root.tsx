import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut, Sun, Moon, Laptop, User as UserIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppLogo } from "@/components/app-logo";
import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/api-base";
import { useTheme } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "ShippingLabelsDashboard — Delivery Operations" },
      { name: "description", content: "Enterprise shipping label creation and multi-courier tracking platform." },
      { property: "og:title", content: "ShippingLabelsDashboard" },
      { property: "og:description", content: "Enterprise shipping label creation and multi-courier tracking platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PageTitle() {
  const { pathname, search } = useRouterState({
    select: (r) => ({
      pathname: r.location.pathname,
      search: r.location.search as Record<string, string> | undefined,
    }),
  });

  let title = "Delivery Operations";
  let subtitle = "Overview";

  if (pathname === "/create") {
    title = "Create Shipping Label";
    subtitle = "New Consignment";
  } else if (pathname === "/print") {
    title = "Print Labels";
    subtitle = "A4 Grid Layouts";
  } else if (pathname === "/settings") {
    title = "Settings & API Controls";
    subtitle = "Profiles & Circuit Breakers";
  } else if (pathname.startsWith("/edit")) {
    title = "Edit Shipping Label";
    subtitle = "Consignment Details";
  } else if (search?.tab === "shipments") {
    title = "Shipments Management";
    subtitle = "Tracking & Movements";
  } else if (search?.tab === "today") {
    title = "Today's Deliveries";
    subtitle = "Scheduled Dispatches";
  } else if (search?.tab === "delayed") {
    title = "Delayed Shipments";
    subtitle = "SLA Exception Monitoring";
  } else if (search?.tab === "rto") {
    title = "RTO Management";
    subtitle = "Returns & Undelivered";
  } else if (search?.tab === "reports") {
    title = "Reports & Analytics";
    subtitle = "Courier Performance Matrix";
  }

  return (
    <div className="flex flex-col">
      <span className="text-sm font-bold text-foreground leading-none">{title}</span>
      <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">{subtitle}</span>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

type AuthResponse = {
  authenticated: boolean;
  user: { username: string } | null;
};

const API_BASE_URL = getApiBaseUrl();

async function fetchAuth(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to check login status");
  return (await res.json()) as AuthResponse;
}

function AuthGate() {
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["app-auth"],
    queryFn: fetchAuth,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: async () => {
      await refetch();
      router.navigate({ to: "/" });
      toast.success("Logged out");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-xs text-muted-foreground animate-pulse">
        Checking authentication session...
      </div>
    );
  }

  if (!data?.authenticated) {
    return <LoginPage onLoggedIn={refetch} />;
  }

  return (
    <AuthenticatedApp
      username={data.user?.username || "Admin"}
      onLogout={() => logout.mutate()}
      loggingOut={logout.isPending}
    />
  );
}

function AuthenticatedApp({
  username,
  onLogout,
  loggingOut,
}: {
  username: string;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <div className="no-print contents">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="no-print h-14 flex items-center gap-3 border-b border-border/70 bg-card px-4 sticky top-0 z-20 shadow-xs">
            <SidebarTrigger />
            <AppLogo className="h-7 w-7 shrink-0 md:hidden text-primary" />
            <PageTitle />

            <div className="ml-auto flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={`Toggle theme (current: ${theme})`}
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500" />
                )}
              </Button>

              {/* User badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-foreground">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{username}</span>
              </div>

              {/* Logout button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive gap-1.5"
                title="Logout"
                onClick={onLogout}
                disabled={loggingOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LoginPage({ onLoggedIn }: { onLoggedIn: () => Promise<unknown> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { theme, toggleTheme } = useTheme();

  const login = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Login failed");
    },
    onSuccess: async () => {
      await onLoggedIn();
      toast.success("Logged in successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate();
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 flex flex-col items-center justify-center relative">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={`Theme: ${theme}`}
          className="text-muted-foreground"
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
        </Button>
      </div>

      <Card className="w-full max-w-sm border-border/80 shadow-md">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <AppLogo className="h-9 w-9 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base font-bold tracking-tight">BrajMart Logistics</CardTitle>
              <p className="text-xs text-muted-foreground">Sign in to manage shipping & delivery operations.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="brajmaster"
                className="text-xs h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-xs h-9"
                required
              />
            </div>
            <Button type="submit" className="w-full text-xs h-9 font-semibold" disabled={login.isPending}>
              {login.isPending ? "Authenticating..." : "Sign in to Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
