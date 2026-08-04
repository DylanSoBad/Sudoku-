import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../utils.ts";

/**
 * Regression cover for the level page hanging on "Loading puzzle".
 *
 * The Shelby tier used to be awaited with no upper bound, so a request that
 * never settled left `fetchPuzzle` pending forever and the board never
 * rendered. `withTimeout` is the mechanism that guarantees the cascade always
 * moves on to the cache and generator tiers.
 */

test("withTimeout passes a fast resolution straight through", async () => {
  const value = await withTimeout(Promise.resolve("ok"), 1_000, "fast");
  assert.equal(value, "ok");
});

test("withTimeout propagates the original rejection", async () => {
  await assert.rejects(
    withTimeout(Promise.reject(new Error("download refused")), 1_000, "failing"),
    /download refused/,
  );
});

test("withTimeout normalises a non-Error rejection", async () => {
  await assert.rejects(
    // eslint-disable-next-line prefer-promise-reject-errors
    withTimeout(Promise.reject("plain string"), 1_000, "weird"),
    /plain string/,
  );
});

test("withTimeout rejects when the work never settles", async () => {
  const never = new Promise<never>(() => {
    /* deliberately never settles, like a stalled Shelby download */
  });
  const started = Date.now();
  await assert.rejects(withTimeout(never, 50, "shelby download"), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.match(err.message, /shelby download timed out after 50ms/);
    return true;
  });
  assert.ok(Date.now() - started < 1_000, "should reject at the deadline, not hang");
});

test("withTimeout does not keep the process alive after resolving", async () => {
  // clearTimeout on the success path means no pending timer is left behind;
  // if it were, node --test would stall on this fast-resolving call.
  const slowDeadline = 60_000;
  const value = await withTimeout(Promise.resolve(42), slowDeadline, "cleanup");
  assert.equal(value, 42);
});
