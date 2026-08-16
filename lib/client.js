window.__ModuleLoader__.load({
  id: "dsh-workspace-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const { createElement, useEffect, useRef, useState } = require("react");
const { CodeBlock, JsonTree, MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
//#region packages/plugin/src/domain/path.ts
var WorkspacePathError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "WorkspacePathError";
	}
};
function normalizeWorkspacePath(input) {
	if (typeof input !== "string" || input.includes("\0")) throw new WorkspacePathError("Workspace Path must be a valid string");
	const logicalPath = input.replaceAll("\\", "/");
	if (logicalPath.startsWith("/") || /^[A-Za-z]:/.test(logicalPath)) throw new WorkspacePathError("Workspace Path must be relative");
	const segments = logicalPath.split("/");
	if (segments.some((segment) => segment === "..")) throw new WorkspacePathError("Workspace Path cannot traverse its root");
	return segments.filter((segment) => segment && segment !== ".").join("/");
}
//#endregion
//#region packages/plugin/src/web/workspace-drawer.ts
var DrawerStateError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "DrawerStateError";
		this.code = code;
	}
};
const tabs = [
	"Files",
	"Session",
	"Changes",
	"Context"
];
const panelStatuses = [
	"idle",
	"loading",
	"ready",
	"empty",
	"unsupported",
	"error"
];
const pinnedSourceStatuses = [
	"pending",
	"ready",
	"stale",
	"unreadable",
	"unsupported",
	"oversized"
];
const pinnedStatuses = [
	...pinnedSourceStatuses,
	"over-budget",
	"capacity-unavailable"
];
const pinnedOmissionReasons = [
	"per-item-bytes",
	"context-budget",
	"model-capacity",
	"capacity-unavailable",
	"unreadable",
	"stale",
	"unsupported",
	"oversized"
];
const emptyPanels = () => ({
	Files: { status: "idle" },
	Session: { status: "idle" },
	Changes: { status: "idle" },
	Context: { status: "idle" }
});
const emptyPinnedContext = () => ({
	count: 0,
	capacity: "unavailable",
	admittedTokens: 0,
	availableBudgetTokens: 0,
	remainingTokens: 0,
	entries: []
});
function createDrawerState() {
	return {
		open: false,
		activeTab: "Files",
		workingSet: {
			count: 0,
			unresolvedCount: 0
		},
		pinnedContext: emptyPinnedContext(),
		panels: emptyPanels(),
		preview: {
			target: { type: "none" },
			status: "idle"
		},
		focusReturn: null,
		focusTrap: false,
		focusVisible: true
	};
}
function assertTab(tab) {
	if (!tabs.includes(tab)) throw new DrawerStateError("INVALID_TAB", `Unknown Workspace tab: ${tab}`);
}
function assertSelection(value, label) {
	if (typeof value !== "string" || !value.trim()) throw new DrawerStateError("INVALID_SELECTION", `${label} is required`);
}
function normalizedSelectionPath(input, label) {
	assertSelection(input, label);
	const path = normalizeWorkspacePath(input);
	if (!path) throw new DrawerStateError("INVALID_SELECTION", `${label} is required`);
	return path;
}
function assertWorkingSet(summary) {
	if (!summary || typeof summary !== "object" || !Number.isInteger(summary.count) || summary.count < 0 || !Number.isInteger(summary.unresolvedCount) || summary.unresolvedCount < 0 || summary.unresolvedCount > summary.count) throw new DrawerStateError("INVALID_WORKING_SET", "Working Set counts must be non-negative integers");
}
function normalizePinnedContext(summary) {
	if (!summary || typeof summary !== "object" || !Number.isSafeInteger(summary.count) || summary.count < 0 || !Number.isSafeInteger(summary.admittedTokens) || summary.admittedTokens < 0 || !Number.isSafeInteger(summary.availableBudgetTokens) || summary.availableBudgetTokens < 0 || !Number.isSafeInteger(summary.remainingTokens) || summary.remainingTokens < 0 || summary.capacity !== "available" && summary.capacity !== "unavailable" || !Array.isArray(summary.entries) || summary.entries.length !== summary.count || summary.capacityTokens !== void 0 && (!Number.isSafeInteger(summary.capacityTokens) || summary.capacityTokens <= 0)) throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context summary is invalid");
	const entries = summary.entries.map((entry) => {
		if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.order) || entry.order < 0 || typeof entry.path !== "string" || !entry.path || !pinnedSourceStatuses.includes(entry.sourceStatus) || !pinnedStatuses.includes(entry.status) || entry.contentHash !== void 0 && !/^sha256:[0-9a-f]{64}$/u.test(entry.contentHash) || entry.bytes !== void 0 && (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) || entry.estimatedTokens !== void 0 && (!Number.isSafeInteger(entry.estimatedTokens) || entry.estimatedTokens < 0) || entry.loadedAt !== void 0 && (!Number.isSafeInteger(entry.loadedAt) || entry.loadedAt < 0) || entry.omissionReason !== void 0 && !pinnedOmissionReasons.includes(entry.omissionReason) || entry.reason !== void 0 && (typeof entry.reason !== "string" || /[\u0000-\u001f\u007f]/u.test(entry.reason))) throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context entry metadata is invalid");
		let path;
		try {
			path = normalizeWorkspacePath(entry.path);
		} catch {
			throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context paths must be normalized and relative");
		}
		if (!path || path !== entry.path || /[\u0000-\u001f\u007f]/u.test(path)) throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context paths must be normalized and relative");
		return Object.freeze({
			path,
			order: entry.order,
			sourceStatus: entry.sourceStatus,
			status: entry.status,
			...entry.contentHash === void 0 ? {} : { contentHash: entry.contentHash },
			...entry.bytes === void 0 ? {} : { bytes: entry.bytes },
			...entry.estimatedTokens === void 0 ? {} : { estimatedTokens: entry.estimatedTokens },
			...entry.loadedAt === void 0 ? {} : { loadedAt: entry.loadedAt },
			...entry.omissionReason === void 0 ? {} : { omissionReason: entry.omissionReason },
			...entry.reason === void 0 ? {} : { reason: entry.reason }
		});
	});
	return Object.freeze({
		count: summary.count,
		capacity: summary.capacity,
		...summary.capacityTokens === void 0 ? {} : { capacityTokens: summary.capacityTokens },
		admittedTokens: summary.admittedTokens,
		availableBudgetTokens: summary.availableBudgetTokens,
		remainingTokens: summary.remainingTokens,
		entries: Object.freeze(entries)
	});
}
function assertPanel(panel) {
	if (!panel || typeof panel !== "object" || !panelStatuses.includes(panel.status)) throw new DrawerStateError("INVALID_PANEL", "Unknown Workspace panel status");
	if (panel.message !== void 0 && typeof panel.message !== "string") throw new DrawerStateError("INVALID_PANEL", "Panel messages must be strings");
	if (panel.status === "error" && !panel.message?.trim()) throw new DrawerStateError("INVALID_PANEL", "Error panels need a local message");
}
function recordMetric(metrics, name) {
	metrics?.record(name);
}
function reduceDrawer(state, action, metrics) {
	if (!action || typeof action !== "object" || typeof action.type !== "string") throw new DrawerStateError("INVALID_ACTION", "Unknown Workspace drawer action");
	switch (action.type) {
		case "open":
			recordMetric(metrics, "workspace-opened");
			return { state: {
				...state,
				open: true,
				focusReturn: null,
				focusTrap: true,
				focusVisible: true
			} };
		case "close":
		case "escape": return { state: {
			...state,
			open: false,
			focusReturn: "workspace-opener",
			focusTrap: false,
			focusVisible: true
		} };
		case "select-tab":
			assertTab(action.tab);
			return { state: {
				...state,
				activeTab: action.tab
			} };
		case "select-file": {
			const path = normalizedSelectionPath(action.path, "Workspace Path");
			recordMetric(metrics, "preview-opened");
			return { state: {
				...state,
				selectedPath: path,
				preview: {
					target: {
						type: "file",
						path
					},
					status: "loading"
				}
			} };
		}
		case "select-artifact": {
			const path = normalizedSelectionPath(action.path, "Artifact Path");
			recordMetric(metrics, "artifact-opened");
			return { state: {
				...state,
				selectedPath: path,
				preview: {
					target: {
						type: "file",
						path
					},
					status: "loading"
				}
			} };
		}
		case "select-activity":
			assertSelection(action.id, "Session Activity id");
			recordMetric(metrics, "preview-opened");
			return { state: {
				...state,
				selectedActivityId: action.id,
				preview: {
					target: {
						type: "activity",
						id: action.id
					},
					status: "loading"
				}
			} };
		case "select-change": {
			const path = normalizedSelectionPath(action.path, "Workspace Path");
			recordMetric(metrics, "preview-opened");
			return { state: {
				...state,
				selectedChangePath: path,
				preview: {
					target: {
						type: "change",
						path
					},
					status: "loading"
				}
			} };
		}
		case "set-working-set":
			assertWorkingSet(action.summary);
			return { state: {
				...state,
				workingSet: { ...action.summary }
			} };
		case "set-pinned-context": return { state: {
			...state,
			pinnedContext: normalizePinnedContext(action.summary)
		} };
		case "set-panel":
			assertTab(action.tab);
			assertPanel(action.panel);
			if (action.panel.status === "error" || action.panel.status === "unsupported") recordMetric(metrics, "capability-degraded");
			return { state: {
				...state,
				panels: {
					...state.panels,
					[action.tab]: { ...action.panel }
				}
			} };
		case "set-preview":
			assertPanel(action.panel);
			if (action.panel.status === "error" || action.panel.status === "unsupported") recordMetric(metrics, "capability-degraded");
			return { state: {
				...state,
				preview: {
					target: state.preview.target,
					...action.panel
				}
			} };
		case "pin-working-set": return {
			state,
			effect: {
				type: "pin-working-set",
				path: normalizedSelectionPath(action.path, "Working Set Path")
			}
		};
		case "unpin-working-set": return {
			state,
			effect: {
				type: "unpin-working-set",
				path: normalizedSelectionPath(action.path, "Working Set Path")
			}
		};
		case "clear-working-set": return {
			state,
			effect: "clear-working-set"
		};
		case "pin-context": return {
			state,
			effect: {
				type: "pin-context",
				path: normalizedSelectionPath(action.path, "Pinned Context Path")
			}
		};
		case "unpin-context": return {
			state,
			effect: {
				type: "unpin-context",
				path: normalizedSelectionPath(action.path, "Pinned Context Path")
			}
		};
		case "clear-context": return {
			state,
			effect: "clear-context"
		};
		case "inspect-pinned-context":
			recordMetric(metrics, "pinned-context-inspected");
			return {
				state,
				effect: "inspect-pinned-context"
			};
		case "send-working-set":
			recordMetric(metrics, "working-set-sent");
			return {
				state,
				effect: "send-working-set"
			};
		default: throw new DrawerStateError("INVALID_ACTION", "Unknown Workspace drawer action");
	}
}
const WORKSPACE_CONVERSATION_KIND = "dsh-workspace-summary";
const WORKSPACE_CONVERSATION_TARGET = "chat";
const WORKSPACE_CHAT_SLOT = "conversation.chat.node";
var WorkspaceWebIntegrationError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "WorkspaceWebIntegrationError";
		this.code = code;
	}
};
function validCount(value) {
	return Number.isSafeInteger(value) && value >= 0;
}
function validWorkspaceName(value) {
	return typeof value === "string" && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function validSummary(value) {
	if (!value || typeof value !== "object") return false;
	const summary = value;
	return validCount(summary.filesTouched) && validCount(summary.changes) && validCount(summary.artifacts) && validWorkspaceName(summary.workspaceName);
}
function eventData(value) {
	if (!value || typeof value !== "object") return void 0;
	const data = value;
	if (typeof data.id !== "string" || !data.id.trim() || data.id.length > 200 || /[\u0000-\u001f\u007f]/u.test(data.id) || data.phase !== "start" && data.phase !== "update" || !validSummary(data.summary)) return void 0;
	return {
		id: data.id,
		phase: data.phase,
		summary: data.summary
	};
}
function validateWorkspaceEvent(event) {
	if (!event || typeof event !== "object" || event.type !== "workspace/summary" || !Number.isSafeInteger(event.seq)) return void 0;
	return eventData(event.data);
}
const workspaceConversationDefinition = {
	kind: WORKSPACE_CONVERSATION_KIND,
	target: WORKSPACE_CONVERSATION_TARGET,
	match(event) {
		const data = validateWorkspaceEvent(event);
		return data ? {
			id: data.id,
			role: data.phase
		} : null;
	},
	start(_context, match) {
		return match.event.data.summary;
	},
	update(_context, match) {
		return match.event.data.summary;
	},
	buildViewNode(context) {
		if (!context.state) return null;
		return {
			key: context.key,
			kind: WORKSPACE_CONVERSATION_KIND,
			id: context.id,
			target: WORKSPACE_CONVERSATION_TARGET,
			data: context.state,
			anchorSeq: context.start?.event.seq ?? 0,
			location: { kind: "session" },
			visibility: "visible"
		};
	}
};
const workspaceConversationView = {
	target: WORKSPACE_CONVERSATION_TARGET,
	create() {
		const empty = {
			order: [],
			nodes: /* @__PURE__ */ new Map(),
			timeline: {
				turnOrder: [],
				turns: /* @__PURE__ */ new Map()
			}
		};
		let snapshot = empty;
		return {
			empty,
			replace({ nodes, timeline }) {
				snapshot = {
					order: nodes.map((node) => node.key),
					nodes: new Map(nodes.map((node) => [node.key, node])),
					timeline
				};
				return snapshot;
			},
			apply({ upserts, timeline }) {
				const nodes = new Map(snapshot.nodes);
				const order = [...snapshot.order];
				for (const node of upserts) {
					if (!nodes.has(node.key)) order.push(node.key);
					nodes.set(node.key, node);
				}
				snapshot = {
					order,
					nodes,
					timeline
				};
				return snapshot;
			}
		};
	}
};
function createWorkspaceSummaryCard(summary, openWorkspace) {
	if (!validSummary(summary)) throw new WorkspaceWebIntegrationError("LOCAL_OPERATION_FAILED", "Workspace summary is invalid");
	return {
		summary,
		openWorkspace: {
			label: "Open Workspace",
			action: openWorkspace
		}
	};
}
function createWorkspaceChatNodeComponent(render, openWorkspace) {
	return ({ node }) => render(createWorkspaceSummaryCard(node.data, openWorkspace));
}
function createWorkspaceDrawerController(client, initialState = createDrawerState()) {
	let state = initialState;
	const dispatchEffect = async (effect) => {
		if (effect === "send-working-set") return client.sendWorkingSet();
		if (effect === "clear-working-set") return client.clearWorkingSet();
		if (effect === "inspect-pinned-context") return client.pinnedContext();
		if (effect === "clear-context") return client.clearContext();
		if (effect.type === "pin-working-set") return client.pinWorkingSet(effect.path);
		if (effect.type === "unpin-working-set") return client.unpinWorkingSet(effect.path);
		if (effect.type === "pin-context") return client.pinContext(effect.path);
		return client.unpinContext(effect.path);
	};
	const controller = {
		getState: () => state,
		listDirectory: client.listDirectory,
		preview: client.preview,
		readResource: client.readResource,
		diff: client.diff,
		sessionFiles: client.sessionFiles,
		gitStatus: client.gitStatus,
		workingSet: client.workingSet,
		pinnedContext: client.pinnedContext,
		async dispatch(action) {
			const reduced = reduceDrawer(state, action);
			state = reduced.state;
			if (action.type === "select-file" || action.type === "select-artifact") {
				const target = state.preview.target;
				if (target.type !== "file") return reduced;
				try {
					const data = await client.preview(target.path);
					if (data.type === "error") {
						const message = data.message ?? "Preview is unavailable";
						state = reduceDrawer(state, {
							type: "set-preview",
							panel: {
								status: "error",
								message
							}
						}).state;
						return {
							state,
							data,
							error: {
								code: "LOCAL_OPERATION_FAILED",
								operation: "preview",
								message
							}
						};
					}
					return {
						...reduced,
						state,
						data
					};
				} catch {
					state = reduceDrawer(state, {
						type: "set-preview",
						panel: {
							status: "error",
							message: "Preview is unavailable"
						}
					}).state;
					return {
						state,
						error: {
							code: "LOCAL_OPERATION_FAILED",
							operation: "preview",
							message: "Preview is unavailable"
						}
					};
				}
			}
			if (action.type === "select-change") {
				const target = state.preview.target;
				if (target.type !== "change") return reduced;
				try {
					return {
						...reduced,
						state,
						data: await client.diff(target.path)
					};
				} catch {
					state = reduceDrawer(state, {
						type: "set-preview",
						panel: {
							status: "error",
							message: "Change preview is unavailable"
						}
					}).state;
					return {
						state,
						error: {
							code: "LOCAL_OPERATION_FAILED",
							operation: "diff",
							message: "Change preview is unavailable"
						}
					};
				}
			}
			if (!reduced.effect) return reduced;
			try {
				const result = await dispatchEffect(reduced.effect);
				if (result !== void 0) {
					state = reduceDrawer(state, {
						type: "set-pinned-context",
						summary: result
					}).state;
					return {
						...reduced,
						state,
						data: result
					};
				}
				return reduced;
			} catch {
				if (reduced.effect === "inspect-pinned-context" || reduced.effect === "clear-context" || typeof reduced.effect !== "string" && (reduced.effect.type === "pin-context" || reduced.effect.type === "unpin-context")) state = reduceDrawer(state, {
					type: "set-panel",
					tab: "Context",
					panel: {
						status: "error",
						message: "Pinned Context is unavailable"
					}
				}).state;
				return {
					state,
					effect: reduced.effect,
					error: {
						code: "LOCAL_OPERATION_FAILED",
						operation: typeof reduced.effect === "string" ? reduced.effect : reduced.effect.type,
						message: "Workspace action could not be completed"
					}
				};
			}
		},
		async handleKey(key) {
			if (key !== "Escape") return { state };
			return controller.dispatch({ type: "escape" });
		}
	};
	return controller;
}
function applyWorkspaceConversationContribution(ctx, options) {
	if (!ctx?.conversationEvents || !ctx.conversationViews || !ctx.slots || typeof ctx.effect !== "function") throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Public DSH Web conversation seam is unavailable");
	if (typeof options?.renderSummary !== "function" || typeof options.openWorkspace !== "function") throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Workspace summary renderer is unavailable");
	ctx.effect(() => {
		const disposeEvent = ctx.conversationEvents.register(workspaceConversationDefinition);
		const disposeView = ctx.conversationViews.register(workspaceConversationView);
		const disposeSlot = ctx.slots.inject(WORKSPACE_CHAT_SLOT, () => ctx.slots.register({
			name: WORKSPACE_CHAT_SLOT,
			key: WORKSPACE_CONVERSATION_KIND
		}, createWorkspaceChatNodeComponent(options.renderSummary, options.openWorkspace)));
		return () => {
			disposeSlot();
			disposeView();
			disposeEvent();
		};
	}, "workspace conversation contribution");
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/core.js
var _a$1;
function $constructor(name, initializer, params) {
	function init(inst, def) {
		if (!inst._zod) Object.defineProperty(inst, "_zod", {
			value: {
				def,
				constr: _,
				traits: /* @__PURE__ */ new Set()
			},
			enumerable: false
		});
		if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		const proto = _.prototype;
		const keys = Object.keys(proto);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		var _a;
		const inst = params?.Parent ? new Definition() : this;
		init(inst, def);
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		for (const fn of inst._zod.deferred) fn();
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
function cached(getter) {
	return { get value() {
		{
			const value = getter();
			Object.defineProperty(this, "value", { value });
			return value;
		}
	} };
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
function defineLazy(object, key, getter) {
	let value = void 0;
	Object.defineProperty(object, key, {
		get() {
			if (value === EVALUATING) return;
			if (value === void 0) {
				value = EVALUATING;
				value = getter();
			}
			return value;
		},
		set(v) {
			Object.defineProperty(object, key, { value: v });
		},
		configurable: true
	});
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
const propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
	});
}
const NUMBER_FORMAT_RANGES = {
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = {};
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				newShape[key] = currDef.shape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = { ...schema._zod.def.shape };
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				delete newShape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = schema._zod.def.shape;
		for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function merge(a, b) {
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	return clone(a, mergeDefs(a._zod.def, {
		get shape() {
			const _shape = {
				...a._zod.def.shape,
				...b._zod.def.shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		},
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask) {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const oldShape = schema._zod.def.shape;
			const shape = { ...oldShape };
			if (mask) for (const key in mask) {
				if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				shape[key] = Class ? new Class({
					type: "optional",
					innerType: oldShape[key]
				}) : oldShape[key];
			}
			else for (const key in oldShape) shape[key] = Class ? new Class({
				type: "optional",
				innerType: oldShape[key]
			}) : oldShape[key];
			assignProp(this, "shape", shape);
			return shape;
		},
		checks: []
	}));
}
function required(Class, schema, mask) {
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const oldShape = schema._zod.def.shape;
		const shape = { ...oldShape };
		if (mask) for (const key in mask) {
			if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
			if (!mask[key]) continue;
			shape[key] = new Class({
				type: "nonoptional",
				innerType: oldShape[key]
			});
		}
		else for (const key in oldShape) shape[key] = new Class({
			type: "nonoptional",
			innerType: oldShape[key]
		});
		assignProp(this, "shape", shape);
		return shape;
	} }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
	rest.path ?? (rest.path = []);
	rest.message = message;
	if (ctx?.reportInput) rest.input = _input;
	return rest;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/errors.js
const initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	Object.defineProperty(inst, "_zod", {
		value: inst._zod,
		enumerable: false
	});
	Object.defineProperty(inst, "issues", {
		value: def,
		enumerable: false
	});
	inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
	Object.defineProperty(inst, "toString", {
		value: () => inst.message,
		enumerable: false
	});
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) {
		fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
		fieldErrors[sub.path[0]].push(mapper(sub));
	} else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
					else {
						curr[el] = curr[el] || { _errors: [] };
						curr[el]._errors.push(mapper(issue));
					}
					curr = curr[el];
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/parse.js
const _parse = (_Err) => (schema, value, _ctx, _params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	if (result.issues.length) {
		const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, _params?.callee);
		throw e;
	}
	return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	if (result.issues.length) {
		const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, params?.callee);
		throw e;
	}
	return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? {
		success: false,
		error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? {
		success: false,
		error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
	return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time$1(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
	const time = timeSource({ precision: args.precision });
	const opts = ["Z"];
	if (args.local) opts.push("");
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const timeRegex = `${time}(?:${opts.join("|")})`;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
	const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
	return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const _undefined$2 = /^undefined$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/checks.js
const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
const numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
		if (def.value < curr) {
			if (def.inclusive) bag.maximum = def.value;
			else bag.exclusiveMaximum = def.value;
		}
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
		if (def.value > curr) {
			if (def.inclusive) bag.minimum = def.value;
			else bag.exclusiveMinimum = def.value;
		}
	});
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		var _a;
		(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
	});
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		bag.minimum = minimum;
		bag.maximum = maximum;
		if (isInt) bag.pattern = integer;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
		if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
		if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.minimum = def.length;
		bag.maximum = def.length;
		bag.length = def.length;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		const length = input.length;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		if (def.pattern) {
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(def.pattern);
		}
	});
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
	def.pattern = pattern;
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = []) {
		this.content = [];
		this.indent = 0;
		if (this) this.args = args;
	}
	indented(fn) {
		this.indent += 1;
		fn(this);
		this.indent -= 1;
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const args = this?.args;
		const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
		return new F(...args, lines.join("\n"));
	}
};
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/versions.js
const version = {
	major: 4,
	minor: 4,
	patch: 3
};
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/schemas.js
const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const checks = [...inst._zod.def.checks ?? []];
	if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
	defineLazy(inst, "~standard", () => ({
		validate: (value) => {
			try {
				const r = safeParse$1(inst, value);
				return r.success ? { value: r.data } : { issues: r.error?.issues };
			} catch (_) {
				return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
			}
		},
		vendor: "zod",
		version: 1
	}));
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			if (!def.normalize && def.protocol?.source === httpProtocol.source) {
				if (!/^https?:\/\//i.test(trimmed)) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid URL format",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
			}
			const url = new URL(trimmed);
			if (def.hostname) {
				def.hostname.lastIndex = 0;
				if (!def.hostname.test(url.hostname)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid hostname",
					pattern: def.hostname.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.protocol) {
				def.protocol.lastIndex = 0;
				if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid protocol",
					pattern: def.protocol.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.normalize) payload.value = url.href;
			else payload.value = trimmed;
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	def.pattern ?? (def.pattern = nanoid);
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv6`;
	inst._zod.check = (payload) => {
		try {
			new URL(`http://[${payload.value}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "ipv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		const parts = payload.value.split("/");
		try {
			if (parts.length !== 2) throw new Error();
			const [address, prefix] = parts;
			if (!prefix) throw new Error();
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) throw new Error();
			if (prefixNum < 0 || prefixNum > 128) throw new Error();
			new URL(`http://[${address}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "cidrv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64";
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64URL(data) {
	if (!base64url.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64url);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64url";
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodUndefined = /*@__PURE__*/ $constructor("$ZodUndefined", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = _undefined$2;
	inst._zod.values = /* @__PURE__ */ new Set([void 0]);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (typeof input === "undefined") return payload;
		payload.issues.push({
			expected: "undefined",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodVoid = /*@__PURE__*/ $constructor("$ZodVoid", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (typeof input === "undefined") return payload;
		payload.issues.push({
			expected: "void",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = Array(input.length);
		const proms = [];
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else handleArrayResult(result, payload, i);
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
	const isPresent = key in input;
	if (result.issues.length) {
		if (isOptionalIn && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && !isOptionalIn) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		keys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const isOptionalIn = _catchall.optin === "optional";
	const isOptionalOut = _catchall.optout === "optional";
	for (const key in input) {
		if (key === "__proto__") continue;
		if (keySet.has(key)) continue;
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
		else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
		const sh = def.shape;
		Object.defineProperty(def, "shape", { get: () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			return newSh;
		} });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazy(inst._zod, "propValues", () => {
		const shape = def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = {};
		const proms = [];
		const shape = value.shape;
		for (const key of value.keys) {
			const el = shape[key];
			const isOptionalIn = el._zod.optin === "optional";
			const isOptionalOut = el._zod.optout === "optional";
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
			else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
	};
});
const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const generateFastpass = (shape) => {
		const doc = new Doc([
			"shape",
			"payload",
			"ctx"
		]);
		const normalized = _normalized.value;
		const parseStr = (key) => {
			const k = esc(key);
			return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		};
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.keys) ids[key] = `key_${counter++}`;
		doc.write(`const newResult = {};`);
		for (const key of normalized.keys) {
			const id = ids[key];
			const k = esc(key);
			const schema = shape[key];
			const isOptionalIn = schema?._zod?.optin === "optional";
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(key)};`);
			if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
			else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		const fn = doc.compile();
		return (payload, ctx) => fn(shape, payload, ctx);
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "values", () => {
		if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazy(inst._zod, "pattern", () => {
		if (def.options.every((o) => o._zod.pattern)) {
			const patterns = def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		for (const key of sharedKeys) {
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
		unrecIssue ?? (unrecIssue = iss);
		for (const k of iss.keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k).l = true;
		}
	} else result.issues.push(iss);
	for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
		if (!unrecKeys.has(k)) unrecKeys.set(k, {});
		unrecKeys.get(k).r = true;
	}
	else result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length && unrecIssue) result.issues.push({
		...unrecIssue,
		keys: bothKeys
	});
	if (aborted(result)) return result;
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	result.value = merged.data;
	return result;
}
const $ZodTuple = /*@__PURE__*/ $constructor("$ZodTuple", (inst, def) => {
	$ZodType.init(inst, def);
	const items = def.items;
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				input,
				inst,
				expected: "tuple",
				code: "invalid_type"
			});
			return payload;
		}
		payload.value = [];
		const proms = [];
		const optinStart = getTupleOptStart(items, "optin");
		const optoutStart = getTupleOptStart(items, "optout");
		if (!def.rest) {
			if (input.length < optinStart) {
				payload.issues.push({
					code: "too_small",
					minimum: optinStart,
					inclusive: true,
					input,
					inst,
					origin: "array"
				});
				return payload;
			}
			if (input.length > items.length) payload.issues.push({
				code: "too_big",
				maximum: items.length,
				inclusive: true,
				input,
				inst,
				origin: "array"
			});
		}
		const itemResults = new Array(items.length);
		for (let i = 0; i < items.length; i++) {
			const r = items[i]._zod.run({
				value: input[i],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((rr) => {
				itemResults[i] = rr;
			}));
			else itemResults[i] = r;
		}
		if (def.rest) {
			let i = items.length - 1;
			const rest = input.slice(items.length);
			for (const el of rest) {
				i++;
				const result = def.rest._zod.run({
					value: el,
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((r) => handleTupleResult(r, payload, i)));
				else handleTupleResult(result, payload, i);
			}
		}
		if (proms.length) return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
		return handleTupleResults(itemResults, payload, items, input, optoutStart);
	};
});
function getTupleOptStart(items, key) {
	for (let i = items.length - 1; i >= 0; i--) if (items[i]._zod[key] !== "optional") return i + 1;
	return 0;
}
function handleTupleResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input, optoutStart) {
	for (let i = 0; i < items.length; i++) {
		const r = itemResults[i];
		const isPresent = i < input.length;
		if (r.issues.length) {
			if (!isPresent && i >= optoutStart) {
				final.value.length = i;
				break;
			}
			final.issues.push(...prefixIssues(i, r.issues));
		}
		final.value[i] = r.value;
	}
	for (let i = final.value.length - 1; i >= input.length; i--) if (items[i]._zod.optout === "optional" && final.value[i] === void 0) final.value.length = i;
	else break;
	return final;
}
const $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values) {
			payload.value = {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				unrecognized = unrecognized ?? [];
				unrecognized.push(key);
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized
			});
		} else {
			payload.value = {};
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
	const values = new Set(def.values);
	inst._zod.values = values;
	inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		payload.fallback = true;
		return payload;
	};
});
function handleOptionalResult(result, input) {
	if (input === void 0 && (result.issues.length || result.fallback)) return {
		issues: [],
		value: void 0
	};
	return result;
}
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.optout = "optional";
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
	});
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (def.innerType._zod.optin === "optional") {
			const input = payload.value;
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
			return handleOptionalResult(result, input);
		}
		if (payload.value === void 0) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => {
		const v = def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => {
			payload.value = result.value;
			if (result.issues.length) {
				payload.value = def.catchValue({
					...payload,
					error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
					input: payload.value
				});
				payload.issues = [];
				payload.fallback = true;
			}
			return payload;
		});
		payload.value = result.value;
		if (result.issues.length) {
			payload.value = def.catchValue({
				...payload,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			payload.issues = [];
			payload.fallback = true;
		}
		return payload;
	};
});
const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => def.in._zod.values);
	defineLazy(inst._zod, "optin", () => def.in._zod.optin);
	defineLazy(inst._zod, "optout", () => def.out._zod.optout);
	defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.length) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues,
		fallback: left.fallback
	}, ctx);
}
const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
	defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	payload.value = Object.freeze(payload.value);
	return payload;
}
const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "innerType", () => {
		const d = def;
		if (!d._cachedInner) d._cachedInner = def.getter();
		return d._cachedInner;
	});
	defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
	defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
	defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
	defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
	inst._zod.parse = (payload, ctx) => {
		return inst._zod.innerType._zod.run(payload, ctx);
	};
});
const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/api.js
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class({
		type: "string",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class({
		type: "number",
		checks: [],
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _undefined$1(Class, params) {
	return new Class({
		type: "undefined",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _void$1(Class, params) {
	return new Class({
		type: "void",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		external: params?.external ?? void 0
	};
}
function process(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			process(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) Object.assign(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
			};
		}
		if (entry[1] === root) return { ref: "#" };
		const defUriPrefix = `#/${defsSegment}/`;
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + defId
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") {
				extractToDef(entry);
				continue;
			}
		}
	}
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else Object.assign(schema, refSchema);
			Object.assign(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	Object.assign(result, root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			defs[seen.defId] = seen.def;
		}
	}
	if (ctx.external) {} else if (Object.keys(defs).length > 0) {
		if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
	}
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	process(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	process(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/core/json-schema-processors.js
const formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
const stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time") delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const regexes = [...patterns];
		if (regexes.length === 1) json.pattern = regexes[0].source;
		else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
const numberProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
	if (typeof format === "string" && format.includes("int")) json.type = "integer";
	else json.type = "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) {
		if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
	} else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) {
		if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
	} else if (typeof maximum === "number") json.maximum = maximum;
	if (typeof multipleOf === "number") json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
const undefinedProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Undefined cannot be represented in JSON Schema");
};
const voidProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Void cannot be represented in JSON Schema");
};
const neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
const enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
	const def = schema._zod.def;
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
	} else if (typeof val === "bigint") {
		if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
		else vals.push(Number(val));
	} else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
const customProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = schema._zod.bag;
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = process(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
const objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	json.properties = {};
	const shape = def.shape;
	for (const key in shape) json.properties[key] = process(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	});
	const allKeys = new Set(Object.keys(shape));
	const requiredKeys = new Set([...allKeys].filter((key) => {
		const v = def.shape[key]._zod;
		if (ctx.io === "input") return v.optin === void 0;
		else return v.optout === void 0;
	}));
	if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
const unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => process(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
const intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = process(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = process(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
};
const tupleProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "array";
	const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
	const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
	const prefixItems = def.items.map((x, i) => process(x, ctx, {
		...params,
		path: [
			...params.path,
			prefixPath,
			i
		]
	}));
	const rest = def.rest ? process(def.rest, ctx, {
		...params,
		path: [
			...params.path,
			restPath,
			...ctx.target === "openapi-3.0" ? [def.items.length] : []
		]
	}) : null;
	if (ctx.target === "draft-2020-12") {
		json.prefixItems = prefixItems;
		if (rest) json.items = rest;
	} else if (ctx.target === "openapi-3.0") {
		json.items = { anyOf: prefixItems };
		if (rest) json.items.anyOf.push(rest);
		json.minItems = prefixItems.length;
		if (!rest) json.maxItems = prefixItems.length;
	} else {
		json.items = prefixItems;
		if (rest) json.additionalItems = rest;
	}
	const { minimum, maximum } = schema._zod.bag;
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
};
const recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = keyType._zod.bag?.patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = process(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process(def.keyType, ctx, {
			...params,
			path: [...params.path, "propertyNames"]
		});
		json.additionalProperties = process(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	if (keyValues) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues;
	}
};
const nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		throw new Error("Dynamic catch values are not supported in JSON Schema");
	}
	json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	process(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
const lazyProcessor = (schema, ctx, _json, params) => {
	const innerType = schema._zod.innerType;
	process(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/classic/iso.js
const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function datetime(params) {
	return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function date(params) {
	return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function time(params) {
	return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function duration(params) {
	return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/classic/errors.js
const initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	Object.defineProperties(inst, {
		format: { value: (mapper) => formatError(inst, mapper) },
		flatten: { value: (mapper) => flattenError(inst, mapper) },
		addIssue: { value: (issue) => {
			inst.issues.push(issue);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		addIssues: { value: (issues) => {
			inst.issues.push(...issues);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		isEmpty: { get() {
			return inst.issues.length === 0;
		} }
	});
};
const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/classic/parse.js
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/zod/v4/classic/schemas.js
const _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
	const proto = Object.getPrototypeOf(inst);
	let installed = _installedGroups.get(proto);
	if (!installed) {
		installed = /* @__PURE__ */ new Set();
		_installedGroups.set(proto, installed);
	}
	if (installed.has(group)) return;
	installed.add(group);
	for (const key in methods) {
		const fn = methods[key];
		Object.defineProperty(proto, key, {
			configurable: true,
			enumerable: false,
			get() {
				const bound = fn.bind(this);
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: bound
				});
				return bound;
			},
			set(v) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: v
				});
			}
		});
	}
}
const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	$ZodType.init(inst, def);
	Object.assign(inst["~standard"], { jsonSchema: {
		input: createStandardJSONSchemaMethod(inst, "input"),
		output: createStandardJSONSchemaMethod(inst, "output")
	} });
	inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
	inst.def = def;
	inst.type = def.type;
	Object.defineProperty(inst, "_def", { value: def });
	inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
	inst.safeParse = (data, params) => safeParse(inst, data, params);
	inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
	inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
	inst.spa = inst.safeParseAsync;
	inst.encode = (data, params) => encode(inst, data, params);
	inst.decode = (data, params) => decode(inst, data, params);
	inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
	inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
	inst.safeEncode = (data, params) => safeEncode(inst, data, params);
	inst.safeDecode = (data, params) => safeDecode(inst, data, params);
	inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
	inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
	_installLazyMethods(inst, "ZodType", {
		check(...chks) {
			const def = this.def;
			return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
				check: ch,
				def: { check: "custom" },
				onattach: []
			} } : ch)] }), { parent: true });
		},
		with(...chks) {
			return this.check(...chks);
		},
		clone(def, params) {
			return clone(this, def, params);
		},
		brand() {
			return this;
		},
		register(reg, meta) {
			reg.add(this, meta);
			return this;
		},
		refine(check, params) {
			return this.check(refine(check, params));
		},
		superRefine(refinement, params) {
			return this.check(superRefine(refinement, params));
		},
		overwrite(fn) {
			return this.check(/* @__PURE__ */ _overwrite(fn));
		},
		optional() {
			return optional(this);
		},
		exactOptional() {
			return exactOptional(this);
		},
		nullable() {
			return nullable(this);
		},
		nullish() {
			return optional(nullable(this));
		},
		nonoptional(params) {
			return nonoptional(this, params);
		},
		array() {
			return array(this);
		},
		or(arg) {
			return union([this, arg]);
		},
		and(arg) {
			return intersection(this, arg);
		},
		transform(tx) {
			return pipe(this, transform(tx));
		},
		default(d) {
			return _default(this, d);
		},
		prefault(d) {
			return prefault(this, d);
		},
		catch(params) {
			return _catch(this, params);
		},
		pipe(target) {
			return pipe(this, target);
		},
		readonly() {
			return readonly(this);
		},
		describe(description) {
			const cl = this.clone();
			globalRegistry.add(cl, { description });
			return cl;
		},
		meta(...args) {
			if (args.length === 0) return globalRegistry.get(this);
			const cl = this.clone();
			globalRegistry.add(cl, args[0]);
			return cl;
		},
		isOptional() {
			return this.safeParse(void 0).success;
		},
		isNullable() {
			return this.safeParse(null).success;
		},
		apply(fn) {
			return fn(this);
		}
	});
	Object.defineProperty(inst, "description", {
		get() {
			return globalRegistry.get(inst)?.description;
		},
		configurable: true
	});
	return inst;
});
/** @internal */
const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
	const bag = inst._zod.bag;
	inst.format = bag.format ?? null;
	inst.minLength = bag.minimum ?? null;
	inst.maxLength = bag.maximum ?? null;
	_installLazyMethods(inst, "_ZodString", {
		regex(...args) {
			return this.check(/* @__PURE__ */ _regex(...args));
		},
		includes(...args) {
			return this.check(/* @__PURE__ */ _includes(...args));
		},
		startsWith(...args) {
			return this.check(/* @__PURE__ */ _startsWith(...args));
		},
		endsWith(...args) {
			return this.check(/* @__PURE__ */ _endsWith(...args));
		},
		min(...args) {
			return this.check(/* @__PURE__ */ _minLength(...args));
		},
		max(...args) {
			return this.check(/* @__PURE__ */ _maxLength(...args));
		},
		length(...args) {
			return this.check(/* @__PURE__ */ _length(...args));
		},
		nonempty(...args) {
			return this.check(/* @__PURE__ */ _minLength(1, ...args));
		},
		lowercase(params) {
			return this.check(/* @__PURE__ */ _lowercase(params));
		},
		uppercase(params) {
			return this.check(/* @__PURE__ */ _uppercase(params));
		},
		trim() {
			return this.check(/* @__PURE__ */ _trim());
		},
		normalize(...args) {
			return this.check(/* @__PURE__ */ _normalize(...args));
		},
		toLowerCase() {
			return this.check(/* @__PURE__ */ _toLowerCase());
		},
		toUpperCase() {
			return this.check(/* @__PURE__ */ _toUpperCase());
		},
		slugify() {
			return this.check(/* @__PURE__ */ _slugify());
		}
	});
});
const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
	inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
	inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
	inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
	inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
	inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
	inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
	inst.datetime = (params) => inst.check(datetime(params));
	inst.date = (params) => inst.check(date(params));
	inst.time = (params) => inst.check(time(params));
	inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	_installLazyMethods(inst, "ZodNumber", {
		gt(value, params) {
			return this.check(/* @__PURE__ */ _gt(value, params));
		},
		gte(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		min(value, params) {
			return this.check(/* @__PURE__ */ _gte(value, params));
		},
		lt(value, params) {
			return this.check(/* @__PURE__ */ _lt(value, params));
		},
		lte(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		max(value, params) {
			return this.check(/* @__PURE__ */ _lte(value, params));
		},
		int(params) {
			return this.check(int(params));
		},
		safe(params) {
			return this.check(int(params));
		},
		positive(params) {
			return this.check(/* @__PURE__ */ _gt(0, params));
		},
		nonnegative(params) {
			return this.check(/* @__PURE__ */ _gte(0, params));
		},
		negative(params) {
			return this.check(/* @__PURE__ */ _lt(0, params));
		},
		nonpositive(params) {
			return this.check(/* @__PURE__ */ _lte(0, params));
		},
		multipleOf(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		step(value, params) {
			return this.check(/* @__PURE__ */ _multipleOf(value, params));
		},
		finite() {
			return this;
		}
	});
	const bag = inst._zod.bag;
	inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
	inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
	inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
	inst.isFinite = true;
	inst.format = bag.format ?? null;
});
function number(params) {
	return /* @__PURE__ */ _number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
const ZodUndefined = /*@__PURE__*/ $constructor("ZodUndefined", (inst, def) => {
	$ZodUndefined.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => undefinedProcessor(inst, ctx, json, params);
});
function _undefined(params) {
	return /* @__PURE__ */ _undefined$1(ZodUndefined, params);
}
const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodVoid = /*@__PURE__*/ $constructor("ZodVoid", (inst, def) => {
	$ZodVoid.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => voidProcessor(inst, ctx, json, params);
});
function _void(params) {
	return /* @__PURE__ */ _void$1(ZodVoid, params);
}
const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
	_installLazyMethods(inst, "ZodArray", {
		min(n, params) {
			return this.check(/* @__PURE__ */ _minLength(n, params));
		},
		nonempty(params) {
			return this.check(/* @__PURE__ */ _minLength(1, params));
		},
		max(n, params) {
			return this.check(/* @__PURE__ */ _maxLength(n, params));
		},
		length(n, params) {
			return this.check(/* @__PURE__ */ _length(n, params));
		},
		unwrap() {
			return this.element;
		}
	});
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	defineLazy(inst, "shape", () => {
		return def.shape;
	});
	_installLazyMethods(inst, "ZodObject", {
		keyof() {
			return _enum(Object.keys(this._zod.def.shape));
		},
		catchall(catchall) {
			return this.clone({
				...this._zod.def,
				catchall
			});
		},
		passthrough() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		loose() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		strict() {
			return this.clone({
				...this._zod.def,
				catchall: never()
			});
		},
		strip() {
			return this.clone({
				...this._zod.def,
				catchall: void 0
			});
		},
		extend(incoming) {
			return extend(this, incoming);
		},
		safeExtend(incoming) {
			return safeExtend(this, incoming);
		},
		merge(other) {
			return merge(this, other);
		},
		pick(mask) {
			return pick(this, mask);
		},
		omit(mask) {
			return omit(this, mask);
		},
		partial(...args) {
			return partial(ZodOptional, this, args[0]);
		},
		required(...args) {
			return required(ZodNonOptional, this, args[0]);
		}
	});
});
function object(shape, params) {
	const def = {
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	};
	return new ZodObject(def);
}
const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
const ZodTuple = /*@__PURE__*/ $constructor("ZodTuple", (inst, def) => {
	$ZodTuple.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
	inst.rest = (rest) => inst.clone({
		...inst._zod.def,
		rest
	});
});
function tuple(items, _paramsOrRest, _params) {
	const hasRest = _paramsOrRest instanceof $ZodType;
	return new ZodTuple({
		type: "tuple",
		items,
		rest: hasRest ? _paramsOrRest : null,
		...normalizeParams(hasRest ? _params : _paramsOrRest)
	});
}
const ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = Object.values(def.entries);
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
	return new ZodEnum({
		type: "enum",
		entries,
		...normalizeParams(params)
	});
}
const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			payload.fallback = true;
			return payload;
		});
		payload.value = output;
		payload.fallback = true;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
	});
}
const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
const ZodLazy = /*@__PURE__*/ $constructor("ZodLazy", (inst, def) => {
	$ZodLazy.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => lazyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.getter();
});
function lazy(getter) {
	return new ZodLazy({
		type: "lazy",
		getter
	});
}
const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
//#endregion
//#region packages/plugin/src/typert.remote-client.js
const WorkspaceJsonValueRemoteCodec$schema = union([
	literal(null),
	string(),
	number(),
	literal(false),
	literal(true),
	array(lazy(() => WorkspaceJsonValueRemoteCodec$schema)),
	record(string(), lazy(() => WorkspaceJsonValueRemoteCodec$schema)).readonly()
]);
const dsh_workspace_plugin_workspace_artifactMetadata_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_artifactMetadata_result$schema = array(object({
	"id": string().readonly(),
	"name": string().readonly(),
	"mediaType": string().readonly(),
	"sizeBytes": number().readonly(),
	"version": union([_undefined(), string()]).readonly().optional(),
	"source": object({
		"sessionId": string().readonly(),
		"workspaceId": string().readonly(),
		"kind": union([literal("artifact"), literal("file")]).readonly()
	}).readonly(),
	"preview": union([
		literal("available"),
		literal("unsupported"),
		literal("oversized"),
		literal("stale")
	]).readonly(),
	"resourceId": union([_undefined(), string()]).readonly().optional(),
	"downloadName": string().readonly(),
	"altText": union([_undefined(), string()]).readonly().optional()
}));
const dsh_workspace_plugin_workspace_contextSnapshot_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_contextSnapshot_result$schema = object({
	"version": number().readonly(),
	"contentHash": string().readonly(),
	"estimatedTokens": number().readonly(),
	"capacityTokens": number().readonly(),
	"admittedTokens": number().readonly(),
	"availableBudgetTokens": number().readonly(),
	"remainingTokens": number().readonly(),
	"status": union([literal("ready"), literal("omitted")]).readonly(),
	"omissionReason": string().readonly()
});
const dsh_workspace_plugin_workspace_focus_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_focus_result$schema = object({ "focused": boolean().readonly() });
const dsh_workspace_plugin_workspace_memoryArchive_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryArchive_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryArchive_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memoryArchive_parameter_3$schema = number();
const dsh_workspace_plugin_workspace_memoryArchive_parameter_4$schema = string();
const dsh_workspace_plugin_workspace_memoryArchive_result$schema = object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryClose_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryClose_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryClose_result$schema = _void();
const dsh_workspace_plugin_workspace_memoryExport_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryExport_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryExport_result$schema = string();
const dsh_workspace_plugin_workspace_memoryForget_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryForget_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryForget_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memoryForget_parameter_3$schema = number();
const dsh_workspace_plugin_workspace_memoryForget_parameter_4$schema = string();
const dsh_workspace_plugin_workspace_memoryForget_result$schema = object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryGovern_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryGovern_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryGovern_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memoryGovern_parameter_3$schema = union([
	literal("stale"),
	literal("verify"),
	literal("reject"),
	literal("reverify"),
	literal("pin"),
	literal("unpin"),
	literal("archive"),
	literal("restore"),
	literal("forget")
]);
const dsh_workspace_plugin_workspace_memoryGovern_parameter_4$schema = number();
const dsh_workspace_plugin_workspace_memoryGovern_parameter_5$schema = string();
const dsh_workspace_plugin_workspace_memoryGovern_result$schema = object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryImport_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryImport_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryImport_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memoryImport_result$schema = array(object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
}));
const dsh_workspace_plugin_workspace_memoryList_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryList_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryList_parameter_2$schema = union([_undefined(), object({
	"type": union([
		_undefined(),
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly().optional(),
	"status": union([
		_undefined(),
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly().optional(),
	"limit": union([_undefined(), number()]).readonly().optional()
})]);
const dsh_workspace_plugin_workspace_memoryList_result$schema = array(object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
}));
const dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memoryMarkUsed_result$schema = object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryOpen_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryOpen_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryOpen_result$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"records": array(object({
		"schemaVersion": literal(1).readonly(),
		"id": string().readonly(),
		"scope": union([
			literal("session"),
			literal("project"),
			literal("user"),
			literal("shared-project")
		]).readonly(),
		"scopeKey": string().readonly(),
		"type": union([
			literal("decision"),
			literal("preference"),
			literal("convention"),
			literal("fact")
		]).readonly(),
		"title": string().readonly(),
		"content": string().readonly(),
		"tags": array(string()).readonly(),
		"provenance": object({
			"kind": union([
				literal("user"),
				literal("agent"),
				literal("tool"),
				literal("import")
			]).readonly(),
			"sessionId": union([_undefined(), string()]).readonly().optional(),
			"eventSeq": union([_undefined(), number()]).readonly().optional(),
			"note": union([_undefined(), string()]).readonly().optional()
		}).readonly(),
		"createdAt": number().readonly(),
		"updatedAt": number().readonly(),
		"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
		"useCount": number().readonly(),
		"contentHash": string().readonly(),
		"status": union([
			literal("active"),
			literal("archived"),
			literal("forgotten")
		]).readonly(),
		"governance": union([_undefined(), object({
			"origin": union([
				literal("user-authored"),
				literal("imported"),
				literal("derived"),
				literal("model-suggested")
			]).readonly(),
			"sourceRefs": array(object({
				"kind": union([
					literal("file"),
					literal("session"),
					literal("import"),
					literal("event"),
					literal("url")
				]).readonly(),
				"id": string().readonly(),
				"contentHash": union([_undefined(), string()]).readonly().optional()
			})).readonly(),
			"verification": union([
				literal("stale"),
				literal("unverified"),
				literal("verified"),
				literal("rejected")
			]).readonly(),
			"verifiedAt": union([_undefined(), number()]).readonly().optional(),
			"verifiedBy": union([
				_undefined(),
				literal("user"),
				literal("trusted-tool")
			]).readonly().optional(),
			"confidence": union([
				_undefined(),
				literal("low"),
				literal("medium"),
				literal("high")
			]).readonly().optional(),
			"revision": number().readonly(),
			"conflictGroup": union([_undefined(), string()]).readonly().optional(),
			"pinnedAt": union([_undefined(), number()]).readonly().optional(),
			"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
			"expiresAt": union([_undefined(), number()]).readonly().optional(),
			"retention": union([
				literal("session-end"),
				literal("project-delete"),
				literal("user-managed")
			]).readonly()
		})]).readonly().optional()
	})).readonly(),
	"warnings": array(object({
		"code": union([
			literal("CORRUPT_RECORD"),
			literal("BAD_HASH"),
			literal("UNSUPPORTED_SCHEMA"),
			literal("TRUNCATED_LINE"),
			literal("STORE_TOO_LARGE")
		]).readonly(),
		"line": number().readonly(),
		"message": string().readonly()
	})).readonly(),
	"readOnly": boolean().readonly()
});
const dsh_workspace_plugin_workspace_memorySearch_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memorySearch_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memorySearch_parameter_2$schema = string();
const dsh_workspace_plugin_workspace_memorySearch_parameter_3$schema = union([_undefined(), object({
	"limit": union([_undefined(), number()]).readonly().optional(),
	"type": union([
		_undefined(),
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly().optional(),
	"status": union([
		_undefined(),
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly().optional()
})]);
const dsh_workspace_plugin_workspace_memorySearch_result$schema = array(object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
}));
const dsh_workspace_plugin_workspace_memoryUpsert_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_memoryUpsert_parameter_1$schema = object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"userId": union([_undefined(), string()]).readonly().optional(),
	"sharedProject": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional(),
	"sharedWriteAcknowledged": union([
		_undefined(),
		literal(false),
		literal(true)
	]).readonly().optional()
});
const dsh_workspace_plugin_workspace_memoryUpsert_parameter_2$schema = intersection(object({
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly()
}), object({
	"id": union([_undefined(), string()]).readonly().optional(),
	"createdAt": union([_undefined(), number()]).readonly().optional(),
	"updatedAt": union([_undefined(), number()]).readonly().optional(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": union([_undefined(), number()]).readonly().optional(),
	"status": union([
		_undefined(),
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly().optional(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional(),
	"expectedRevision": union([_undefined(), number()]).readonly().optional(),
	"expectedHash": union([_undefined(), string()]).readonly().optional()
}));
const dsh_workspace_plugin_workspace_memoryUpsert_result$schema = object({
	"schemaVersion": literal(1).readonly(),
	"id": string().readonly(),
	"scope": union([
		literal("session"),
		literal("project"),
		literal("user"),
		literal("shared-project")
	]).readonly(),
	"scopeKey": string().readonly(),
	"type": union([
		literal("decision"),
		literal("preference"),
		literal("convention"),
		literal("fact")
	]).readonly(),
	"title": string().readonly(),
	"content": string().readonly(),
	"tags": array(string()).readonly(),
	"provenance": object({
		"kind": union([
			literal("user"),
			literal("agent"),
			literal("tool"),
			literal("import")
		]).readonly(),
		"sessionId": union([_undefined(), string()]).readonly().optional(),
		"eventSeq": union([_undefined(), number()]).readonly().optional(),
		"note": union([_undefined(), string()]).readonly().optional()
	}).readonly(),
	"createdAt": number().readonly(),
	"updatedAt": number().readonly(),
	"lastUsedAt": union([_undefined(), number()]).readonly().optional(),
	"useCount": number().readonly(),
	"contentHash": string().readonly(),
	"status": union([
		literal("active"),
		literal("archived"),
		literal("forgotten")
	]).readonly(),
	"governance": union([_undefined(), object({
		"origin": union([
			literal("user-authored"),
			literal("imported"),
			literal("derived"),
			literal("model-suggested")
		]).readonly(),
		"sourceRefs": array(object({
			"kind": union([
				literal("file"),
				literal("session"),
				literal("import"),
				literal("event"),
				literal("url")
			]).readonly(),
			"id": string().readonly(),
			"contentHash": union([_undefined(), string()]).readonly().optional()
		})).readonly(),
		"verification": union([
			literal("stale"),
			literal("unverified"),
			literal("verified"),
			literal("rejected")
		]).readonly(),
		"verifiedAt": union([_undefined(), number()]).readonly().optional(),
		"verifiedBy": union([
			_undefined(),
			literal("user"),
			literal("trusted-tool")
		]).readonly().optional(),
		"confidence": union([
			_undefined(),
			literal("low"),
			literal("medium"),
			literal("high")
		]).readonly().optional(),
		"revision": number().readonly(),
		"conflictGroup": union([_undefined(), string()]).readonly().optional(),
		"pinnedAt": union([_undefined(), number()]).readonly().optional(),
		"pinnedBy": union([_undefined(), literal("user")]).readonly().optional(),
		"expiresAt": union([_undefined(), number()]).readonly().optional(),
		"retention": union([
			literal("session-end"),
			literal("project-delete"),
			literal("user-managed")
		]).readonly()
	})]).readonly().optional()
});
const dsh_workspace_plugin_workspace_previewArtifact_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_previewArtifact_parameter_1$schema = string();
const dsh_workspace_plugin_workspace_previewArtifact_result$schema = union([
	object({
		"type": literal("text").readonly(),
		"renderer": literal("ui-primitives").readonly(),
		"language": union([_undefined(), string()]).readonly().optional(),
		"content": string().readonly(),
		"truncated": boolean().readonly()
	}),
	object({
		"type": literal("markdown").readonly(),
		"renderer": literal("ui-primitives").readonly(),
		"content": string().readonly(),
		"truncated": boolean().readonly(),
		"policy": object({
			"allowRawHtml": literal(false).readonly(),
			"allowRemoteImages": literal(false).readonly(),
			"allowedLinkSchemes": tuple([
				literal("http"),
				literal("https"),
				literal("mailto")
			]).readonly()
		}).readonly()
	}),
	object({
		"type": literal("json").readonly(),
		"renderer": literal("ui-primitives").readonly(),
		"value": union([
			literal(null),
			string(),
			number(),
			literal(false),
			literal(true),
			array(lazy(() => WorkspaceJsonValueRemoteCodec$schema)),
			record(string(), lazy(() => WorkspaceJsonValueRemoteCodec$schema)).readonly()
		]).readonly()
	}),
	object({
		"type": literal("csv").readonly(),
		"renderer": literal("ui-primitives").readonly(),
		"columns": array(string()).readonly(),
		"rows": array(array(string())).readonly(),
		"truncated": boolean().readonly()
	}),
	object({
		"type": literal("binary").readonly(),
		"mediaType": string().readonly(),
		"resourceId": string().readonly(),
		"version": string().readonly(),
		"expiresAt": number().readonly()
	}),
	object({
		"type": literal("unsupported").readonly(),
		"reason": string().readonly(),
		"mediaType": union([_undefined(), string()]).readonly().optional(),
		"size": union([_undefined(), number()]).readonly().optional()
	}),
	object({
		"type": literal("error").readonly(),
		"code": string().readonly(),
		"message": string().readonly()
	})
]);
const dsh_workspace_plugin_workspace_replaceContext_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_replaceContext_parameter_1$schema = object({
	"version": number().readonly(),
	"contentHash": string().readonly(),
	"estimatedTokens": number().readonly(),
	"capacityTokens": number().readonly(),
	"admittedTokens": number().readonly(),
	"availableBudgetTokens": number().readonly(),
	"remainingTokens": number().readonly(),
	"status": union([literal("ready"), literal("omitted")]).readonly(),
	"omissionReason": string().readonly()
});
const dsh_workspace_plugin_workspace_replaceContext_result$schema = object({
	"version": number().readonly(),
	"contentHash": string().readonly(),
	"estimatedTokens": number().readonly(),
	"capacityTokens": number().readonly(),
	"admittedTokens": number().readonly(),
	"availableBudgetTokens": number().readonly(),
	"remainingTokens": number().readonly(),
	"status": union([literal("ready"), literal("omitted")]).readonly(),
	"omissionReason": string().readonly()
});
const dsh_workspace_plugin_workspace_summary_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_summary_result$schema = object({
	"ready": boolean().readonly(),
	"agent": intersection(string(), unknown()).readonly()
});
const TYPERT_REMOTE = {
	package: "dsh-workspace-plugin",
	descriptors: [
		{
			id: "dsh-workspace-plugin#workspace/artifactMetadata",
			service: "workspace",
			namespace: "workspace",
			method: "artifactMetadata",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_artifactMetadata_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/artifactMetadata:result",
				schema: dsh_workspace_plugin_workspace_artifactMetadata_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 196,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/contextSnapshot",
			service: "workspace",
			namespace: "workspace",
			method: "contextSnapshot",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_contextSnapshot_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
				schema: dsh_workspace_plugin_workspace_contextSnapshot_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 185,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/focus",
			service: "workspace",
			namespace: "workspace",
			method: "focus",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_focus_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/focus:result",
				schema: dsh_workspace_plugin_workspace_focus_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 180,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryArchive",
			service: "workspace",
			namespace: "workspace",
			method: "memoryArchive",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryArchive_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryArchive_parameter_1$schema
					}
				},
				{
					name: "id",
					wire: "id",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryArchive:id",
						schema: dsh_workspace_plugin_workspace_memoryArchive_parameter_2$schema
					}
				},
				{
					name: "expectedRevision",
					wire: "expectedRevision",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryArchive:expectedRevision",
						schema: dsh_workspace_plugin_workspace_memoryArchive_parameter_3$schema
					}
				},
				{
					name: "expectedHash",
					wire: "expectedHash",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryArchive:expectedHash",
						schema: dsh_workspace_plugin_workspace_memoryArchive_parameter_4$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryRecord",
				schema: dsh_workspace_plugin_workspace_memoryArchive_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 222,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryClose",
			service: "workspace",
			namespace: "workspace",
			method: "memoryClose",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_memoryClose_parameter_0$schema
				}
			}, {
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
					schema: dsh_workspace_plugin_workspace_memoryClose_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/memoryClose:result",
				schema: dsh_workspace_plugin_workspace_memoryClose_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 257,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryExport",
			service: "workspace",
			namespace: "workspace",
			method: "memoryExport",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_memoryExport_parameter_0$schema
				}
			}, {
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
					schema: dsh_workspace_plugin_workspace_memoryExport_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/memoryExport:result",
				schema: dsh_workspace_plugin_workspace_memoryExport_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 247,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryForget",
			service: "workspace",
			namespace: "workspace",
			method: "memoryForget",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryForget_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryForget_parameter_1$schema
					}
				},
				{
					name: "id",
					wire: "id",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryForget:id",
						schema: dsh_workspace_plugin_workspace_memoryForget_parameter_2$schema
					}
				},
				{
					name: "expectedRevision",
					wire: "expectedRevision",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryForget:expectedRevision",
						schema: dsh_workspace_plugin_workspace_memoryForget_parameter_3$schema
					}
				},
				{
					name: "expectedHash",
					wire: "expectedHash",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryForget:expectedHash",
						schema: dsh_workspace_plugin_workspace_memoryForget_parameter_4$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryRecord",
				schema: dsh_workspace_plugin_workspace_memoryForget_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 227,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryGovern",
			service: "workspace",
			namespace: "workspace",
			method: "memoryGovern",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_1$schema
					}
				},
				{
					name: "id",
					wire: "id",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryGovern:id",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_2$schema
					}
				},
				{
					name: "action",
					wire: "action",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryGovernanceAction",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_3$schema
					}
				},
				{
					name: "expectedRevision",
					wire: "expectedRevision",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryGovern:expectedRevision",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_4$schema
					}
				},
				{
					name: "expectedHash",
					wire: "expectedHash",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryGovern:expectedHash",
						schema: dsh_workspace_plugin_workspace_memoryGovern_parameter_5$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryRecord",
				schema: dsh_workspace_plugin_workspace_memoryGovern_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 242,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryImport",
			service: "workspace",
			namespace: "workspace",
			method: "memoryImport",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryImport_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryImport_parameter_1$schema
					}
				},
				{
					name: "serialized",
					wire: "serialized",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryImport:serialized",
						schema: dsh_workspace_plugin_workspace_memoryImport_parameter_2$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/memoryImport:result",
				schema: dsh_workspace_plugin_workspace_memoryImport_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 252,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryList",
			service: "workspace",
			namespace: "workspace",
			method: "memoryList",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryList_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryList_parameter_1$schema
					}
				},
				{
					name: "options",
					wire: "options",
					source: "json",
					acceptsUndefined: true,
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryListOptions",
						schema: dsh_workspace_plugin_workspace_memoryList_parameter_2$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/memoryList:result",
				schema: dsh_workspace_plugin_workspace_memoryList_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 212,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryMarkUsed",
			service: "workspace",
			namespace: "workspace",
			method: "memoryMarkUsed",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_1$schema
					}
				},
				{
					name: "id",
					wire: "id",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memoryMarkUsed:id",
						schema: dsh_workspace_plugin_workspace_memoryMarkUsed_parameter_2$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryRecord",
				schema: dsh_workspace_plugin_workspace_memoryMarkUsed_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 237,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryOpen",
			service: "workspace",
			namespace: "workspace",
			method: "memoryOpen",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_memoryOpen_parameter_0$schema
				}
			}, {
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
					schema: dsh_workspace_plugin_workspace_memoryOpen_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryReadState",
				schema: dsh_workspace_plugin_workspace_memoryOpen_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 207,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memorySearch",
			service: "workspace",
			namespace: "workspace",
			method: "memorySearch",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memorySearch_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memorySearch_parameter_1$schema
					}
				},
				{
					name: "query",
					wire: "query",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin#workspace/memorySearch:query",
						schema: dsh_workspace_plugin_workspace_memorySearch_parameter_2$schema
					}
				},
				{
					name: "options",
					wire: "options",
					source: "json",
					acceptsUndefined: true,
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemorySearchOptions",
						schema: dsh_workspace_plugin_workspace_memorySearch_parameter_3$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/memorySearch:result",
				schema: dsh_workspace_plugin_workspace_memorySearch_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 232,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/memoryUpsert",
			service: "workspace",
			namespace: "workspace",
			method: "memoryUpsert",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "agentId",
					wire: "agentId",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#AgentId",
						schema: dsh_workspace_plugin_workspace_memoryUpsert_parameter_0$schema
					}
				},
				{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryScopeRequest",
						schema: dsh_workspace_plugin_workspace_memoryUpsert_parameter_1$schema
					}
				},
				{
					name: "draft",
					wire: "draft",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-workspace-plugin/types#MemoryDraft",
						schema: dsh_workspace_plugin_workspace_memoryUpsert_parameter_2$schema
					}
				}
			],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#MemoryRecord",
				schema: dsh_workspace_plugin_workspace_memoryUpsert_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 217,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/previewArtifact",
			service: "workspace",
			namespace: "workspace",
			method: "previewArtifact",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_previewArtifact_parameter_0$schema
				}
			}, {
				name: "id",
				wire: "id",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin#workspace/previewArtifact:id",
					schema: dsh_workspace_plugin_workspace_previewArtifact_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#WorkspaceArtifactPreview",
				schema: dsh_workspace_plugin_workspace_previewArtifact_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 201,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/replaceContext",
			service: "workspace",
			namespace: "workspace",
			method: "replaceContext",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_replaceContext_parameter_0$schema
				}
			}, {
				name: "snapshot",
				wire: "snapshot",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
					schema: dsh_workspace_plugin_workspace_replaceContext_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
				schema: dsh_workspace_plugin_workspace_replaceContext_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 190,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/summary",
			service: "workspace",
			namespace: "workspace",
			method: "summary",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agent",
				wire: "agent",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_summary_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/summary:result",
				schema: dsh_workspace_plugin_workspace_summary_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 175,
				"column": 3
			}
		}
	]
};
//#endregion
//#region packages/plugin/src/web/workspace-preview-adapters.ts
/** Remove Markdown image fetches before handing bounded content to the Harness renderer. */
function sanitizeWorkspaceMarkdown(text) {
	const withoutRemoteDefinitions = text.replace(/^\s{0,3}\[((?:\\.|[^\]])+)\]:\s*<?https?:\/\/[^>\s]+>?[^\r\n]*$/gimu, "");
	const readDelimited = (start, open, close) => {
		let depth = 0;
		for (let index = start; index < withoutRemoteDefinitions.length; index += 1) {
			if (withoutRemoteDefinitions[index] === "\\") {
				index += 1;
				continue;
			}
			if (withoutRemoteDefinitions[index] === open) depth += 1;
			else if (withoutRemoteDefinitions[index] === close && --depth === 0) return index;
		}
		return -1;
	};
	let sanitized = "";
	for (let index = 0; index < withoutRemoteDefinitions.length;) {
		if (withoutRemoteDefinitions[index] === "!" && withoutRemoteDefinitions[index + 1] === "[") {
			const altEnd = readDelimited(index + 1, "[", "]");
			if (altEnd !== -1) {
				const destinationStart = altEnd + 1;
				const destinationEnd = withoutRemoteDefinitions[destinationStart] === "(" ? readDelimited(destinationStart, "(", ")") : withoutRemoteDefinitions[destinationStart] === "[" ? readDelimited(destinationStart, "[", "]") : -1;
				const alt = withoutRemoteDefinitions.slice(index + 2, altEnd);
				if (!(withoutRemoteDefinitions[destinationStart] === "(" || withoutRemoteDefinitions[destinationStart] === "[") || destinationEnd !== -1) {
					sanitized += alt;
					index = destinationEnd === -1 ? altEnd + 1 : destinationEnd + 1;
					continue;
				}
			}
		}
		sanitized += withoutRemoteDefinitions[index];
		index += 1;
	}
	return sanitized;
}
function status(message) {
	return createElement("p", {
		role: "status",
		"data-dsh-workspace-preview": "status"
	}, message);
}
function csvTable(columns, rows, truncated) {
	const table = createElement("table", { "data-dsh-workspace-preview": "csv" }, createElement("caption", null, truncated ? "Workspace CSV preview (additional rows omitted)" : "Workspace CSV preview"), createElement("thead", null, createElement("tr", null, columns.map((column, index) => createElement("th", {
		key: index,
		scope: "col"
	}, column)))), createElement("tbody", null, rows.map((row, rowIndex) => createElement("tr", { key: rowIndex }, row.map((cell, columnIndex) => createElement("td", { key: columnIndex }, cell))))));
	return createElement("div", {
		role: "region",
		"aria-label": "Workspace CSV preview",
		"data-dsh-workspace-preview": "csv-scroll",
		tabIndex: 0,
		style: {
			overflowX: "auto",
			maxWidth: "100%"
		}
	}, table);
}
function primitiveElement(primitive, props) {
	return createElement(primitive, props);
}
function resourceHref(descriptor, options, download) {
	const path = options.resourcePath ?? "/workspace/resource";
	if (typeof path !== "string" || !/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) return void 0;
	const url = new URL(path, "http://workspace.local");
	url.searchParams.set("id", descriptor.resourceId);
	url.searchParams.set("type", descriptor.mediaType);
	if (download) url.searchParams.set("download", "1");
	return `${url.pathname}${url.search}`;
}
function imageAlt(descriptor, options) {
	return (options.altText ?? descriptor.path.split("/").pop() ?? "Workspace image").replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 180) || "Workspace image";
}
function withTruncation(content, truncated) {
	if (!truncated) return content;
	return createElement("div", { "data-dsh-workspace-preview": "truncated" }, content, createElement("p", { role: "status" }, "Preview truncated; additional content omitted."));
}
/** Render only bounded, already-authorized Host data through public UI primitives. */
function createWorkspacePreviewRenderer(primitives, descriptor, options = {}) {
	if (descriptor.type === "error") return status(descriptor.message);
	if (descriptor.type === "unsupported") {
		const metadata = [descriptor.mediaType, descriptor.size === void 0 ? void 0 : `${descriptor.size} bytes`].filter(Boolean).join(", ");
		return status(`Preview unavailable: ${descriptor.reason}${metadata ? ` (${metadata})` : ""}. Download is unavailable for this file.`);
	}
	if (descriptor.type === "text") return withTruncation(primitiveElement(primitives.CodeBlock, {
		code: descriptor.content,
		lang: descriptor.language
	}), descriptor.truncated);
	if (descriptor.type === "markdown") return withTruncation(primitiveElement(primitives.MarkdownText, {
		text: sanitizeWorkspaceMarkdown(descriptor.content),
		streaming: false
	}), descriptor.truncated);
	if (descriptor.type === "json") {
		const data = descriptor.value !== null && typeof descriptor.value === "object" ? descriptor.value : { value: descriptor.value };
		return primitiveElement(primitives.JsonTree, {
			data,
			label: "Workspace JSON",
			copyable: true,
			expandTopLevel: true
		});
	}
	if (descriptor.type === "csv") return withTruncation(csvTable(descriptor.columns, descriptor.rows, descriptor.truncated), descriptor.truncated);
	const resourceUrl = resourceHref(descriptor, options, false);
	if (!resourceUrl) return status("Preview resource is unavailable");
	if (descriptor.mediaType.startsWith("image/")) return createElement("img", {
		src: resourceUrl,
		alt: imageAlt(descriptor, options),
		loading: "lazy"
	});
	if (descriptor.mediaType === "application/pdf") return createElement("iframe", {
		src: resourceUrl,
		title: "Workspace PDF preview"
	});
	const downloadUrl = resourceHref(descriptor, options, true);
	return createElement("a", {
		href: downloadUrl,
		download: options.downloadName
	}, `Download ${options.downloadName ?? "workspace file"}`);
}
//#endregion
//#region packages/plugin/src/web/workspace-deliverables.ts
const previewStatuses = [
	"available",
	"unsupported",
	"oversized",
	"stale"
];
const safeOpaque = /^[A-Za-z0-9:_-]+$/u;
const safeMediaType = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/u;
function safeText(value, max) {
	return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}
function assertArtifact(value) {
	if (!value || typeof value !== "object" || !safeText(value.id, 256) || !safeOpaque.test(value.id) || !safeText(value.name, 256) || /[\\/]/u.test(value.name) || value.name === "." || value.name === ".." || !safeText(value.mediaType, 256) || !safeMediaType.test(value.mediaType) || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 0 || !previewStatuses.includes(value.preview) || !safeText(value.downloadName, 180) || /[\\/]/u.test(value.downloadName) || value.downloadName === "." || value.downloadName === ".." || !value.source || !safeText(value.source.sessionId, 256) || /[\\/]/u.test(value.source.sessionId) || !safeText(value.source.workspaceId, 256) || /[\\/]/u.test(value.source.workspaceId) || value.source.kind !== "artifact" && value.source.kind !== "file" || value.resourceId !== void 0 && (!safeText(value.resourceId, 256) || !safeOpaque.test(value.resourceId)) || value.version !== void 0 && (!safeText(value.version, 512) || /[\\/]/u.test(value.version)) || value.altText !== void 0 && !safeText(value.altText, 256)) throw new Error("Workspace artifact metadata is invalid");
	if (value.mediaType.startsWith("image/") && value.preview === "available" && !safeText(value.altText, 256)) throw new Error("Workspace image artifacts require accessibility text");
	const source = Object.freeze({
		sessionId: value.source.sessionId,
		workspaceId: value.source.workspaceId,
		kind: value.source.kind
	});
	return Object.freeze({
		id: value.id,
		name: value.name,
		mediaType: value.mediaType,
		sizeBytes: value.sizeBytes,
		...value.version === void 0 ? {} : { version: value.version },
		source,
		preview: value.preview,
		...value.resourceId === void 0 ? {} : { resourceId: value.resourceId },
		downloadName: value.downloadName,
		...value.altText === void 0 ? {} : { altText: value.altText }
	});
}
/** Validate and deterministically order metadata without exposing a Workspace Path. */
function normalizeWorkspaceArtifacts(input) {
	if (!Array.isArray(input)) throw new Error("Workspace artifacts must be an array");
	const seen = /* @__PURE__ */ new Set();
	return Object.freeze(input.map(assertArtifact).filter((artifact) => {
		if (seen.has(artifact.id)) throw new Error("Workspace artifact ids must be unique");
		seen.add(artifact.id);
		return true;
	}).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)));
}
function createWorkspaceArtifactView(input, selectedId) {
	const items = normalizeWorkspaceArtifacts(input);
	if (selectedId !== void 0 && (!safeText(selectedId, 256) || !safeOpaque.test(selectedId))) throw new Error("Workspace artifact selection is invalid");
	return Object.freeze({
		items,
		...selectedId === void 0 ? {} : { selected: items.find((artifact) => artifact.id === selectedId) }
	});
}
function detailStatus(descriptor) {
	if (descriptor.type === "unsupported") return "unsupported";
	if (descriptor.type !== "error") return "ready";
	if (descriptor.code === "FILE_TOO_LARGE") return "oversized";
	if (descriptor.code === "RESOURCE_STALE") return "stale";
	return "error";
}
function createWorkspaceArtifactDetail(artifact, descriptor) {
	const safeArtifact = assertArtifact(artifact);
	if (!descriptor) return {
		artifact: safeArtifact,
		status: safeArtifact.preview === "available" ? "idle" : safeArtifact.preview
	};
	if ("path" in descriptor) try {
		if (normalizeWorkspacePath(descriptor.path) !== descriptor.path) return {
			artifact: safeArtifact,
			status: "error",
			message: "Preview path is invalid"
		};
	} catch {
		return {
			artifact: safeArtifact,
			status: "error",
			message: "Preview path is invalid"
		};
	}
	if (descriptor.type === "binary" && (safeArtifact.resourceId !== descriptor.resourceId || safeArtifact.mediaType !== descriptor.mediaType || safeArtifact.version !== void 0 && safeArtifact.version !== descriptor.version)) return {
		artifact: safeArtifact,
		status: "error",
		message: "Preview resource identity is invalid"
	};
	return {
		artifact: safeArtifact,
		descriptor,
		status: detailStatus(descriptor),
		...descriptor.type === "error" ? { message: descriptor.message } : descriptor.type === "unsupported" ? { message: descriptor.reason } : {}
	};
}
function buildWorkspaceResourceUrl(artifact, resourcePath = "/workspace/resource") {
	const safeArtifact = assertArtifact(artifact);
	if (!safeArtifact.resourceId || typeof resourcePath !== "string" || !/^\/[A-Za-z0-9._/-]+$/u.test(resourcePath) || resourcePath.endsWith("/")) return void 0;
	const url = new URL(resourcePath, "http://workspace.local");
	url.searchParams.set("id", safeArtifact.resourceId);
	url.searchParams.set("type", safeArtifact.mediaType);
	url.searchParams.set("download", "1");
	return `${url.pathname}${url.search}`;
}
function responseStatus(status) {
	if (status === 404 || status === 410) return "stale";
	if (status === 413) return "oversized";
	return "error";
}
/** Own one cancellable browser download and its object-URL cleanup. */
function createWorkspaceDownloadController(runtime, resourcePath = "/workspace/resource") {
	let active;
	let activeObjectUrl;
	return {
		cancel() {
			active?.abort();
		},
		release(url) {
			if (typeof url !== "string" || !url) return;
			runtime.revokeObjectURL(url);
			if (activeObjectUrl === url) activeObjectUrl = void 0;
		},
		async start(artifact) {
			const url = buildWorkspaceResourceUrl(artifact, resourcePath);
			if (!url) return {
				status: "unsupported",
				message: "This artifact has no authorized download resource"
			};
			active?.abort();
			if (activeObjectUrl) {
				runtime.revokeObjectURL(activeObjectUrl);
				activeObjectUrl = void 0;
			}
			const controller = new AbortController();
			active = controller;
			try {
				const response = await runtime.fetch(url, { signal: controller.signal });
				if (!response.ok) return {
					status: responseStatus(response.status),
					message: "Workspace download is unavailable"
				};
				const objectUrl = runtime.createObjectURL(await response.blob());
				if (controller.signal.aborted) {
					runtime.revokeObjectURL(objectUrl);
					return {
						status: "cancelled",
						message: "Workspace download cancelled"
					};
				}
				activeObjectUrl = objectUrl;
				return {
					status: "ready",
					url: objectUrl,
					downloadName: artifact.downloadName
				};
			} catch (error) {
				if (controller.signal.aborted || error?.name === "AbortError") return {
					status: "cancelled",
					message: "Workspace download cancelled"
				};
				return {
					status: "error",
					message: "Workspace download is unavailable"
				};
			} finally {
				if (active === controller) active = void 0;
			}
		}
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-artifact-surface.ts
const WORKSPACE_ARTIFACT_OVERLAY_SLOT = "shell.overlay";
const WORKSPACE_ARTIFACT_SLOT_NAME = "shell.overlay";
const WORKSPACE_ARTIFACT_ENTRY_KEY = "dsh-workspace-artifacts";
function remoteValue(result) {
	if (result.ok) return result.value;
	throw new Error("Workspace artifact capability is unavailable");
}
function descriptorFor(artifact, preview) {
	const path = artifact.name;
	switch (preview.type) {
		case "text": return {
			type: "text",
			path,
			renderer: preview.renderer,
			...preview.language === void 0 ? {} : { language: preview.language },
			content: preview.content,
			truncated: preview.truncated
		};
		case "markdown": return {
			type: "markdown",
			path,
			renderer: preview.renderer,
			content: preview.content,
			truncated: preview.truncated,
			policy: preview.policy
		};
		case "json": return {
			type: "json",
			path,
			renderer: preview.renderer,
			value: preview.value
		};
		case "csv": return {
			type: "csv",
			path,
			renderer: preview.renderer,
			columns: preview.columns,
			rows: preview.rows,
			truncated: preview.truncated
		};
		case "binary": return {
			type: "binary",
			path,
			mediaType: preview.mediaType,
			resourceId: preview.resourceId,
			version: preview.version,
			expiresAt: preview.expiresAt
		};
		case "unsupported": return {
			type: "unsupported",
			path,
			reason: preview.reason,
			...preview.mediaType === void 0 ? {} : { mediaType: preview.mediaType },
			...preview.size === void 0 ? {} : { size: preview.size }
		};
		case "error": return {
			type: "error",
			code: preview.code,
			message: preview.message
		};
	}
}
function defaultRuntime() {
	if (typeof globalThis.fetch !== "function" || typeof globalThis.URL?.createObjectURL !== "function") return void 0;
	return {
		fetch: (url, init) => globalThis.fetch(url, init),
		createObjectURL: (blob) => globalThis.URL.createObjectURL(blob),
		revokeObjectURL: (url) => globalThis.URL.revokeObjectURL(url)
	};
}
function formatSize(sizeBytes) {
	if (sizeBytes < 1024) return `${sizeBytes} B`;
	if (sizeBytes < 1048576) return `${Math.round(sizeBytes / 102.4) / 10} KB`;
	return `${Math.round(sizeBytes / 104857.6) / 10} MB`;
}
function artifactIdentity(artifact) {
	if (!artifact) return "";
	return [
		artifact.id,
		artifact.resourceId,
		artifact.version,
		artifact.sizeBytes,
		artifact.preview,
		artifact.mediaType
	].join("\0");
}
/** Convert a path-free Host preview into the existing bounded renderer contract. */
function workspaceArtifactPreviewDescriptor(artifact, preview) {
	return descriptorFor(artifact, preview);
}
/** Build one additive, keyboard-operable artifact list/detail surface. */
function createWorkspaceArtifactSurfaceComponent(remote, primitives, options = {}) {
	return function WorkspaceArtifactSurface(props) {
		const useSessions = props.useSessions;
		const sessionId = useSessions?.((state) => state.current);
		const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
		const [status, setStatus] = useState("loading");
		const [artifacts, setArtifacts] = useState([]);
		const [selectedId, setSelectedId] = useState();
		const [detail, setDetail] = useState();
		const [detailStatus, setDetailStatus] = useState("idle");
		const [message, setMessage] = useState();
		const [download, setDownload] = useState({});
		const selectedButton = useRef(null);
		const downloadController = useRef();
		const request = useRef(0);
		const detailArtifact = useRef();
		const refreshRequest = useRef(0);
		const selectedIdRef = useRef();
		const selectedIdentityRef = useRef("");
		const downloadRequest = useRef(0);
		const runtime = options.runtime ?? defaultRuntime();
		useEffect(() => {
			let active = true;
			if (!activeRemote) {
				setStatus("degraded");
				setMessage("Workspace artifacts are unavailable in this Web scope.");
				return () => {
					active = false;
				};
			}
			const refresh = async () => {
				const token = ++refreshRequest.current;
				try {
					const items = normalizeWorkspaceArtifacts(remoteValue(await activeRemote.artifactMetadata()));
					if (!active || token !== refreshRequest.current) return;
					const currentId = selectedIdRef.current;
					const nextId = currentId && items.some((item) => item.id === currentId) ? currentId : items[0]?.id;
					const nextArtifact = items.find((item) => item.id === nextId);
					const nextIdentity = artifactIdentity(nextArtifact);
					const selectedArtifactChanged = selectedIdentityRef.current !== nextIdentity;
					const refreshTextPreview = nextArtifact !== void 0 && nextArtifact.resourceId === void 0;
					selectedIdRef.current = nextId;
					selectedIdentityRef.current = nextIdentity;
					setArtifacts(items);
					setSelectedId(nextId);
					if (selectedArtifactChanged || refreshTextPreview) {
						request.current += 1;
						detailArtifact.current = void 0;
						setDetail(void 0);
						setDetailStatus("idle");
					}
					if (selectedArtifactChanged) {
						downloadRequest.current += 1;
						downloadController.current?.cancel();
						setDownload({});
					}
					setStatus("ready");
					setMessage(void 0);
				} catch {
					if (!active || token !== refreshRequest.current) return;
					setStatus((current) => current === "loading" ? "degraded" : current);
					setMessage("Workspace artifacts are unavailable in this Web scope.");
				}
			};
			refresh();
			const refreshMs = options.refreshMs ?? 5e3;
			const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => {
				refresh();
			}, refreshMs) : void 0;
			return () => {
				active = false;
				refreshRequest.current += 1;
				if (timer !== void 0) clearInterval(timer);
			};
		}, [activeRemote, options.refreshMs]);
		useEffect(() => {
			if (selectedId) selectedButton.current?.focus();
		}, [selectedId]);
		useEffect(() => () => {
			downloadController.current?.cancel();
			if (download.url) downloadController.current?.release(download.url);
		}, [download.url]);
		useEffect(() => () => {
			downloadRequest.current += 1;
		}, []);
		const selected = artifacts.find((artifact) => artifact.id === selectedId);
		useEffect(() => {
			if (detailArtifact.current === selectedId) return;
			detailArtifact.current = selectedId;
			request.current += 1;
			setDetail(void 0);
			setDetailStatus("idle");
			setMessage(void 0);
		}, [selectedId]);
		useEffect(() => {
			detailArtifact.current = void 0;
			request.current += 1;
			selectedIdRef.current = void 0;
			selectedIdentityRef.current = "";
			setDetail(void 0);
			setDetailStatus("idle");
			setMessage(void 0);
			downloadRequest.current += 1;
			downloadController.current?.cancel();
			setDownload({});
		}, [activeRemote]);
		const select = (artifact) => {
			downloadRequest.current += 1;
			downloadController.current?.cancel();
			detailArtifact.current = artifact.id;
			selectedIdRef.current = artifact.id;
			selectedIdentityRef.current = artifactIdentity(artifact);
			setSelectedId(artifact.id);
			setDetail(void 0);
			setDetailStatus("loading");
			setMessage(void 0);
			setDownload({});
			const token = ++request.current;
			activeRemote?.previewArtifact(artifact.id).then((result) => {
				if (token !== request.current) return;
				if (!result.ok) {
					setDetailStatus("error");
					setMessage("Workspace artifact preview is unavailable.");
					return;
				}
				const detailValue = createWorkspaceArtifactDetail(artifact, descriptorFor(artifact, result.value));
				setDetail(detailValue.descriptor);
				setDetailStatus(detailValue.status);
				setMessage(detailValue.message);
			}).catch(() => {
				if (token !== request.current) return;
				setDetailStatus("error");
				setMessage("Workspace artifact preview is unavailable.");
			});
		};
		useEffect(() => {
			if (status === "ready" && selected && detail === void 0 && detailStatus === "idle") select(selected);
		}, [
			status,
			selectedId,
			artifacts,
			detail,
			detailStatus,
			activeRemote
		]);
		const downloadArtifact = async () => {
			const token = ++downloadRequest.current;
			if (!selected || !runtime) {
				setDownload({ status: "unsupported" });
				return;
			}
			downloadController.current ??= createWorkspaceDownloadController(runtime, options.resourcePath);
			setDownload({ status: "loading" });
			const result = await downloadController.current.start(selected);
			if (token !== downloadRequest.current) {
				if (result.url) downloadController.current.release(result.url);
				return;
			}
			setDownload({
				status: result.status,
				url: result.url,
				name: result.downloadName
			});
		};
		const body = status === "loading" ? createElement("p", { role: "status" }, "Loading Workspace artifacts…") : status === "degraded" ? createElement("p", { role: "status" }, message ?? "Workspace artifacts are unavailable.") : createElement("div", { "data-dsh-workspace": "artifact-surface" }, createElement("ul", { "aria-label": "Workspace artifacts" }, artifacts.map((artifact) => createElement("li", { key: artifact.id }, createElement("button", {
			ref: artifact.id === selectedId ? selectedButton : void 0,
			type: "button",
			"aria-pressed": artifact.id === selectedId,
			onClick: () => select(artifact)
		}, artifact.name), createElement("span", { "aria-label": `${artifact.mediaType}, ${formatSize(artifact.sizeBytes)}, ${artifact.preview}` }, ` ${artifact.mediaType} · ${formatSize(artifact.sizeBytes)} · ${artifact.preview}`)))), selected && detail && createElement("article", {
			"aria-label": `${selected.name} preview`,
			"data-dsh-workspace": "artifact-detail"
		}, createElement("h3", null, selected.name), createElement("p", {
			"aria-label": "Artifact provenance",
			"data-dsh-workspace": "artifact-provenance"
		}, `Source ${selected.source.kind} · session ${selected.source.sessionId} · workspace ${selected.source.workspaceId}`), createWorkspacePreviewRenderer(primitives, detail, {
			resourcePath: options.resourcePath,
			downloadName: selected.downloadName,
			altText: selected.altText
		}), selected.resourceId && createElement("button", {
			type: "button",
			onClick: downloadArtifact
		}, download.status === "loading" ? "Downloading…" : "Download"), download.status === "loading" && createElement("button", {
			type: "button",
			onClick: () => downloadController.current?.cancel()
		}, "Cancel download"), download.url && createElement("a", {
			href: download.url,
			download: download.name ?? selected.downloadName
		}, "Save download"), message && createElement("p", { role: "status" }, message)), selected && !detail && detailStatus === "loading" && createElement("p", { role: "status" }, "Loading artifact preview…"), artifacts.length === 0 && createElement("p", { role: "status" }, "No session artifacts yet."), selected && !detail && detailStatus !== "loading" && message && createElement("p", { role: "status" }, message));
		if (!sessionId) return null;
		return createElement("section", {
			"data-dsh-workspace": "artifacts",
			role: "region",
			"aria-label": "Workspace artifacts"
		}, createElement("h2", null, "Workspace artifacts"), body);
	};
}
function workspaceArtifactResourceUrl(artifact) {
	return buildWorkspaceResourceUrl(artifact);
}
//#endregion
//#region packages/plugin/src/web/workspace-memory-surface.ts
const WORKSPACE_MEMORY_OVERLAY_SLOT = "shell.overlay";
const WORKSPACE_MEMORY_ENTRY_KEY = "dsh-workspace-memory";
const workspaceMemoryTypes = [
	"decision",
	"preference",
	"convention",
	"fact"
];
function workspaceMemoryRequest(scope, userId, sharedProject = false) {
	if (scope === "user") return {
		scope,
		userId: userId.trim() || "default"
	};
	return scope === "shared-project" ? {
		scope,
		sharedProject: true
	} : { scope };
}
function workspaceMemoryRecordSummary(record) {
	const provenance = record.provenance.sessionId ? `${record.provenance.kind}/${record.provenance.sessionId}` : record.provenance.kind;
	return `${record.scope} · ${record.type} · ${provenance} · ${record.contentHash.slice(0, 15)} · updated ${record.updatedAt} · last-used ${record.lastUsedAt ?? "never"} · used ${record.useCount}`;
}
function valueOf(result) {
	if (result.ok) return result.value;
	throw new Error(`${result.error.code}: ${result.error.message}`);
}
function errorMessage(error) {
	return error instanceof Error && error.message ? error.message : "Memory operation failed; records were not changed.";
}
function scopeLabel(scope) {
	return scope === "shared-project" ? "Shared Project" : scope[0].toUpperCase() + scope.slice(1);
}
function displayGovernance(record) {
	if (record.governance) return record.governance;
	const userAuthored = record.provenance.kind === "user";
	return {
		origin: userAuthored ? "user-authored" : record.provenance.kind === "import" ? "imported" : "derived",
		sourceRefs: userAuthored ? [] : [{
			kind: record.provenance.kind === "import" ? "import" : "session",
			id: record.provenance.sessionId ?? record.id
		}],
		verification: userAuthored ? "verified" : "unverified",
		...userAuthored ? {
			verifiedAt: record.updatedAt,
			verifiedBy: "user"
		} : {},
		revision: 1,
		retention: record.scope === "session" ? "session-end" : record.scope === "user" ? "user-managed" : "project-delete"
	};
}
/** Review-only Memory surface. It never calls Agent, followup, or prompt/context APIs. */
function createWorkspaceMemorySurfaceComponent(options = {}) {
	return function WorkspaceMemorySurface(props) {
		const useSessions = props.useSessions;
		const sessionId = useSessions?.((state) => state.current);
		const remote = options.resolveRemote ? options.resolveRemote(sessionId) : options.remote;
		const [scope, setScope] = useState("project");
		const [userId, setUserId] = useState("default");
		const [sharedProject, setSharedProject] = useState(false);
		const [sharedWriteAcknowledged, setSharedWriteAcknowledged] = useState(false);
		const [state, setState] = useState();
		const [records, setRecords] = useState([]);
		const [selectedId, setSelectedId] = useState();
		const [query, setQuery] = useState("");
		const [title, setTitle] = useState("");
		const [content, setContent] = useState("");
		const [type, setType] = useState("fact");
		const [filterType, setFilterType] = useState("");
		const [statusFilter, setStatusFilter] = useState("active");
		const [pinnedId, setPinnedId] = useState();
		const [forgetPending, setForgetPending] = useState(false);
		const [status, setStatus] = useState("loading");
		const [message, setMessage] = useState();
		const requestToken = useRef(0);
		const selectedButton = useRef(null);
		const scopeFirstButton = useRef(null);
		const forgetTrigger = useRef(null);
		const confirmButton = useRef(null);
		const requestBase = workspaceMemoryRequest(scope, userId, sharedProject);
		const request = scope === "shared-project" ? {
			...requestBase,
			sharedWriteAcknowledged
		} : requestBase;
		const selected = records.find((record) => record.id === selectedId);
		const selectedGovernance = selected && displayGovernance(selected);
		const conflictingRecords = selected === void 0 ? [] : records.filter((record) => record.id !== selected.id && record.type === selected.type && record.title.trim().toLocaleLowerCase() === selected.title.trim().toLocaleLowerCase() && record.contentHash !== selected.contentHash);
		const hasConflict = conflictingRecords.length > 0;
		const writesAllowed = scope !== "shared-project" || sharedWriteAcknowledged;
		const load = async (text = query) => {
			const token = ++requestToken.current;
			if (!remote) {
				setStatus("degraded");
				setMessage("Workspace Memory is unavailable in this Web scope.");
				return;
			}
			try {
				const opened = valueOf(await remote.memoryOpen(request));
				const filters = {
					limit: 100,
					status: statusFilter,
					...filterType ? { type: filterType } : {}
				};
				const next = text.trim() ? valueOf(await remote.memorySearch(request, text, filters)) : valueOf(await remote.memoryList(request, filters));
				if (token !== requestToken.current) return;
				setState(opened);
				setRecords(next);
				setSelectedId((current) => current && next.some((record) => record.id === current) ? current : next[0]?.id);
				setStatus("ready");
				setMessage(opened.readOnly ? "This Memory file uses a newer schema and is read-only." : opened.warnings.length ? `${opened.warnings.length} local record warning(s).` : void 0);
			} catch (error) {
				if (token !== requestToken.current) return;
				setStatus("degraded");
				setMessage(errorMessage(error));
			}
		};
		useEffect(() => {
			requestToken.current += 1;
			setState(void 0);
			setRecords([]);
			setSelectedId(void 0);
			setPinnedId(void 0);
			setSharedWriteAcknowledged(false);
			setTitle("");
			setContent("");
			load("");
			return () => {
				requestToken.current += 1;
			};
		}, [
			remote,
			request.scope,
			request.userId,
			request.sharedProject,
			filterType,
			statusFilter
		]);
		useEffect(() => {
			selectedButton.current?.focus();
		}, [selectedId]);
		useEffect(() => {
			if (!selected) return;
			setTitle(selected.title);
			setContent(selected.content);
			setType(selected.type);
		}, [selectedId]);
		const save = async () => {
			if (!remote || !state) return;
			try {
				if (!writesAllowed) {
					setMessage("Acknowledge Shared Project writes before changing Memory.");
					return;
				}
				const draft = {
					scope: state.scope,
					scopeKey: state.scopeKey,
					type,
					title,
					content,
					tags: selected?.tags ?? [],
					provenance: { kind: "user" },
					...selected ? {
						id: selected.id,
						expectedRevision: selectedGovernance?.revision ?? 1,
						expectedHash: selected.contentHash
					} : {}
				};
				valueOf(await remote.memoryUpsert(request, draft));
				await load("");
				setMessage("Memory saved locally.");
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const mutate = async (operation) => {
			if (!remote || !selected) return;
			if (!writesAllowed) {
				setMessage("Acknowledge Shared Project writes before changing Memory.");
				return;
			}
			try {
				valueOf(await remote.memoryGovern(request, selected.id, operation, selectedGovernance?.revision ?? 1, selected.contentHash));
				setSelectedId(void 0);
				setTitle("");
				setContent("");
				await load("");
				if (operation === "forget") setTimeout(() => scopeFirstButton.current?.focus(), 0);
				setMessage(`Memory ${{
					archive: "archived",
					forget: "forgotten",
					verify: "verified",
					reverify: "re-verified",
					pin: "pinned",
					unpin: "unpinned",
					restore: "restored",
					reject: "rejected"
				}[operation]} locally.`);
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const resolveConflict = async () => {
			if (!remote || !selected || !hasConflict || !writesAllowed) return;
			try {
				if (selectedGovernance?.verification === "unverified") valueOf(await remote.memoryGovern(request, selected.id, "verify", selectedGovernance.revision, selected.contentHash));
				for (const conflict of conflictingRecords) {
					const governance = displayGovernance(conflict);
					if (governance.verification === "unverified") valueOf(await remote.memoryGovern(request, conflict.id, "reject", governance.revision, conflict.contentHash));
					else if (conflict.status === "active") valueOf(await remote.memoryGovern(request, conflict.id, "archive", governance.revision, conflict.contentHash));
				}
				await load("");
				setMessage("Kept the selected Memory version and resolved conflicting records.");
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		useEffect(() => {
			if (forgetPending) confirmButton.current?.focus();
		}, [forgetPending]);
		const exportMemory = async () => {
			if (!remote) return;
			try {
				const serialized = valueOf(await remote.memoryExport(request));
				const url = globalThis.URL?.createObjectURL?.(new Blob([serialized], { type: "application/json" }));
				if (url && typeof document !== "undefined") {
					const anchor = document.createElement("a");
					anchor.href = url;
					anchor.download = "dsh-memory-export.json";
					anchor.click();
					globalThis.URL.revokeObjectURL(url);
				}
				setMessage(`Memory export ready (${serialized.length} bytes).`);
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const importMemory = async (event) => {
			const file = event.target.files?.[0];
			if (!remote || !file) return;
			try {
				if (!writesAllowed) throw new Error("Acknowledge Shared Project writes before importing Memory.");
				if (file.size !== void 0 && file.size > 8388608) throw new Error("Memory import exceeds the safe size limit.");
				const imported = valueOf(await remote.memoryImport(request, await file.text()));
				await load("");
				setMessage(`${imported.length} record(s) imported as unverified review items.`);
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const scopeButtons = createElement("div", {
			role: "group",
			"aria-label": "Memory scope"
		}, [
			"project",
			"session",
			"user",
			"shared-project"
		].map((value) => createElement("button", {
			key: value,
			ref: value === "project" ? scopeFirstButton : void 0,
			type: "button",
			"aria-pressed": scope === value,
			onClick: () => {
				setScope(value);
				setSharedProject(value === "shared-project");
				setSharedWriteAcknowledged(false);
			}
		}, scopeLabel(value))));
		const recordList = createElement("ul", { "aria-label": "Memory records" }, records.map((record) => createElement("li", { key: record.id }, createElement("button", {
			ref: record.id === selectedId ? selectedButton : void 0,
			type: "button",
			"aria-pressed": record.id === selectedId,
			onClick: () => setSelectedId(record.id)
		}, record.title), createElement("span", null, ` ${workspaceMemoryRecordSummary(record)} · ${displayGovernance(record).verification}${record.status !== "active" ? ` · ${record.status}` : ""}`))));
		const editor = createElement("form", {
			onSubmit: (event) => {
				event.preventDefault();
				save();
			},
			"aria-label": selected ? "Edit Memory" : "Create Memory"
		}, createElement("label", null, "Title ", createElement("input", {
			value: title,
			maxLength: 256,
			onChange: (event) => setTitle(event.target.value)
		})), createElement("label", null, "Type ", createElement("select", {
			value: type,
			onChange: (event) => setType(event.target.value)
		}, workspaceMemoryTypes.map((value) => createElement("option", {
			key: value,
			value
		}, value)))), createElement("label", null, "Content ", createElement("textarea", {
			value: content,
			maxLength: 65536,
			onChange: (event) => setContent(event.target.value)
		})), createElement("button", {
			type: "submit",
			disabled: !state || state.readOnly || !writesAllowed
		}, selected ? "Save changes" : "Create Memory"), selected && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("archive")
		}, "Archive"), selected && createElement("button", {
			ref: forgetTrigger,
			type: "button",
			disabled: !writesAllowed,
			onClick: () => setForgetPending(true)
		}, "Forget"), selected?.status === "archived" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("restore")
		}, "Restore"), selectedGovernance?.verification === "unverified" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("verify")
		}, "Verify"), selectedGovernance?.verification === "unverified" && hasConflict && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("reject")
		}, "Reject conflict"), selectedGovernance?.verification === "stale" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("reverify")
		}, "Re-verify"), selectedGovernance?.verification === "verified" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate(selectedGovernance.pinnedAt === void 0 ? "pin" : "unpin")
		}, selectedGovernance.pinnedAt === void 0 ? "Pin" : "Unpin"), selected && createElement("button", {
			type: "button",
			"aria-pressed": pinnedId === selected.id,
			onClick: () => {
				setPinnedId(selected.id);
				setMessage("Pinned for review only; Memory is not injected into Agent context.");
			}
		}, pinnedId === selected.id ? "Pinned for review" : "Pin for review"));
		const body = status === "loading" ? createElement("p", { role: "status" }, "Loading Workspace Memory…") : status === "degraded" ? createElement("p", { role: "status" }, message ?? "Workspace Memory is unavailable.") : createElement("div", { "data-dsh-workspace": "memory-surface" }, scopeButtons, scope === "shared-project" && createElement("label", null, createElement("input", {
			type: "checkbox",
			checked: sharedWriteAcknowledged,
			onChange: (event) => setSharedWriteAcknowledged(event.target.checked)
		}), " I understand this writes to the shared Workspace Memory."), scope === "user" && createElement("label", null, "User profile ", createElement("input", {
			value: userId,
			onChange: (event) => setUserId(event.target.value),
			"aria-label": "User Memory profile"
		})), createElement("form", { onSubmit: (event) => {
			event.preventDefault();
			load(query);
		} }, createElement("label", null, "Search Memory ", createElement("input", {
			value: query,
			onChange: (event) => setQuery(event.target.value),
			"aria-label": "Search Memory"
		})), createElement("button", { type: "submit" }, "Search")), createElement("label", null, "Type filter ", createElement("select", {
			value: filterType,
			onChange: (event) => setFilterType(event.target.value),
			"aria-label": "Filter Memory type"
		}, createElement("option", { value: "" }, "All types"), workspaceMemoryTypes.map((value) => createElement("option", {
			key: value,
			value
		}, value)))), createElement("label", null, "Status filter ", createElement("select", {
			value: statusFilter,
			onChange: (event) => setStatusFilter(event.target.value),
			"aria-label": "Filter Memory status"
		}, [
			"active",
			"archived",
			"forgotten"
		].map((value) => createElement("option", {
			key: value,
			value
		}, value)))), createElement("button", {
			type: "button",
			onClick: () => void exportMemory()
		}, "Export Memory"), createElement("label", null, "Import Memory ", createElement("input", {
			type: "file",
			disabled: !writesAllowed,
			accept: "application/json,.json,.jsonl",
			onChange: (event) => void importMemory(event)
		})), recordList, selected && selectedGovernance && createElement("dl", { "aria-label": "Memory governance" }, createElement("dt", null, "Origin"), createElement("dd", null, selectedGovernance.origin), createElement("dt", null, "Verification"), createElement("dd", null, selectedGovernance.verification), createElement("dt", null, "Retention"), createElement("dd", null, selectedGovernance.retention), createElement("dt", null, "Revision"), createElement("dd", null, String(selectedGovernance.revision)), createElement("dt", null, "Sources"), createElement("dd", null, selectedGovernance.sourceRefs.map((source) => `${source.kind}/${source.id}`).join(", ") || "none"), selectedGovernance.conflictGroup && createElement("dt", null, "Conflict group"), selectedGovernance.conflictGroup && createElement("dd", null, selectedGovernance.conflictGroup), selectedGovernance.expiresAt !== void 0 && createElement("dt", null, "Expires"), selectedGovernance.expiresAt !== void 0 && createElement("dd", null, String(selectedGovernance.expiresAt))), hasConflict && createElement("p", { role: "status" }, "Conflicting Memory uses the same title and type with different content. Verify one or reject this item."), hasConflict && createElement("aside", { "aria-label": "Memory conflict comparison" }, createElement("h3", null, "Conflict comparison"), createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void resolveConflict()
		}, "Keep this version"), [selected, ...conflictingRecords].map((record) => createElement("article", { key: record.id }, createElement("button", {
			type: "button",
			onClick: () => setSelectedId(record.id)
		}, `Review ${record.id}`), createElement("span", null, ` · ${displayGovernance(record).verification} · revision ${displayGovernance(record).revision} · ${record.contentHash.slice(0, 15)}`), createElement("p", null, record.content.slice(0, 256))))), editor, createElement("p", { role: "status" }, state?.readOnly ? "Read-only Memory" : "Review only: Memory never injects records into Agent context."), message && createElement("p", { role: "status" }, message));
		const confirmation = forgetPending && selected && createElement("div", {
			role: "alertdialog",
			"aria-modal": "true",
			"aria-labelledby": "memory-forget-title",
			"aria-describedby": "memory-forget-description"
		}, createElement("h3", { id: "memory-forget-title" }, "Forget Memory?"), createElement("p", { id: "memory-forget-description" }, `This will tombstone 1 record in ${scopeLabel(selected.scope)}. Existing exports or model turns cannot be recalled.`), createElement("button", {
			ref: confirmButton,
			type: "button",
			onClick: () => {
				setForgetPending(false);
				mutate("forget");
			}
		}, "Forget record"), createElement("button", {
			type: "button",
			onClick: () => {
				setForgetPending(false);
				forgetTrigger.current?.focus();
			}
		}, "Cancel"));
		if (!sessionId) return null;
		return createElement("section", {
			role: "region",
			"aria-label": "Workspace Memory",
			"data-dsh-workspace": "memory"
		}, createElement("h2", null, "Workspace Memory"), body, confirmation);
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-panel.ts
const WORKSPACE_PANEL_OVERLAY_SLOT = "shell.overlay";
const WORKSPACE_PANEL_ENTRY_KEY = "dsh-workspace-panel";
const WORKSPACE_STYLE_ID = "dsh-workspace-panel-styles";
const WORKSPACE_PANEL_STYLES = `
[data-dsh-workspace="panel"] {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  color: CanvasText;
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

[data-dsh-workspace="panel"] *,
[data-dsh-workspace="panel"] *::before,
[data-dsh-workspace="panel"] *::after {
  box-sizing: border-box;
}

[data-dsh-workspace="panel"] button,
[data-dsh-workspace="panel"] input,
[data-dsh-workspace="panel"] select,
[data-dsh-workspace="panel"] textarea {
  color: inherit;
  font: inherit;
}

[data-dsh-workspace="panel"] > summary {
  position: absolute;
  right: 16px;
  bottom: 16px;
  pointer-events: auto;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 999px;
  background: Canvas;
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  cursor: pointer;
  font-weight: 600;
  list-style: none;
}

[data-dsh-workspace="panel"] > summary::-webkit-details-marker {
  display: none;
}

[data-dsh-workspace="panel"] > summary:hover,
[data-dsh-workspace="panel"] > summary:focus-visible {
  border-color: color-mix(in srgb, CanvasText 36%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 2px;
}

[data-dsh-workspace="panel"] [data-dsh-workspace="view"] {
  color: CanvasText;
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

[data-dsh-workspace="panel"] [data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] {
  min-width: 0;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [for="dsh-workspace-view-tab-artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [for="dsh-workspace-view-tab-memory"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: color-mix(in srgb, Highlight 14%, transparent);
  color: CanvasText;
  font-weight: 600;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [data-dsh-workspace-tab="memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [data-dsh-workspace-tab="artifacts"] {
  display: none;
}

[data-dsh-workspace="panel"][open] > summary {
  display: none;
}

[data-dsh-workspace="panel"] [data-dsh-workspace="drawer"] {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  width: min(440px, calc(100vw - 24px));
  min-height: 0;
  pointer-events: auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
  border-radius: 16px;
  background: Canvas;
  box-shadow: 0 18px 48px rgb(0 0 0 / 20%);
}

[data-dsh-workspace="panel-header"] {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
}

[data-dsh-workspace="panel-heading"] {
  display: grid;
  gap: 3px;
  min-width: 0;
}

[data-dsh-workspace="panel-heading"] strong {
  font-size: 15px;
  line-height: 1.3;
}

[data-dsh-workspace="panel-heading"] span {
  color: color-mix(in srgb, CanvasText 64%, transparent);
  font-size: 12px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-close"],
[data-dsh-workspace="panel-tab"] {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

[data-dsh-workspace="panel-close"] {
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
}

[data-dsh-workspace="panel-close"]:hover,
[data-dsh-workspace="panel-close"]:focus-visible,
[data-dsh-workspace="panel-tab"]:hover,
[data-dsh-workspace="panel-tab"]:focus-visible {
  border-color: color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 7%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="panel-tabs"] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
}

[data-dsh-workspace="tab-input"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

[data-dsh-workspace="panel-tab"] {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  color: color-mix(in srgb, CanvasText 68%, transparent);
  font-size: 13px;
}

[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-artifacts:checked) [for="dsh-workspace-tab-artifacts"],
[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-memory:checked) [for="dsh-workspace-tab-memory"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: color-mix(in srgb, Highlight 14%, transparent);
  color: CanvasText;
  font-weight: 600;
}

[data-dsh-workspace="drawer"] [data-dsh-workspace="tab-content"] {
  min-width: 0;
}

[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-artifacts:checked) [data-dsh-workspace-tab="memory"],
[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-memory:checked) [data-dsh-workspace-tab="artifacts"] {
  display: none;
}

[data-dsh-workspace="panel-content"] {
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

[data-dsh-workspace="panel-content"] > section {
  min-width: 0;
}

[data-dsh-workspace="panel-content"] h2 {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h3 {
  margin: 14px 0 6px;
  font-size: 13px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] p,
[data-dsh-workspace="panel-content"] dl,
[data-dsh-workspace="panel-content"] ul,
[data-dsh-workspace="panel-content"] article {
  overflow-wrap: anywhere;
}

[data-dsh-workspace="panel-content"] p {
  margin: 8px 0;
  color: color-mix(in srgb, CanvasText 68%, transparent);
  font-size: 12px;
  line-height: 1.5;
}

[data-dsh-workspace="panel-content"] button,
[data-dsh-workspace="panel-content"] input,
[data-dsh-workspace="panel-content"] select,
[data-dsh-workspace="panel-content"] textarea {
  min-height: 34px;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 8px;
  background: Canvas;
}

[data-dsh-workspace="panel-content"] button {
  padding: 6px 10px;
  cursor: pointer;
}

[data-dsh-workspace="panel-content"] button:disabled {
  cursor: not-allowed;
  opacity: .52;
}

[data-dsh-workspace="panel-content"] button:hover:not(:disabled),
[data-dsh-workspace="panel-content"] button:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="panel-content"] input,
[data-dsh-workspace="panel-content"] select,
[data-dsh-workspace="panel-content"] textarea {
  width: 100%;
  padding: 7px 9px;
}

[data-dsh-workspace="panel-content"] textarea {
  min-height: 92px;
  resize: vertical;
}

[data-dsh-workspace="panel-content"] label {
  display: grid;
  gap: 5px;
  min-width: 0;
  margin: 8px 0;
  color: color-mix(in srgb, CanvasText 72%, transparent);
  font-size: 12px;
}

[data-dsh-workspace="panel-content"] form,
[data-dsh-workspace="panel-content"] [role="group"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 8px 0;
}

[data-dsh-workspace="panel-content"] form[aria-label] {
  display: grid;
  align-items: stretch;
}

[data-dsh-workspace="panel-content"] [role="group"] button {
  flex: 1 1 100px;
}

[data-dsh-workspace="panel-content"] ul {
  display: grid;
  gap: 6px;
  max-height: 180px;
  margin: 10px 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

[data-dsh-workspace="panel-content"] li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 10px;
}

[data-dsh-workspace="panel-content"] li button {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="panel-content"] li span {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, CanvasText 58%, transparent);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="panel-content"] article,
[data-dsh-workspace="panel-content"] aside {
  margin: 10px 0;
  padding: 10px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 10px;
}

[data-dsh-workspace="panel-content"] pre,
[data-dsh-workspace="panel-content"] table {
  max-width: 100%;
  overflow: auto;
}

@media (max-width: 760px) {
  [data-dsh-workspace="panel"] [data-dsh-workspace="drawer"] {
    top: 8px;
    right: 8px;
    bottom: 8px;
    left: 8px;
    width: auto;
    border-radius: 14px;
  }

[data-dsh-workspace="panel"] > summary {
    right: 12px;
    bottom: 12px;
  }
}
`;
let styleUsers = 0;
function installWorkspacePanelStyles() {
	const dom = typeof document === "object" ? document : void 0;
	if (!dom || typeof dom.getElementById !== "function" || typeof dom.createElement !== "function" || !dom.head || typeof dom.head.appendChild !== "function") return () => void 0;
	let style = dom.getElementById(WORKSPACE_STYLE_ID);
	if (!style) {
		style = dom.createElement("style");
		style.id = WORKSPACE_STYLE_ID;
		style.textContent = WORKSPACE_PANEL_STYLES;
		dom.head.appendChild(style);
	}
	styleUsers += 1;
	let disposed = false;
	return () => {
		if (disposed) return;
		disposed = true;
		styleUsers -= 1;
		if (styleUsers === 0) style?.remove();
	};
}
function createWorkspacePanelComponent(options) {
	return function WorkspacePanel(props) {
		return createElement("details", { "data-dsh-workspace": "panel" }, createElement("summary", { "aria-label": "Open Workspace" }, "Workspace"), createElement("aside", {
			id: "dsh-workspace-drawer",
			role: "dialog",
			"aria-label": "Workspace",
			"data-dsh-workspace": "drawer"
		}, createElement("input", {
			id: "dsh-workspace-tab-artifacts",
			name: "dsh-workspace-tab",
			type: "radio",
			defaultChecked: true,
			"data-dsh-workspace": "tab-input",
			"aria-label": "Artifacts"
		}), createElement("input", {
			id: "dsh-workspace-tab-memory",
			name: "dsh-workspace-tab",
			type: "radio",
			"data-dsh-workspace": "tab-input",
			"aria-label": "Memory"
		}), createElement("header", { "data-dsh-workspace": "panel-header" }, createElement("div", { "data-dsh-workspace": "panel-heading" }, createElement("strong", null, "Workspace"), createElement("span", null, "Inspect artifacts and local Memory")), createElement("button", {
			type: "button",
			"data-dsh-workspace": "panel-close",
			"aria-label": "Close Workspace",
			onClick: (event) => {
				event.currentTarget.closest("details")?.removeAttribute("open");
			}
		}, "×")), createElement("div", {
			role: "group",
			"aria-label": "Workspace sections",
			"data-dsh-workspace": "panel-tabs"
		}, createElement("label", {
			htmlFor: "dsh-workspace-tab-artifacts",
			"data-dsh-workspace": "panel-tab"
		}, "Artifacts"), createElement("label", {
			htmlFor: "dsh-workspace-tab-memory",
			"data-dsh-workspace": "panel-tab"
		}, "Memory")), createElement("div", { "data-dsh-workspace": "panel-content" }, createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "artifacts"
		}, createElement(options.artifacts, props)), createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "memory"
		}, createElement(options.memory, props)))));
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-view.ts
/** The public Harness conversation view ring: one list entry per view tab. */
const WORKSPACE_VIEW_SLOT = "conversation.view";
const WORKSPACE_VIEW_ENTRY_KEY = "dsh-workspace";
const WORKSPACE_VIEW_ORDER = 20;
const WORKSPACE_VIEW_LABEL = "Workspace";
/** Pinned registration descriptor; the client contribution registers this into `conversation.view`. */
function workspaceConversationViewRegistration() {
	return Object.freeze({
		name: WORKSPACE_VIEW_SLOT,
		id: WORKSPACE_VIEW_ENTRY_KEY,
		order: 20,
		label: WORKSPACE_VIEW_LABEL
	});
}
/**
* Conversation view tab body: the Artifacts/Memory switch rendered in the
* tab row's body, reusing the existing surfaces unchanged. Session-scoped
* slot components receive the global `useSessions` seat, which the surfaces
* already read, so no remote-resolution changes are needed.
*/
function createWorkspaceConversationViewComponent(options) {
	return function WorkspaceConversationView(props) {
		return createElement("section", {
			role: "region",
			"aria-label": "Workspace",
			"data-dsh-workspace": "view"
		}, createElement("input", {
			id: "dsh-workspace-view-tab-artifacts",
			name: "dsh-workspace-view-tab",
			type: "radio",
			defaultChecked: true,
			"data-dsh-workspace": "tab-input",
			"aria-label": "Artifacts"
		}), createElement("input", {
			id: "dsh-workspace-view-tab-memory",
			name: "dsh-workspace-view-tab",
			type: "radio",
			"data-dsh-workspace": "tab-input",
			"aria-label": "Memory"
		}), createElement("div", {
			role: "group",
			"aria-label": "Workspace sections",
			"data-dsh-workspace": "panel-tabs"
		}, createElement("label", {
			htmlFor: "dsh-workspace-view-tab-artifacts",
			"data-dsh-workspace": "panel-tab"
		}, "Artifacts"), createElement("label", {
			htmlFor: "dsh-workspace-view-tab-memory",
			"data-dsh-workspace": "panel-tab"
		}, "Memory")), createElement("div", { "data-dsh-workspace": "panel-content" }, createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "artifacts"
		}, createElement(options.artifacts, props)), createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "memory"
		}, createElement(options.memory, props))));
	};
}
//#endregion
//#region packages/plugin/src/client.ts
const workspaceClient = Object.freeze({ ready: true });
function renderWorkspacePreview(descriptor, options) {
	return createWorkspacePreviewRenderer({
		MarkdownText,
		CodeBlock,
		JsonTree
	}, descriptor, options);
}
const inject = [
	"conversationEvents",
	"slots",
	"remote",
	"sessions"
];
async function apply(ctx) {
	if (!ctx?.conversationEvents || !ctx.slots || typeof ctx.effect !== "function" || !ctx.remote?.$mount || typeof ctx.emit !== "function") throw new Error("DSH Workspace requires the public conversation and Typert Remote seams");
	const remoteDispose = await ctx.remote.$mount(TYPERT_REMOTE);
	let disposeConversation;
	try {
		ctx.effect(() => {
			const disposeEvent = ctx.conversationEvents.register(workspaceConversationDefinition);
			const disposeSlot = ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "dsh-workspace-summary"
			}, createWorkspaceChatNodeComponent((model) => createElement("section", { "data-dsh-workspace": "summary" }, createElement("strong", null, model.summary.workspaceName), createElement("span", null, ` ${model.summary.filesTouched} files, ${model.summary.changes} changes`), createElement("button", {
				type: "button",
				onClick: model.openWorkspace.action
			}, model.openWorkspace.label)), () => ctx.emit("workspace/open"))));
			let disposed = false;
			let disposeOverlay = () => {};
			const overlay = ctx.slots;
			if (typeof overlay.inject === "function" && typeof overlay.register === "function") {
				const registerOverlay = (scope) => {
					const workspace = scope.remote.workspace;
					const remotes = /* @__PURE__ */ new Map();
					const resolveRemote = (sessionId) => {
						if (!sessionId || !workspace) return void 0;
						const cached = remotes.get(sessionId);
						if (cached) return cached;
						const call = (method, ...args) => workspace[method](sessionId, ...args);
						const adapted = {
							artifactMetadata: () => call("artifactMetadata"),
							previewArtifact: (id) => call("previewArtifact", id),
							memoryOpen: (request) => call("memoryOpen", request),
							memoryList: (request, options) => call("memoryList", request, options),
							memorySearch: (request, query, options) => call("memorySearch", request, query, options),
							memoryUpsert: (request, draft) => call("memoryUpsert", request, draft),
							memoryArchive: (request, id, revision, hash) => call("memoryArchive", request, id, revision, hash),
							memoryForget: (request, id, revision, hash) => call("memoryForget", request, id, revision, hash),
							memoryGovern: (request, id, action, revision, hash) => call("memoryGovern", request, id, action, revision, hash),
							memoryExport: (request) => call("memoryExport", request),
							memoryImport: (request, serialized) => call("memoryImport", request, serialized)
						};
						remotes.set(sessionId, adapted);
						return adapted;
					};
					const disposeStyles = installWorkspacePanelStyles();
					const disposeWorkspaceOverlay = overlay.inject(WORKSPACE_PANEL_OVERLAY_SLOT, () => overlay.register({
						name: WORKSPACE_PANEL_OVERLAY_SLOT,
						id: WORKSPACE_PANEL_ENTRY_KEY,
						label: "Workspace",
						order: 0,
						priority: 100
					}, createWorkspacePanelComponent({
						artifacts: createWorkspaceArtifactSurfaceComponent(void 0, {
							MarkdownText,
							CodeBlock,
							JsonTree
						}, { resolveRemote }),
						memory: createWorkspaceMemorySurfaceComponent({ resolveRemote })
					})));
					let disposeWorkspaceView = () => {};
					const viewSlots = ctx.slots;
					if (typeof viewSlots.inject === "function" && typeof viewSlots.register === "function") disposeWorkspaceView = viewSlots.inject(WORKSPACE_VIEW_SLOT, () => viewSlots.register(workspaceConversationViewRegistration(), createWorkspaceConversationViewComponent({
						artifacts: createWorkspaceArtifactSurfaceComponent(void 0, {
							MarkdownText,
							CodeBlock,
							JsonTree
						}, { resolveRemote }),
						memory: createWorkspaceMemorySurfaceComponent({ resolveRemote })
					})));
					return () => {
						remotes.clear();
						disposeStyles();
						disposeWorkspaceOverlay();
						disposeWorkspaceView();
					};
				};
				let directWorkspace = false;
				try {
					directWorkspace = Boolean(ctx.remote.workspace);
				} catch {}
				if (directWorkspace) disposeOverlay = registerOverlay(ctx);
				else {
					const remoteScope = ctx.inject?.(["remote.workspace"], registerOverlay);
					if (remoteScope) disposeOverlay = () => {
						remoteScope.dispose();
					};
					else disposeOverlay = registerOverlay(ctx);
				}
			}
			disposeConversation = () => {
				if (disposed) return;
				disposed = true;
				disposeOverlay();
				disposeSlot();
				disposeEvent();
			};
			return disposeConversation;
		}, "dsh Workspace client contribution");
	} catch (error) {
		await remoteDispose();
		throw error;
	}
	return async () => {
		const dispose = disposeConversation;
		disposeConversation = void 0;
		dispose?.();
		await remoteDispose();
	};
}
//#endregion

    Object.assign(exports, { WORKSPACE_ARTIFACT_ENTRY_KEY, WORKSPACE_ARTIFACT_OVERLAY_SLOT, WORKSPACE_ARTIFACT_SLOT_NAME, WORKSPACE_MEMORY_ENTRY_KEY, WORKSPACE_MEMORY_OVERLAY_SLOT, WORKSPACE_PANEL_ENTRY_KEY, WORKSPACE_PANEL_OVERLAY_SLOT, WORKSPACE_VIEW_ENTRY_KEY, WORKSPACE_VIEW_LABEL, WORKSPACE_VIEW_ORDER, WORKSPACE_VIEW_SLOT, apply, applyWorkspaceConversationContribution, buildWorkspaceResourceUrl, createWorkspaceArtifactDetail, createWorkspaceArtifactSurfaceComponent, createWorkspaceArtifactView, createWorkspaceChatNodeComponent, createWorkspaceConversationViewComponent, createWorkspaceDownloadController, createWorkspaceDrawerController, createWorkspaceMemorySurfaceComponent, createWorkspacePanelComponent, createWorkspacePreviewRenderer, inject, installWorkspacePanelStyles, normalizeWorkspaceArtifacts, renderWorkspacePreview, sanitizeWorkspaceMarkdown, workspaceArtifactPreviewDescriptor, workspaceArtifactResourceUrl, workspaceClient, workspaceConversationDefinition, workspaceConversationView, workspaceConversationViewRegistration, workspaceMemoryRecordSummary, workspaceMemoryRequest, workspaceMemoryTypes });
    return module.exports;
  }
});
