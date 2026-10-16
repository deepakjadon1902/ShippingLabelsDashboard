# Shipping Labels Backend

## Local development

Copy `.env.example` to `.env`, start MongoDB, then run:

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:8080` and proxies `/api` to this backend
at `http://localhost:5000`.

## Production on Render

Use `backend` as the root directory, `npm install` as the build command, and
`npm start` as the start command. Configure:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://labels.brajmart.com
PUBLIC_APP_URL=https://labels.brajmart.com
PUBLIC_API_URL=https://labels.brajmart.com
PRINT_HANDOFF_TTL_SECONDS=90
MONGODB_URI=<production MongoDB URI>
APP_USERNAME=brajmaster
APP_PASSWORD_HASH=<SHA-256 password hash>
```

Keep courier credentials and `PUBLIC_TRACKING_HOOK_SECRET` configured as Render
secrets. Do not put backend credentials in the Vercel frontend.

`POST /api/v1/auth/print-handoffs` requires an authenticated labels session and
creates a short-lived, single-use URL for one existing label. Opening that URL
atomically consumes it, creates the normal labels session, and redirects to
`/print?ids=<label-id>`. Handoff tokens are hashed in MongoDB and redacted from
access logs.

### Tests

Run `npm test` to verify print URL generation, token validation, expiry limits,
and access-log redaction. Run `npm run check` to check the server syntax.
