import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLabelPrintUrl,
  buildPrintHandoffRedeemUrl,
  isValidPrintHandoffToken,
  normalizePrintHandoffTtl,
  redactPrintHandoffUrl,
} from "../lib/printHandoffs.js";

test("handoff TTL is finite and constrained to 30 through 300 seconds", () => {
  assert.equal(normalizePrintHandoffTtl(undefined), 90);
  assert.equal(normalizePrintHandoffTtl("invalid"), 90);
  assert.equal(normalizePrintHandoffTtl(1), 30);
  assert.equal(normalizePrintHandoffTtl(90.9), 90);
  assert.equal(normalizePrintHandoffTtl(999), 300);
});

test("redeem URL stays on the configured labels API origin", () => {
  const token = "a".repeat(64);
  assert.equal(
    buildPrintHandoffRedeemUrl("https://labels.brajmart.com", token),
    `https://labels.brajmart.com/api/v1/auth/print-handoffs/redeem?token=${token}`,
  );
  assert.throws(() => buildPrintHandoffRedeemUrl("javascript:alert(1)", token), /HTTP\(S\)/);
});

test("print URL selects only the requested label", () => {
  assert.equal(
    buildLabelPrintUrl("https://labels.brajmart.com", "label with spaces"),
    "https://labels.brajmart.com/print?ids=label+with+spaces",
  );
});

test("tokens require exactly 32 random bytes encoded as hexadecimal", () => {
  assert.equal(isValidPrintHandoffToken("a".repeat(64)), true);
  assert.equal(isValidPrintHandoffToken("a".repeat(63)), false);
  assert.equal(isValidPrintHandoffToken("z".repeat(64)), false);
});

test("access logs redact one-time tokens", () => {
  const url = `/api/v1/auth/print-handoffs/redeem?token=${"b".repeat(64)}`;
  const redacted = redactPrintHandoffUrl(url);
  assert.equal(redacted, "/api/v1/auth/print-handoffs/redeem?token=[REDACTED]");
  assert.equal(redacted.includes("b".repeat(64)), false);
});
