import test from "node:test";
import assert from "node:assert/strict";

import { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "../src/domain/context.ts";
import {
  PinnedContextCarrierError,
  registerPinnedContextCarrier,
  type HarnessPromptContextRegistration,
} from "../src/domain/context-carrier.ts";

const identity = { sessionId: "carrier-session", rootId: "root:carrier" };

function stateWith(content: string, rootId = identity.rootId) {
  let state = createPinnedContext({ ...identity, rootId }, { maxTokens: 10_000, reservedOutputTokens: 10 });
  state = pinContextPath(state, "src/auth.ts");
  state = setContextCapacity(state, 1_000);
  return updateContextPath(state, { path: "src/auth.ts", status: "ready", content, loadedAt: 100 });
}

function registry() {
  const registrations: HarnessPromptContextRegistration[] = [];
  let registerCalls = 0;
  return {
    registrations,
    get registerCalls() { return registerCalls; },
    context(registration: HarnessPromptContextRegistration) {
      registerCalls += 1;
      registrations.push(registration);
      return () => registrations.splice(registrations.indexOf(registration), 1);
    },
  };
}

test("registers one agent-scoped provider and replaces its snapshot without waking the Agent", () => {
  const prompt = registry();
  let injectCalls = 0;
  const agent = { id: identity.sessionId, ctx: { systemPrompt: prompt }, status: "idle", inject: () => { injectCalls += 1; } };
  const carrier = registerPinnedContextCarrier(agent, stateWith("first"));

  assert.equal(prompt.registerCalls, 1);
  assert.equal(prompt.registrations.length, 1);
  assert.equal(prompt.registrations[0].name, "dsh-workspace:pinned-context");
  const initial = (prompt.registrations[0].text as () => string)();
  assert.match(initial, /^Producer: DSH Workspace Pinned Context\n<dsh-workspace-context>/);
  assert.match(initial, /path="src\/auth\.ts" sha256="sha256:[0-9a-f]{64}" bytes="5" estimatedTokens="10"/);
  assert.match(initial, /\nfirst\n<\/file>\n<\/dsh-workspace-context>$/);

  carrier.update(stateWith("second"));
  assert.equal(prompt.registerCalls, 1);
  assert.match((prompt.registrations[0].text as () => string)(), /second/);
  assert.equal(agent.status, "idle");
  assert.equal(injectCalls, 0);
  assert.throws(() => carrier.update(stateWith("wrong-root", "root:other")), (error) => error instanceof PinnedContextCarrierError && error.code === "IDENTITY_MISMATCH");
  carrier.dispose();
  assert.equal(prompt.registrations.length, 0);
  assert.throws(() => carrier.update(stateWith("late")), (error) => error instanceof PinnedContextCarrierError && error.code === "DISPOSED");
});

test("fails closed when the public carrier is missing or identity is stale", () => {
  assert.throws(
    () => registerPinnedContextCarrier({ id: identity.sessionId, ctx: {} }, stateWith("x")),
    (error) => error instanceof PinnedContextCarrierError && error.code === "UNSUPPORTED",
  );
  const prompt = registry();
  assert.throws(
    () => registerPinnedContextCarrier({ id: "other", ctx: { systemPrompt: prompt } }, stateWith("x")),
    (error) => error instanceof PinnedContextCarrierError && error.code === "IDENTITY_MISMATCH",
  );
});

test("converts registration failures into a typed compatibility error", () => {
  assert.throws(
    () => registerPinnedContextCarrier({
      id: identity.sessionId,
      ctx: { systemPrompt: { context: () => { throw new Error("unsupported") } } },
    }, stateWith("x")),
    (error) => error instanceof PinnedContextCarrierError && error.code === "REGISTRATION_FAILED",
  );
});
