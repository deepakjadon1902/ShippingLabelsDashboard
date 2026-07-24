import { createFileRoute } from "@tanstack/react-router";

import { getCurrentAppUser } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentAppUser(request);
        return Response.json({
          authenticated: !!user,
          user: user ? { username: user.username } : null,
        });
      },
    },
  },
});
