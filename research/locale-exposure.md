# Research: DeepSeek locale exposure (Wayfinder #118, child of #117)

## TL;DR

**No public seam exists today.** The DeepSeek Harness host's active UI locale is
fully encapsulated in a private `SlotRegistry._locale` field (a `LocaleFace`), and
it only ever reaches React *slot components* through the framework-injected `t`
prop. It is **not** exposed to a plugin's client contribution context
(`apply(ctx)`), there is **no** `dsh.locale` cordis event, and there is **no**
`useLocale()` hook in any standard-kit prop mix. The plugin's own surfaces use a
separate dictionary (`src/web/workspace-i18n.ts`) whose `t()` reads
`navigator.language` (browser language) and is never told the app language — which
is exactly the bug #118 is about.

So the answer to every sub-question is "no public seam", and the deliverable is a
recommendation for the smallest addition (or the reason a pure-plugin workaround
cannot follow the app language).

---

## 1. The seam that actually exists (internal, renderer-only)

`LocaleFace` — `node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/renderer.d.ts:17`

```ts
export interface LocaleFace extends HostObservable<{ revision: number }> {
  /** Bind a namespace to a translate function reading the active locale at call time. */
  bind(ns: string): Translate;
}
// HostObservable: getSnapshot(): T; subscribe(fn: () => void): () => void;
```

- It is a **reactive** source: `subscribe(cb)` + `getSnapshot()` returning
  `{ revision: number }`. The revision bumps on every active-locale change.
- `bind(ns)` returns a `Translate` that resolves keys against the **host-owned**
  dictionary for `ns` (plus the shared `common` vocabulary). Freshness of rendered
  text is carried by the renderer's per-`(ns, revision)` `t` derivation, not by
  function identity.

Where it lives:
- Installed by the host's (private, shell-side) locale plugin via
  `SlotRegistry.installLocale(face)` —
  `node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/slots.d.ts:105`
  (impl `node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js:137`).
- Stored **privately**: `this._locale` —
  `dsh-client-runtime/lib/client.js:29,51,140`, exposed only through a private
  getter to the internal renderer: `get locale() { return service._locale; }` at
  `client.js:288-289`, surfaced to React via
  `SlotRendererHost.locale?: LocaleFace` —
  `dsh-client-ui-slots/lib/types/renderer.d.ts:184`.

**Crucially, `LocaleFace` is NOT on the public `SlotRegistry` service surface and
NOT on `ClientContributionContext`.** The plugin cannot reach it today.

---

## 2. Auto-subscribe (event) or pull-based (`useLocale()`)?

- **Auto-subscribe event?** No. The runtime declares only
  `'slots/changed'(key)` and `'connection/reset'()` on the cordis bus —
  `node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/index.d.ts`
  (the `declare module '@deepseek-ai/cordis' { interface Events { ... } }`
  block). There is **no** `'locale/changed'` / `'dsh.locale'` event.
- **`useLocale()` pull hook?** No. The standard-kit prop mixes
  (`GlobalStandardProps`, `SessionStandardProps`, `SessionMaybeStandardProps`) in
  the same `index.d.ts` expose `useSessions`, `useWorkspaces`, `useSession`,
  `useProjection` — **no** `useLocale`.
- **The contribution context?** `ClientContributionContext`
  (`src/client.ts:39-47`) receives: `conversationEvents`, `slots`, `effect`,
  `inject`, `remote`, `sessions`, `emit`. It has `emit` but **no `on`/subscribe**
  for bus events and **no locale field**. The plugin already holds `ctx.slots`
  but `slots.locale` is private.

So the locale source is reactive (`LocaleFace.subscribe`) but unreachable from a
plugin; there is no event and no hook.

---

## 3. Does `WorkspaceConversationViewRegistration.locale = "dsh-workspace"` auto-translate?

Declared in `src/web/workspace-view.ts`:
- `WORKSPACE_VIEW_LOCALE_NS = "dsh-workspace"` (line 11)
- `workspaceConversationViewRegistration()` returns `locale: WORKSPACE_VIEW_LOCALE_NS`
  (lines 34-43), and the component type `ComposedProps<…, N="dsh-workspace">`
  puts a typed `t: TranslateNS<'dsh-workspace'>` on the component props
  (`dsh-client-ui-slots/lib/types/index.d.ts:67`, `PropsLocale`).

What the host does with it:
- The renderer binds `t = hostLocale.bind('dsh-workspace')` and re-derives it on
  every `(ns, revision)` change (renderer.d.ts:6-15). So a component that
  **uses the injected host `t`** would automatically follow the app locale.
- **But the host only knows dictionaries it owns** — the host-merged
  `LocaleNamespaceMap` plus `common`. The plugin's keys
  (`artifacts.title`, `memory.scope`, `changes.filter.all`, …) live in the
  plugin's **own** `src/web/workspace-i18n.ts` table and are **never registered
  with the host locale system**. Therefore `host t('dsh-workspace', key)` resolves
  only `common` vocabulary; the plugin's keys are untranslated.
- In practice the plugin does **not** use the host `t` anyway:
  `src/web/workspace-view.ts:4` imports `t` from `./workspace-i18n.ts` (its own
  dictionary), and the view label is a static thunk `label: () => "Workspace"`
  (line 40). The plugin's `t()` reads `activeLocale`, initialized from
  `navigator.language` at module load (`workspace-i18n.ts:401-442`).

**Conclusion:** the `locale: "dsh-workspace"` declaration is currently inert for
the plugin's copy. The host does *not* auto-translate the plugin's strings, and
the plugin's real `t()` follows the browser, not the app.

---

## 4. Hooks already calling `setWorkspaceLocale()` on locale change?

None. `setWorkspaceLocale()` / `workspaceLocale()` are defined in
`src/web/workspace-i18n.ts:411-417` and are called **only** from that module's
load-time `detectLocale()` (line 439). Nothing subscribes to host locale changes,
because no public subscription exists.

---

## 5. Minimal subscriber example (target state — requires the addition in §6)

```ts
// inside src/client.ts apply(ctx): subscribe once the host exposes the face
const hostLocale = (ctx.slots as unknown as {
  locale?: { subscribe(cb: () => void): () => void; getLocale(): "en" | "zh" };
}).locale;
ctx.effect(() => {
  if (!hostLocale) return () => {};
  const sync = () => setWorkspaceLocale(hostLocale.getLocale());
  sync();
  return hostLocale.subscribe(sync);
}, "dsh Workspace locale sync");
```

---

## 6. Recommendation (smallest, least-invasive addition / workaround)

**There is no pure-plugin workaround that follows the *app* language.** The only
app-language signal is the private `SlotRegistry._locale`; `navigator.language`
(browser) is the wrong source and is the current bug. A true fix requires the
host to expose one surface.

**Preferred (one backward-compatible surface, zero new dependency, no new i18n framework):**

1. Add a public read accessor on the existing `SlotRegistry` service, mirroring
   the renderer's `SlotRendererHost.locale`:
   ```ts
   // @deepseek-ai/dsh-client-runtime — slots.d.ts service, public
   /** Installed locale face (undefined until the host locale plugin boots). */
   readonly locale: LocaleFace | undefined;
   ```
   The implementation already has `_locale` (client.js:29,51,140) and a private
   getter (client.js:288-289); promote it to public.
2. Add a code reader to `LocaleFace` so subscribers can read the language, not
   just a revision counter:
   ```ts
   // @deepseek-ai/dsh-client-ui-slots — renderer.d.ts LocaleFace
   /** The active UI locale code ("en" | "zh"). */
   getLocale(): "en" | "zh";
   ```
3. Plugin wires it in `apply(ctx)` via the `ctx.slots` it already holds, using the
   example in §5. Because `LocaleFace` is already a `HostObservable`, the plugin
   gets reactive updates with no new event system.

**Alternative (if host prefers an event over a face getter):** emit
`'locale/changed'(locale: "en" | "zh")` on the cordis bus from the host locale
plugin, and add a `subscribe`/`on` for bus events to `ClientContributionContext`.
This is a larger change (new event + new contribution-context capability) than
the promoted getter in (1)+(2).

**Not recommended:** routing the plugin's copy through the host `t` seat by
registering the plugin's dictionary into the host locale system. That needs a
host dictionary-registration seam that does not exist either, and it would couple
the plugin's copy to the host's translate lifecycle — more surface than (1)+(2).

---

## Files referenced

- `node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/renderer.d.ts:17`
  (`LocaleFace`), `:184` (`SlotRendererHost.locale`).
- `node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/slots.d.ts:105`
  (`installLocale`), `:184` (`SlotRendererHost.locale`).
- `node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js:29,51,137-144,288-289`
  (private `_locale` + getter).
- `node_modules/@deepseek-ai/dsh-client-runtime/lib/types/client/index.d.ts`
  (Events: only `slots/changed`, `connection/reset`; no `useLocale`;
  `GlobalStandardProps` has no locale hook).
- `src/client.ts:39-47` (`ClientContributionContext` — no locale field / no
  subscribe).
- `src/web/workspace-i18n.ts:401-442` (`activeLocale`, `detectLocale`,
  `setWorkspaceLocale`, `t`).
- `src/web/workspace-view.ts:4,11,34-43` (own `t` import; `locale:"dsh-workspace"`
  declaration; static `"Workspace"` label).
- `lib/typert.remote-client.js` — only `language` is a code-preview artifact
  descriptor field (line ~559), not a UI-locale seam.

## Open questions for the implementation ticket

1. Is the host locale plugin willing to (a) promote `slots.locale` to public and
   (b) add `LocaleFace.getLocale()`? Both are additive and backward-compatible.
2. What is the canonical active-locale code type in the host — `"en" | "zh"` only,
   or a wider union (e.g. region subtags)? The plugin's `WorkspaceLocale` is
   currently `"en" | "zh"`.
3. Should the plugin keep its own dictionary (`workspace-i18n.ts`) and just sync
   the active code (recommended), or eventually migrate copy into the host
   `dsh-workspace` namespace? Syncing the code is the smallest change.
