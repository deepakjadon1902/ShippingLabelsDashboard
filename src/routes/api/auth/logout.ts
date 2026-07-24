import { createFileRoute } from "@tanstack/react-router";

import {
  clearSessionCookie,
  deleteAppSession,
  getSessionTokenFromRequest,
} from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await deleteAppSession(getSessionTokenFromRequest(request));
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": clearSessionCookie() } },
        );
      },
    },
  },
});
