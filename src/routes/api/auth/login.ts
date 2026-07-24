import { createFileRoute } from "@tanstack/react-router";

import {
  createSessionToken,
  loginAndCreateAppSession,
  sessionCookie,
} from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          username?: unknown;
          password?: unknown;
        };
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        const token = createSessionToken();
        const user = await loginAndCreateAppSession(username, password, token);
        if (!user) {
          return Response.json(
            { ok: false, error: "Invalid username or password" },
            { status: 401 },
          );
        }

        return Response.json(
          { ok: true, user: { username: user.username } },
          { headers: { "Set-Cookie": sessionCookie(token) } },
        );
      },
    },
  },
});
