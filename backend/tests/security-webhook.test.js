import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

function secureCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Verification simulation matching backend/server.js webhook authentication logic
function verifyShadowfaxWebhook(configuredSecret, incomingSecret) {
  if (!configuredSecret) {
    return { status: 503, error: "Webhook endpoint not configured: SHADOWFAX_WEBHOOK_SECRET is missing" };
  }
  if (!incomingSecret || !secureCompare(incomingSecret, configuredSecret)) {
    return { status: 401, error: "Unauthorized: Invalid webhook secret" };
  }
  return { status: 200, ok: true };
}

test("Security: Shadowfax webhook fails closed (HTTP 503) when secret is unset in environment", () => {
  const res = verifyShadowfaxWebhook(undefined, "some_secret");
  assert.equal(res.status, 503);
  assert.match(res.error, /SHADOWFAX_WEBHOOK_SECRET is missing/);

  const resEmpty = verifyShadowfaxWebhook("", "some_secret");
  assert.equal(resEmpty.status, 503);
});

test("Security: Shadowfax webhook rejects missing and invalid credentials (HTTP 401)", () => {
  const configured = "secret_token_1234567890abcdef";

  // Missing secret in request
  const resMissing = verifyShadowfaxWebhook(configured, undefined);
  assert.equal(resMissing.status, 401);

  // Wrong secret in request
  const resWrong = verifyShadowfaxWebhook(configured, "wrong_token");
  assert.equal(resWrong.status, 401);

  // Different length
  const resDiffLen = verifyShadowfaxWebhook(configured, "secret_token_1234567890abcde");
  assert.equal(resDiffLen.status, 401);
});

test("Security: Shadowfax webhook authenticates successfully with valid secret via constant-time compare", () => {
  const configured = "production_sfx_secret_test_key_999";
  const res = verifyShadowfaxWebhook(configured, "production_sfx_secret_test_key_999");
  assert.equal(res.status, 200);
  assert.equal(res.ok, true);
});
