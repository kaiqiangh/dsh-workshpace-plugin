window.__ModuleLoader__.load({
  id: "dsh-workspace-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
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
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/react/cjs/react.development.js
/**
* @license React
* react.development.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function() {
		"use strict";
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(/* @__PURE__ */ new Error());
		var ReactVersion = "18.3.1";
		var REACT_ELEMENT_TYPE = Symbol.for("react.element");
		var REACT_PORTAL_TYPE = Symbol.for("react.portal");
		var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
		var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
		var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
		var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
		var REACT_CONTEXT_TYPE = Symbol.for("react.context");
		var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
		var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
		var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
		var REACT_MEMO_TYPE = Symbol.for("react.memo");
		var REACT_LAZY_TYPE = Symbol.for("react.lazy");
		var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
		var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
		var FAUX_ITERATOR_SYMBOL = "@@iterator";
		function getIteratorFn(maybeIterable) {
			if (maybeIterable === null || typeof maybeIterable !== "object") return null;
			var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
			if (typeof maybeIterator === "function") return maybeIterator;
			return null;
		}
		/**
		* Keeps track of the current dispatcher.
		*/
		var ReactCurrentDispatcher = {
		/**
		* @internal
		* @type {ReactComponent}
		*/
current: null };
		/**
		* Keeps track of the current batch's configuration such as how long an update
		* should suspend for if it needs to.
		*/
		var ReactCurrentBatchConfig = { transition: null };
		var ReactCurrentActQueue = {
			current: null,
			isBatchingLegacy: false,
			didScheduleLegacyUpdate: false
		};
		/**
		* Keeps track of the current owner.
		*
		* The current owner is the component who should own any components that are
		* currently being constructed.
		*/
		var ReactCurrentOwner = {
		/**
		* @internal
		* @type {ReactComponent}
		*/
current: null };
		var ReactDebugCurrentFrame = {};
		var currentExtraStackFrame = null;
		function setExtraStackFrame(stack) {
			currentExtraStackFrame = stack;
		}
		ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
			currentExtraStackFrame = stack;
		};
		ReactDebugCurrentFrame.getCurrentStack = null;
		ReactDebugCurrentFrame.getStackAddendum = function() {
			var stack = "";
			if (currentExtraStackFrame) stack += currentExtraStackFrame;
			var impl = ReactDebugCurrentFrame.getCurrentStack;
			if (impl) stack += impl() || "";
			return stack;
		};
		var enableScopeAPI = false;
		var enableCacheElement = false;
		var enableTransitionTracing = false;
		var enableLegacyHidden = false;
		var enableDebugTracing = false;
		var ReactSharedInternals = {
			ReactCurrentDispatcher,
			ReactCurrentBatchConfig,
			ReactCurrentOwner
		};
		ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
		ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
		function warn(format) {
			for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) args[_key - 1] = arguments[_key];
			printWarning("warn", format, args);
		}
		function error(format) {
			for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
			printWarning("error", format, args);
		}
		function printWarning(level, format, args) {
			var stack = ReactSharedInternals.ReactDebugCurrentFrame.getStackAddendum();
			if (stack !== "") {
				format += "%s";
				args = args.concat([stack]);
			}
			var argsWithFormat = args.map(function(item) {
				return String(item);
			});
			argsWithFormat.unshift("Warning: " + format);
			Function.prototype.apply.call(console[level], console, argsWithFormat);
		}
		var didWarnStateUpdateForUnmountedComponent = {};
		function warnNoop(publicInstance, callerName) {
			var _constructor = publicInstance.constructor;
			var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
			var warningKey = componentName + "." + callerName;
			if (didWarnStateUpdateForUnmountedComponent[warningKey]) return;
			error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
			didWarnStateUpdateForUnmountedComponent[warningKey] = true;
		}
		/**
		* This is the abstract API for an update queue.
		*/
		var ReactNoopUpdateQueue = {
			/**
			* Checks whether or not this composite component is mounted.
			* @param {ReactClass} publicInstance The instance we want to test.
			* @return {boolean} True if mounted, false otherwise.
			* @protected
			* @final
			*/
			isMounted: function(publicInstance) {
				return false;
			},
			/**
			* Forces an update. This should only be invoked when it is known with
			* certainty that we are **not** in a DOM transaction.
			*
			* You may want to call this when you know that some deeper aspect of the
			* component's state has changed but `setState` was not called.
			*
			* This will not invoke `shouldComponentUpdate`, but it will invoke
			* `componentWillUpdate` and `componentDidUpdate`.
			*
			* @param {ReactClass} publicInstance The instance that should rerender.
			* @param {?function} callback Called after component is updated.
			* @param {?string} callerName name of the calling function in the public API.
			* @internal
			*/
			enqueueForceUpdate: function(publicInstance, callback, callerName) {
				warnNoop(publicInstance, "forceUpdate");
			},
			/**
			* Replaces all of the state. Always use this or `setState` to mutate state.
			* You should treat `this.state` as immutable.
			*
			* There is no guarantee that `this.state` will be immediately updated, so
			* accessing `this.state` after calling this method may return the old value.
			*
			* @param {ReactClass} publicInstance The instance that should rerender.
			* @param {object} completeState Next state.
			* @param {?function} callback Called after component is updated.
			* @param {?string} callerName name of the calling function in the public API.
			* @internal
			*/
			enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
				warnNoop(publicInstance, "replaceState");
			},
			/**
			* Sets a subset of the state. This only exists because _pendingState is
			* internal. This provides a merging strategy that is not available to deep
			* properties which is confusing. TODO: Expose pendingState or don't use it
			* during the merge.
			*
			* @param {ReactClass} publicInstance The instance that should rerender.
			* @param {object} partialState Next partial state to be merged with state.
			* @param {?function} callback Called after component is updated.
			* @param {?string} Name of the calling function in the public API.
			* @internal
			*/
			enqueueSetState: function(publicInstance, partialState, callback, callerName) {
				warnNoop(publicInstance, "setState");
			}
		};
		var assign = Object.assign;
		var emptyObject = {};
		Object.freeze(emptyObject);
		/**
		* Base class helpers for the updating state of a component.
		*/
		function Component(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		Component.prototype.isReactComponent = {};
		/**
		* Sets a subset of the state. Always use this to mutate
		* state. You should treat `this.state` as immutable.
		*
		* There is no guarantee that `this.state` will be immediately updated, so
		* accessing `this.state` after calling this method may return the old value.
		*
		* There is no guarantee that calls to `setState` will run synchronously,
		* as they may eventually be batched together.  You can provide an optional
		* callback that will be executed when the call to setState is actually
		* completed.
		*
		* When a function is provided to setState, it will be called at some point in
		* the future (not synchronously). It will be called with the up to date
		* component arguments (state, props, context). These values can be different
		* from this.* because your function may be called after receiveProps but before
		* shouldComponentUpdate, and this new state, props, and context will not yet be
		* assigned to this.
		*
		* @param {object|function} partialState Next partial state or function to
		*        produce next partial state to be merged with current state.
		* @param {?function} callback Called after state is updated.
		* @final
		* @protected
		*/
		Component.prototype.setState = function(partialState, callback) {
			if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
			this.updater.enqueueSetState(this, partialState, callback, "setState");
		};
		/**
		* Forces an update. This should only be invoked when it is known with
		* certainty that we are **not** in a DOM transaction.
		*
		* You may want to call this when you know that some deeper aspect of the
		* component's state has changed but `setState` was not called.
		*
		* This will not invoke `shouldComponentUpdate`, but it will invoke
		* `componentWillUpdate` and `componentDidUpdate`.
		*
		* @param {?function} callback Called after update is complete.
		* @final
		* @protected
		*/
		Component.prototype.forceUpdate = function(callback) {
			this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
		};
		var deprecatedAPIs = {
			isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
			replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
		};
		var defineDeprecationWarning = function(methodName, info) {
			Object.defineProperty(Component.prototype, methodName, { get: function() {
				warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
			} });
		};
		for (var fnName in deprecatedAPIs) if (deprecatedAPIs.hasOwnProperty(fnName)) defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		function ComponentDummy() {}
		ComponentDummy.prototype = Component.prototype;
		/**
		* Convenience component with default shallow equality check for sCU.
		*/
		function PureComponent(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
		pureComponentPrototype.constructor = PureComponent;
		assign(pureComponentPrototype, Component.prototype);
		pureComponentPrototype.isPureReactComponent = true;
		function createRef() {
			var refObject = { current: null };
			Object.seal(refObject);
			return refObject;
		}
		var isArrayImpl = Array.isArray;
		function isArray(a) {
			return isArrayImpl(a);
		}
		function typeName(value) {
			return typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
		}
		function willCoercionThrow(value) {
			try {
				testStringCoercion(value);
				return false;
			} catch (e) {
				return true;
			}
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			if (willCoercionThrow(value)) {
				error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
				return testStringCoercion(value);
			}
		}
		function getWrappedName(outerType, innerType, wrapperName) {
			var displayName = outerType.displayName;
			if (displayName) return displayName;
			var functionName = innerType.displayName || innerType.name || "";
			return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
		}
		function getContextName(type) {
			return type.displayName || "Context";
		}
		function getComponentNameFromType(type) {
			if (type == null) return null;
			if (typeof type.tag === "number") error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
			if (typeof type === "function") return type.displayName || type.name || null;
			if (typeof type === "string") return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
			}
			if (typeof type === "object") switch (type.$$typeof) {
				case REACT_CONTEXT_TYPE: return getContextName(type) + ".Consumer";
				case REACT_PROVIDER_TYPE: return getContextName(type._context) + ".Provider";
				case REACT_FORWARD_REF_TYPE: return getWrappedName(type, type.render, "ForwardRef");
				case REACT_MEMO_TYPE:
					var outerName = type.displayName || null;
					if (outerName !== null) return outerName;
					return getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					var lazyComponent = type;
					var payload = lazyComponent._payload;
					var init = lazyComponent._init;
					try {
						return getComponentNameFromType(init(payload));
					} catch (x) {
						return null;
					}
			}
			return null;
		}
		var hasOwnProperty = Object.prototype.hasOwnProperty;
		var RESERVED_PROPS = {
			key: true,
			ref: true,
			__self: true,
			__source: true
		};
		var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs = {};
		function hasValidRef(config) {
			if (hasOwnProperty.call(config, "ref")) {
				var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
				if (getter && getter.isReactWarning) return false;
			}
			return config.ref !== void 0;
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return false;
			}
			return config.key !== void 0;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			var warnAboutAccessingKey = function() {
				if (!specialPropKeyWarningShown) {
					specialPropKeyWarningShown = true;
					error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
				}
			};
			warnAboutAccessingKey.isReactWarning = true;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: true
			});
		}
		function defineRefPropWarningGetter(props, displayName) {
			var warnAboutAccessingRef = function() {
				if (!specialPropRefWarningShown) {
					specialPropRefWarningShown = true;
					error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
				}
			};
			warnAboutAccessingRef.isReactWarning = true;
			Object.defineProperty(props, "ref", {
				get: warnAboutAccessingRef,
				configurable: true
			});
		}
		function warnIfStringRefCannotBeAutoConverted(config) {
			if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
				var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
				if (!didWarnAboutStringRefs[componentName]) {
					error("Component \"%s\" contains the string ref \"%s\". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref", componentName, config.ref);
					didWarnAboutStringRefs[componentName] = true;
				}
			}
		}
		/**
		* Factory method to create a new React element. This no longer adheres to
		* the class pattern, so do not use new to call it. Also, instanceof check
		* will not work. Instead test $$typeof field against Symbol.for('react.element') to check
		* if something is a React Element.
		*
		* @param {*} type
		* @param {*} props
		* @param {*} key
		* @param {string|object} ref
		* @param {*} owner
		* @param {*} self A *temporary* helper to detect places where `this` is
		* different from the `owner` when React.createElement is called, so that we
		* can warn. We want to get rid of owner and replace string `ref`s with arrow
		* functions, and as long as `this` and owner are the same, there will be no
		* change in behavior.
		* @param {*} source An annotation object (added by a transpiler or otherwise)
		* indicating filename, line number, and/or other information.
		* @internal
		*/
		var ReactElement = function(type, key, ref, self, source, owner, props) {
			var element = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				ref,
				props,
				_owner: owner
			};
			element._store = {};
			Object.defineProperty(element._store, "validated", {
				configurable: false,
				enumerable: false,
				writable: true,
				value: false
			});
			Object.defineProperty(element, "_self", {
				configurable: false,
				enumerable: false,
				writable: false,
				value: self
			});
			Object.defineProperty(element, "_source", {
				configurable: false,
				enumerable: false,
				writable: false,
				value: source
			});
			if (Object.freeze) {
				Object.freeze(element.props);
				Object.freeze(element);
			}
			return element;
		};
		/**
		* Create and return a new ReactElement of the given type.
		* See https://reactjs.org/docs/react-api.html#createelement
		*/
		function createElement(type, config, children) {
			var propName;
			var props = {};
			var key = null;
			var ref = null;
			var self = null;
			var source = null;
			if (config != null) {
				if (hasValidRef(config)) {
					ref = config.ref;
					warnIfStringRefCannotBeAutoConverted(config);
				}
				if (hasValidKey(config)) {
					checkKeyStringCoercion(config.key);
					key = "" + config.key;
				}
				self = config.__self === void 0 ? null : config.__self;
				source = config.__source === void 0 ? null : config.__source;
				for (propName in config) if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) props[propName] = config[propName];
			}
			var childrenLength = arguments.length - 2;
			if (childrenLength === 1) props.children = children;
			else if (childrenLength > 1) {
				var childArray = Array(childrenLength);
				for (var i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
				if (Object.freeze) Object.freeze(childArray);
				props.children = childArray;
			}
			if (type && type.defaultProps) {
				var defaultProps = type.defaultProps;
				for (propName in defaultProps) if (props[propName] === void 0) props[propName] = defaultProps[propName];
			}
			if (key || ref) {
				var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
				if (key) defineKeyPropWarningGetter(props, displayName);
				if (ref) defineRefPropWarningGetter(props, displayName);
			}
			return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
		}
		function cloneAndReplaceKey(oldElement, newKey) {
			return ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
		}
		/**
		* Clone and return a new ReactElement using element as the starting point.
		* See https://reactjs.org/docs/react-api.html#cloneelement
		*/
		function cloneElement(element, config, children) {
			if (element === null || element === void 0) throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
			var propName;
			var props = assign({}, element.props);
			var key = element.key;
			var ref = element.ref;
			var self = element._self;
			var source = element._source;
			var owner = element._owner;
			if (config != null) {
				if (hasValidRef(config)) {
					ref = config.ref;
					owner = ReactCurrentOwner.current;
				}
				if (hasValidKey(config)) {
					checkKeyStringCoercion(config.key);
					key = "" + config.key;
				}
				var defaultProps;
				if (element.type && element.type.defaultProps) defaultProps = element.type.defaultProps;
				for (propName in config) if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
					if (config[propName] === void 0 && defaultProps !== void 0) props[propName] = defaultProps[propName];
					else props[propName] = config[propName];
				}
			}
			var childrenLength = arguments.length - 2;
			if (childrenLength === 1) props.children = children;
			else if (childrenLength > 1) {
				var childArray = Array(childrenLength);
				for (var i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
				props.children = childArray;
			}
			return ReactElement(element.type, key, ref, self, source, owner, props);
		}
		/**
		* Verifies the object is a ReactElement.
		* See https://reactjs.org/docs/react-api.html#isvalidelement
		* @param {?object} object
		* @return {boolean} True if `object` is a ReactElement.
		* @final
		*/
		function isValidElement(object) {
			return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var SEPARATOR = ".";
		var SUBSEPARATOR = ":";
		/**
		* Escape and wrap key so it is safe to use as a reactid
		*
		* @param {string} key to be escaped.
		* @return {string} the escaped key.
		*/
		function escape(key) {
			var escapeRegex = /[=:]/g;
			var escaperLookup = {
				"=": "=0",
				":": "=2"
			};
			return "$" + key.replace(escapeRegex, function(match) {
				return escaperLookup[match];
			});
		}
		/**
		* TODO: Test that a single child and an array with one item have the same key
		* pattern.
		*/
		var didWarnAboutMaps = false;
		var userProvidedKeyEscapeRegex = /\/+/g;
		function escapeUserProvidedKey(text) {
			return text.replace(userProvidedKeyEscapeRegex, "$&/");
		}
		/**
		* Generate a key string that identifies a element within a set.
		*
		* @param {*} element A element that could contain a manual key.
		* @param {number} index Index that is used if a manual key is not provided.
		* @return {string}
		*/
		function getElementKey(element, index) {
			if (typeof element === "object" && element !== null && element.key != null) {
				checkKeyStringCoercion(element.key);
				return escape("" + element.key);
			}
			return index.toString(36);
		}
		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
			var type = typeof children;
			if (type === "undefined" || type === "boolean") children = null;
			var invokeCallback = false;
			if (children === null) invokeCallback = true;
			else switch (type) {
				case "string":
				case "number":
					invokeCallback = true;
					break;
				case "object": switch (children.$$typeof) {
					case REACT_ELEMENT_TYPE:
					case REACT_PORTAL_TYPE: invokeCallback = true;
				}
			}
			if (invokeCallback) {
				var _child = children;
				var mappedChild = callback(_child);
				var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
				if (isArray(mappedChild)) {
					var escapedChildKey = "";
					if (childKey != null) escapedChildKey = escapeUserProvidedKey(childKey) + "/";
					mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
						return c;
					});
				} else if (mappedChild != null) {
					if (isValidElement(mappedChild)) {
						if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) checkKeyStringCoercion(mappedChild.key);
						mappedChild = cloneAndReplaceKey(mappedChild, escapedPrefix + (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? escapeUserProvidedKey("" + mappedChild.key) + "/" : "") + childKey);
					}
					array.push(mappedChild);
				}
				return 1;
			}
			var child;
			var nextName;
			var subtreeCount = 0;
			var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
			if (isArray(children)) for (var i = 0; i < children.length; i++) {
				child = children[i];
				nextName = nextNamePrefix + getElementKey(child, i);
				subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
			}
			else {
				var iteratorFn = getIteratorFn(children);
				if (typeof iteratorFn === "function") {
					var iterableChildren = children;
					if (iteratorFn === iterableChildren.entries) {
						if (!didWarnAboutMaps) warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
						didWarnAboutMaps = true;
					}
					var iterator = iteratorFn.call(iterableChildren);
					var step;
					var ii = 0;
					while (!(step = iterator.next()).done) {
						child = step.value;
						nextName = nextNamePrefix + getElementKey(child, ii++);
						subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
					}
				} else if (type === "object") {
					var childrenString = String(children);
					throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
				}
			}
			return subtreeCount;
		}
		/**
		* Maps children that are typically specified as `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenmap
		*
		* The provided mapFunction(child, index) will be called for each
		* leaf child.
		*
		* @param {?*} children Children tree container.
		* @param {function(*, int)} func The map function.
		* @param {*} context Context for mapFunction.
		* @return {object} Object containing the ordered map of results.
		*/
		function mapChildren(children, func, context) {
			if (children == null) return children;
			var result = [];
			var count = 0;
			mapIntoArray(children, result, "", "", function(child) {
				return func.call(context, child, count++);
			});
			return result;
		}
		/**
		* Count the number of children that are typically specified as
		* `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrencount
		*
		* @param {?*} children Children tree container.
		* @return {number} The number of children.
		*/
		function countChildren(children) {
			var n = 0;
			mapChildren(children, function() {
				n++;
			});
			return n;
		}
		/**
		* Iterates through children that are typically specified as `props.children`.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenforeach
		*
		* The provided forEachFunc(child, index) will be called for each
		* leaf child.
		*
		* @param {?*} children Children tree container.
		* @param {function(*, int)} forEachFunc
		* @param {*} forEachContext Context for forEachContext.
		*/
		function forEachChildren(children, forEachFunc, forEachContext) {
			mapChildren(children, function() {
				forEachFunc.apply(this, arguments);
			}, forEachContext);
		}
		/**
		* Flatten a children object (typically specified as `props.children`) and
		* return an array with appropriately re-keyed children.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrentoarray
		*/
		function toArray(children) {
			return mapChildren(children, function(child) {
				return child;
			}) || [];
		}
		/**
		* Returns the first child in a collection of children and verifies that there
		* is only one child in the collection.
		*
		* See https://reactjs.org/docs/react-api.html#reactchildrenonly
		*
		* The current implementation of this function assumes that a single child gets
		* passed without a wrapper, but the purpose of this helper function is to
		* abstract away the particular structure of children.
		*
		* @param {?object} children Child collection structure.
		* @return {ReactElement} The first and only `ReactElement` contained in the
		* structure.
		*/
		function onlyChild(children) {
			if (!isValidElement(children)) throw new Error("React.Children.only expected to receive a single React element child.");
			return children;
		}
		function createContext(defaultValue) {
			var context = {
				$$typeof: REACT_CONTEXT_TYPE,
				_currentValue: defaultValue,
				_currentValue2: defaultValue,
				_threadCount: 0,
				Provider: null,
				Consumer: null,
				_defaultValue: null,
				_globalName: null
			};
			context.Provider = {
				$$typeof: REACT_PROVIDER_TYPE,
				_context: context
			};
			var hasWarnedAboutUsingNestedContextConsumers = false;
			var hasWarnedAboutUsingConsumerProvider = false;
			var hasWarnedAboutDisplayNameOnConsumer = false;
			var Consumer = {
				$$typeof: REACT_CONTEXT_TYPE,
				_context: context
			};
			Object.defineProperties(Consumer, {
				Provider: {
					get: function() {
						if (!hasWarnedAboutUsingConsumerProvider) {
							hasWarnedAboutUsingConsumerProvider = true;
							error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
						}
						return context.Provider;
					},
					set: function(_Provider) {
						context.Provider = _Provider;
					}
				},
				_currentValue: {
					get: function() {
						return context._currentValue;
					},
					set: function(_currentValue) {
						context._currentValue = _currentValue;
					}
				},
				_currentValue2: {
					get: function() {
						return context._currentValue2;
					},
					set: function(_currentValue2) {
						context._currentValue2 = _currentValue2;
					}
				},
				_threadCount: {
					get: function() {
						return context._threadCount;
					},
					set: function(_threadCount) {
						context._threadCount = _threadCount;
					}
				},
				Consumer: { get: function() {
					if (!hasWarnedAboutUsingNestedContextConsumers) {
						hasWarnedAboutUsingNestedContextConsumers = true;
						error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
					}
					return context.Consumer;
				} },
				displayName: {
					get: function() {
						return context.displayName;
					},
					set: function(displayName) {
						if (!hasWarnedAboutDisplayNameOnConsumer) {
							warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
							hasWarnedAboutDisplayNameOnConsumer = true;
						}
					}
				}
			});
			context.Consumer = Consumer;
			context._currentRenderer = null;
			context._currentRenderer2 = null;
			return context;
		}
		var Uninitialized = -1;
		var Pending = 0;
		var Resolved = 1;
		var Rejected = 2;
		function lazyInitializer(payload) {
			if (payload._status === Uninitialized) {
				var ctor = payload._result;
				var thenable = ctor();
				thenable.then(function(moduleObject) {
					if (payload._status === Pending || payload._status === Uninitialized) {
						var resolved = payload;
						resolved._status = Resolved;
						resolved._result = moduleObject;
					}
				}, function(error) {
					if (payload._status === Pending || payload._status === Uninitialized) {
						var rejected = payload;
						rejected._status = Rejected;
						rejected._result = error;
					}
				});
				if (payload._status === Uninitialized) {
					var pending = payload;
					pending._status = Pending;
					pending._result = thenable;
				}
			}
			if (payload._status === Resolved) {
				var moduleObject = payload._result;
				if (moduleObject === void 0) error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
				if (!("default" in moduleObject)) error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
				return moduleObject.default;
			} else throw payload._result;
		}
		function lazy(ctor) {
			var lazyType = {
				$$typeof: REACT_LAZY_TYPE,
				_payload: {
					_status: Uninitialized,
					_result: ctor
				},
				_init: lazyInitializer
			};
			var defaultProps;
			var propTypes;
			Object.defineProperties(lazyType, {
				defaultProps: {
					configurable: true,
					get: function() {
						return defaultProps;
					},
					set: function(newDefaultProps) {
						error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
						defaultProps = newDefaultProps;
						Object.defineProperty(lazyType, "defaultProps", { enumerable: true });
					}
				},
				propTypes: {
					configurable: true,
					get: function() {
						return propTypes;
					},
					set: function(newPropTypes) {
						error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
						propTypes = newPropTypes;
						Object.defineProperty(lazyType, "propTypes", { enumerable: true });
					}
				}
			});
			return lazyType;
		}
		function forwardRef(render) {
			if (render != null && render.$$typeof === REACT_MEMO_TYPE) error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
			else if (typeof render !== "function") error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
			else if (render.length !== 0 && render.length !== 2) error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
			if (render != null) {
				if (render.defaultProps != null || render.propTypes != null) error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
			}
			var elementType = {
				$$typeof: REACT_FORWARD_REF_TYPE,
				render
			};
			var ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: false,
				configurable: true,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					if (!render.name && !render.displayName) render.displayName = name;
				}
			});
			return elementType;
		}
		var REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
		function isValidElementType(type) {
			if (typeof type === "string" || typeof type === "function") return true;
			if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) return true;
			if (typeof type === "object" && type !== null) {
				if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) return true;
			}
			return false;
		}
		function memo(type, compare) {
			if (!isValidElementType(type)) error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
			var elementType = {
				$$typeof: REACT_MEMO_TYPE,
				type,
				compare: compare === void 0 ? null : compare
			};
			var ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: false,
				configurable: true,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					if (!type.name && !type.displayName) type.displayName = name;
				}
			});
			return elementType;
		}
		function resolveDispatcher() {
			var dispatcher = ReactCurrentDispatcher.current;
			if (dispatcher === null) error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		function useContext(Context) {
			var dispatcher = resolveDispatcher();
			if (Context._context !== void 0) {
				var realContext = Context._context;
				if (realContext.Consumer === Context) error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
				else if (realContext.Provider === Context) error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
			}
			return dispatcher.useContext(Context);
		}
		function useState(initialState) {
			return resolveDispatcher().useState(initialState);
		}
		function useReducer(reducer, initialArg, init) {
			return resolveDispatcher().useReducer(reducer, initialArg, init);
		}
		function useRef(initialValue) {
			return resolveDispatcher().useRef(initialValue);
		}
		function useEffect(create, deps) {
			return resolveDispatcher().useEffect(create, deps);
		}
		function useInsertionEffect(create, deps) {
			return resolveDispatcher().useInsertionEffect(create, deps);
		}
		function useLayoutEffect(create, deps) {
			return resolveDispatcher().useLayoutEffect(create, deps);
		}
		function useCallback(callback, deps) {
			return resolveDispatcher().useCallback(callback, deps);
		}
		function useMemo(create, deps) {
			return resolveDispatcher().useMemo(create, deps);
		}
		function useImperativeHandle(ref, create, deps) {
			return resolveDispatcher().useImperativeHandle(ref, create, deps);
		}
		function useDebugValue(value, formatterFn) {
			return resolveDispatcher().useDebugValue(value, formatterFn);
		}
		function useTransition() {
			return resolveDispatcher().useTransition();
		}
		function useDeferredValue(value) {
			return resolveDispatcher().useDeferredValue(value);
		}
		function useId() {
			return resolveDispatcher().useId();
		}
		function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
			return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		}
		var disabledDepth = 0;
		var prevLog;
		var prevInfo;
		var prevWarn;
		var prevError;
		var prevGroup;
		var prevGroupCollapsed;
		var prevGroupEnd;
		function disabledLog() {}
		disabledLog.__reactDisabledLog = true;
		function disableLogs() {
			if (disabledDepth === 0) {
				prevLog = console.log;
				prevInfo = console.info;
				prevWarn = console.warn;
				prevError = console.error;
				prevGroup = console.group;
				prevGroupCollapsed = console.groupCollapsed;
				prevGroupEnd = console.groupEnd;
				var props = {
					configurable: true,
					enumerable: true,
					value: disabledLog,
					writable: true
				};
				Object.defineProperties(console, {
					info: props,
					log: props,
					warn: props,
					error: props,
					group: props,
					groupCollapsed: props,
					groupEnd: props
				});
			}
			disabledDepth++;
		}
		function reenableLogs() {
			disabledDepth--;
			if (disabledDepth === 0) {
				var props = {
					configurable: true,
					enumerable: true,
					writable: true
				};
				Object.defineProperties(console, {
					log: assign({}, props, { value: prevLog }),
					info: assign({}, props, { value: prevInfo }),
					warn: assign({}, props, { value: prevWarn }),
					error: assign({}, props, { value: prevError }),
					group: assign({}, props, { value: prevGroup }),
					groupCollapsed: assign({}, props, { value: prevGroupCollapsed }),
					groupEnd: assign({}, props, { value: prevGroupEnd })
				});
			}
			if (disabledDepth < 0) error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
		}
		var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
		var prefix;
		function describeBuiltInComponentFrame(name, source, ownerFn) {
			if (prefix === void 0) try {
				throw Error();
			} catch (x) {
				var match = x.stack.trim().match(/\n( *(at )?)/);
				prefix = match && match[1] || "";
			}
			return "\n" + prefix + name;
		}
		var reentry = false;
		var componentFrameCache = new (typeof WeakMap === "function" ? WeakMap : Map)();
		function describeNativeComponentFrame(fn, construct) {
			if (!fn || reentry) return "";
			var frame = componentFrameCache.get(fn);
			if (frame !== void 0) return frame;
			var control;
			reentry = true;
			var previousPrepareStackTrace = Error.prepareStackTrace;
			Error.prepareStackTrace = void 0;
			var previousDispatcher = ReactCurrentDispatcher$1.current;
			ReactCurrentDispatcher$1.current = null;
			disableLogs();
			try {
				if (construct) {
					var Fake = function() {
						throw Error();
					};
					Object.defineProperty(Fake.prototype, "props", { set: function() {
						throw Error();
					} });
					if (typeof Reflect === "object" && Reflect.construct) {
						try {
							Reflect.construct(Fake, []);
						} catch (x) {
							control = x;
						}
						Reflect.construct(fn, [], Fake);
					} else {
						try {
							Fake.call();
						} catch (x) {
							control = x;
						}
						fn.call(Fake.prototype);
					}
				} else {
					try {
						throw Error();
					} catch (x) {
						control = x;
					}
					fn();
				}
			} catch (sample) {
				if (sample && control && typeof sample.stack === "string") {
					var sampleLines = sample.stack.split("\n");
					var controlLines = control.stack.split("\n");
					var s = sampleLines.length - 1;
					var c = controlLines.length - 1;
					while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) c--;
					for (; s >= 1 && c >= 0; s--, c--) if (sampleLines[s] !== controlLines[c]) {
						if (s !== 1 || c !== 1) do {
							s--;
							c--;
							if (c < 0 || sampleLines[s] !== controlLines[c]) {
								var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
								if (fn.displayName && _frame.includes("<anonymous>")) _frame = _frame.replace("<anonymous>", fn.displayName);
								if (typeof fn === "function") componentFrameCache.set(fn, _frame);
								return _frame;
							}
						} while (s >= 1 && c >= 0);
						break;
					}
				}
			} finally {
				reentry = false;
				ReactCurrentDispatcher$1.current = previousDispatcher;
				reenableLogs();
				Error.prepareStackTrace = previousPrepareStackTrace;
			}
			var name = fn ? fn.displayName || fn.name : "";
			var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
			if (typeof fn === "function") componentFrameCache.set(fn, syntheticFrame);
			return syntheticFrame;
		}
		function describeFunctionComponentFrame(fn, source, ownerFn) {
			return describeNativeComponentFrame(fn, false);
		}
		function shouldConstruct(Component) {
			var prototype = Component.prototype;
			return !!(prototype && prototype.isReactComponent);
		}
		function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
			if (type == null) return "";
			if (typeof type === "function") return describeNativeComponentFrame(type, shouldConstruct(type));
			if (typeof type === "string") return describeBuiltInComponentFrame(type);
			switch (type) {
				case REACT_SUSPENSE_TYPE: return describeBuiltInComponentFrame("Suspense");
				case REACT_SUSPENSE_LIST_TYPE: return describeBuiltInComponentFrame("SuspenseList");
			}
			if (typeof type === "object") switch (type.$$typeof) {
				case REACT_FORWARD_REF_TYPE: return describeFunctionComponentFrame(type.render);
				case REACT_MEMO_TYPE: return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
				case REACT_LAZY_TYPE:
					var lazyComponent = type;
					var payload = lazyComponent._payload;
					var init = lazyComponent._init;
					try {
						return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
					} catch (x) {}
			}
			return "";
		}
		var loggedTypeFailures = {};
		var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
		function setCurrentlyValidatingElement(element) {
			if (element) {
				var owner = element._owner;
				var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
				ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
			} else ReactDebugCurrentFrame$1.setExtraStackFrame(null);
		}
		function checkPropTypes(typeSpecs, values, location, componentName, element) {
			var has = Function.call.bind(hasOwnProperty);
			for (var typeSpecName in typeSpecs) if (has(typeSpecs, typeSpecName)) {
				var error$1 = void 0;
				try {
					if (typeof typeSpecs[typeSpecName] !== "function") {
						var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
						err.name = "Invariant Violation";
						throw err;
					}
					error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
				} catch (ex) {
					error$1 = ex;
				}
				if (error$1 && !(error$1 instanceof Error)) {
					setCurrentlyValidatingElement(element);
					error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
					setCurrentlyValidatingElement(null);
				}
				if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
					loggedTypeFailures[error$1.message] = true;
					setCurrentlyValidatingElement(element);
					error("Failed %s type: %s", location, error$1.message);
					setCurrentlyValidatingElement(null);
				}
			}
		}
		function setCurrentlyValidatingElement$1(element) {
			if (element) {
				var owner = element._owner;
				setExtraStackFrame(describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null));
			} else setExtraStackFrame(null);
		}
		var propTypesMisspellWarningShown = false;
		function getDeclarationErrorAddendum() {
			if (ReactCurrentOwner.current) {
				var name = getComponentNameFromType(ReactCurrentOwner.current.type);
				if (name) return "\n\nCheck the render method of `" + name + "`.";
			}
			return "";
		}
		function getSourceInfoErrorAddendum(source) {
			if (source !== void 0) {
				var fileName = source.fileName.replace(/^.*[\\\/]/, "");
				var lineNumber = source.lineNumber;
				return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
			}
			return "";
		}
		function getSourceInfoErrorAddendumForProps(elementProps) {
			if (elementProps !== null && elementProps !== void 0) return getSourceInfoErrorAddendum(elementProps.__source);
			return "";
		}
		/**
		* Warn if there's no key explicitly set on dynamic arrays of children or
		* object keys are not valid. This allows us to keep track of children between
		* updates.
		*/
		var ownerHasKeyUseWarning = {};
		function getCurrentComponentErrorInfo(parentType) {
			var info = getDeclarationErrorAddendum();
			if (!info) {
				var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
				if (parentName) info = "\n\nCheck the top-level render call using <" + parentName + ">.";
			}
			return info;
		}
		/**
		* Warn if the element doesn't have an explicit key assigned to it.
		* This element is in an array. The array could grow and shrink or be
		* reordered. All children that haven't already been validated are required to
		* have a "key" property assigned to it. Error statuses are cached so a warning
		* will only be shown once.
		*
		* @internal
		* @param {ReactElement} element Element that requires a key.
		* @param {*} parentType element's parent's type.
		*/
		function validateExplicitKey(element, parentType) {
			if (!element._store || element._store.validated || element.key != null) return;
			element._store.validated = true;
			var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
			if (ownerHasKeyUseWarning[currentComponentErrorInfo]) return;
			ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
			var childOwner = "";
			if (element && element._owner && element._owner !== ReactCurrentOwner.current) childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
			setCurrentlyValidatingElement$1(element);
			error("Each child in a list should have a unique \"key\" prop.%s%s See https://reactjs.org/link/warning-keys for more information.", currentComponentErrorInfo, childOwner);
			setCurrentlyValidatingElement$1(null);
		}
		/**
		* Ensure that every element either is passed in a static location, in an
		* array with an explicit keys property defined, or in an object literal
		* with valid key property.
		*
		* @internal
		* @param {ReactNode} node Statically passed child of any type.
		* @param {*} parentType node's parent's type.
		*/
		function validateChildKeys(node, parentType) {
			if (typeof node !== "object") return;
			if (isArray(node)) for (var i = 0; i < node.length; i++) {
				var child = node[i];
				if (isValidElement(child)) validateExplicitKey(child, parentType);
			}
			else if (isValidElement(node)) {
				if (node._store) node._store.validated = true;
			} else if (node) {
				var iteratorFn = getIteratorFn(node);
				if (typeof iteratorFn === "function") {
					if (iteratorFn !== node.entries) {
						var iterator = iteratorFn.call(node);
						var step;
						while (!(step = iterator.next()).done) if (isValidElement(step.value)) validateExplicitKey(step.value, parentType);
					}
				}
			}
		}
		/**
		* Given an element, validate that its props follow the propTypes definition,
		* provided by the type.
		*
		* @param {ReactElement} element
		*/
		function validatePropTypes(element) {
			var type = element.type;
			if (type === null || type === void 0 || typeof type === "string") return;
			var propTypes;
			if (typeof type === "function") propTypes = type.propTypes;
			else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MEMO_TYPE)) propTypes = type.propTypes;
			else return;
			if (propTypes) {
				var name = getComponentNameFromType(type);
				checkPropTypes(propTypes, element.props, "prop", name, element);
			} else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
				propTypesMisspellWarningShown = true;
				error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", getComponentNameFromType(type) || "Unknown");
			}
			if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
		}
		/**
		* Given a fragment, validate that it can only be provided with fragment props
		* @param {ReactElement} fragment
		*/
		function validateFragmentProps(fragment) {
			var keys = Object.keys(fragment.props);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				if (key !== "children" && key !== "key") {
					setCurrentlyValidatingElement$1(fragment);
					error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
					setCurrentlyValidatingElement$1(null);
					break;
				}
			}
			if (fragment.ref !== null) {
				setCurrentlyValidatingElement$1(fragment);
				error("Invalid attribute `ref` supplied to `React.Fragment`.");
				setCurrentlyValidatingElement$1(null);
			}
		}
		function createElementWithValidation(type, props, children) {
			var validType = isValidElementType(type);
			if (!validType) {
				var info = "";
				if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
				var sourceInfo = getSourceInfoErrorAddendumForProps(props);
				if (sourceInfo) info += sourceInfo;
				else info += getDeclarationErrorAddendum();
				var typeString;
				if (type === null) typeString = "null";
				else if (isArray(type)) typeString = "array";
				else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
					typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
					info = " Did you accidentally export a JSX literal instead of a component?";
				} else typeString = typeof type;
				error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
			}
			var element = createElement.apply(this, arguments);
			if (element == null) return element;
			if (validType) for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i], type);
			if (type === REACT_FRAGMENT_TYPE) validateFragmentProps(element);
			else validatePropTypes(element);
			return element;
		}
		var didWarnAboutDeprecatedCreateFactory = false;
		function createFactoryWithValidation(type) {
			var validatedFactory = createElementWithValidation.bind(null, type);
			validatedFactory.type = type;
			if (!didWarnAboutDeprecatedCreateFactory) {
				didWarnAboutDeprecatedCreateFactory = true;
				warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
			}
			Object.defineProperty(validatedFactory, "type", {
				enumerable: false,
				get: function() {
					warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
					Object.defineProperty(this, "type", { value: type });
					return type;
				}
			});
			return validatedFactory;
		}
		function cloneElementWithValidation(element, props, children) {
			var newElement = cloneElement.apply(this, arguments);
			for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i], newElement.type);
			validatePropTypes(newElement);
			return newElement;
		}
		function startTransition(scope, options) {
			var prevTransition = ReactCurrentBatchConfig.transition;
			ReactCurrentBatchConfig.transition = {};
			var currentTransition = ReactCurrentBatchConfig.transition;
			ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
			try {
				scope();
			} finally {
				ReactCurrentBatchConfig.transition = prevTransition;
				if (prevTransition === null && currentTransition._updatedFibers) {
					if (currentTransition._updatedFibers.size > 10) warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
					currentTransition._updatedFibers.clear();
				}
			}
		}
		var didWarnAboutMessageChannel = false;
		var enqueueTaskImpl = null;
		function enqueueTask(task) {
			if (enqueueTaskImpl === null) try {
				var requireString = ("require" + Math.random()).slice(0, 7);
				enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
			} catch (_err) {
				enqueueTaskImpl = function(callback) {
					if (didWarnAboutMessageChannel === false) {
						didWarnAboutMessageChannel = true;
						if (typeof MessageChannel === "undefined") error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
					}
					var channel = new MessageChannel();
					channel.port1.onmessage = callback;
					channel.port2.postMessage(void 0);
				};
			}
			return enqueueTaskImpl(task);
		}
		var actScopeDepth = 0;
		var didWarnNoAwaitAct = false;
		function act(callback) {
			var prevActScopeDepth = actScopeDepth;
			actScopeDepth++;
			if (ReactCurrentActQueue.current === null) ReactCurrentActQueue.current = [];
			var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
			var result;
			try {
				ReactCurrentActQueue.isBatchingLegacy = true;
				result = callback();
				if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
					var queue = ReactCurrentActQueue.current;
					if (queue !== null) {
						ReactCurrentActQueue.didScheduleLegacyUpdate = false;
						flushActQueue(queue);
					}
				}
			} catch (error) {
				popActScope(prevActScopeDepth);
				throw error;
			} finally {
				ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
			}
			if (result !== null && typeof result === "object" && typeof result.then === "function") {
				var thenableResult = result;
				var wasAwaited = false;
				var thenable = { then: function(resolve, reject) {
					wasAwaited = true;
					thenableResult.then(function(returnValue) {
						popActScope(prevActScopeDepth);
						if (actScopeDepth === 0) recursivelyFlushAsyncActWork(returnValue, resolve, reject);
						else resolve(returnValue);
					}, function(error) {
						popActScope(prevActScopeDepth);
						reject(error);
					});
				} };
				if (!didWarnNoAwaitAct && typeof Promise !== "undefined") Promise.resolve().then(function() {}).then(function() {
					if (!wasAwaited) {
						didWarnNoAwaitAct = true;
						error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
					}
				});
				return thenable;
			} else {
				var returnValue = result;
				popActScope(prevActScopeDepth);
				if (actScopeDepth === 0) {
					var _queue = ReactCurrentActQueue.current;
					if (_queue !== null) {
						flushActQueue(_queue);
						ReactCurrentActQueue.current = null;
					}
					return { then: function(resolve, reject) {
						if (ReactCurrentActQueue.current === null) {
							ReactCurrentActQueue.current = [];
							recursivelyFlushAsyncActWork(returnValue, resolve, reject);
						} else resolve(returnValue);
					} };
				} else return { then: function(resolve, reject) {
					resolve(returnValue);
				} };
			}
		}
		function popActScope(prevActScopeDepth) {
			if (prevActScopeDepth !== actScopeDepth - 1) error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
			actScopeDepth = prevActScopeDepth;
		}
		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
			var queue = ReactCurrentActQueue.current;
			if (queue !== null) try {
				flushActQueue(queue);
				enqueueTask(function() {
					if (queue.length === 0) {
						ReactCurrentActQueue.current = null;
						resolve(returnValue);
					} else recursivelyFlushAsyncActWork(returnValue, resolve, reject);
				});
			} catch (error) {
				reject(error);
			}
			else resolve(returnValue);
		}
		var isFlushing = false;
		function flushActQueue(queue) {
			if (!isFlushing) {
				isFlushing = true;
				var i = 0;
				try {
					for (; i < queue.length; i++) {
						var callback = queue[i];
						do
							callback = callback(true);
						while (callback !== null);
					}
					queue.length = 0;
				} catch (error) {
					queue = queue.slice(i + 1);
					throw error;
				} finally {
					isFlushing = false;
				}
			}
		}
		var createElement$1 = createElementWithValidation;
		var cloneElement$1 = cloneElementWithValidation;
		var createFactory = createFactoryWithValidation;
		exports.Children = {
			map: mapChildren,
			forEach: forEachChildren,
			count: countChildren,
			toArray,
			only: onlyChild
		};
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
		exports.act = act;
		exports.cloneElement = cloneElement$1;
		exports.createContext = createContext;
		exports.createElement = createElement$1;
		exports.createFactory = createFactory;
		exports.createRef = createRef;
		exports.forwardRef = forwardRef;
		exports.isValidElement = isValidElement;
		exports.lazy = lazy;
		exports.memo = memo;
		exports.startTransition = startTransition;
		exports.unstable_act = act;
		exports.useCallback = useCallback;
		exports.useContext = useContext;
		exports.useDebugValue = useDebugValue;
		exports.useDeferredValue = useDeferredValue;
		exports.useEffect = useEffect;
		exports.useId = useId;
		exports.useImperativeHandle = useImperativeHandle;
		exports.useInsertionEffect = useInsertionEffect;
		exports.useLayoutEffect = useLayoutEffect;
		exports.useMemo = useMemo;
		exports.useReducer = useReducer;
		exports.useRef = useRef;
		exports.useState = useState;
		exports.useSyncExternalStore = useSyncExternalStore;
		exports.useTransition = useTransition;
		exports.version = ReactVersion;
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(/* @__PURE__ */ new Error());
	})();
}));
//#endregion
//#region ../../../../../../../Users/kai/Desktop/my-repo/dsh-workshpace-plugin/node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_development();
}));
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
var import_react = require_react();
const dsh_workspace_plugin_workspace_contextSnapshot_context$schema = intersection(string(), unknown());
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
const dsh_workspace_plugin_workspace_focus_context$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_focus_result$schema = object({ "focused": boolean().readonly() });
const dsh_workspace_plugin_workspace_replaceContext_context$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_replaceContext_parameter_0$schema = object({
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
			id: "dsh-workspace-plugin#workspace/contextSnapshot",
			service: "workspace",
			namespace: "workspace",
			method: "contextSnapshot",
			invocation: {
				kind: "context",
				context: "agent",
				wire: "agentId",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_contextSnapshot_context$schema
				}
			},
			parameters: [],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
				schema: dsh_workspace_plugin_workspace_contextSnapshot_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 108,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/focus",
			service: "workspace",
			namespace: "workspace",
			method: "focus",
			invocation: {
				kind: "context",
				context: "agent",
				wire: "agentId",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_focus_context$schema
				}
			},
			parameters: [],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/focus:result",
				schema: dsh_workspace_plugin_workspace_focus_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 103,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/replaceContext",
			service: "workspace",
			namespace: "workspace",
			method: "replaceContext",
			invocation: {
				kind: "context",
				context: "agent",
				wire: "agentId",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_replaceContext_context$schema
				}
			},
			parameters: [{
				name: "snapshot",
				wire: "snapshot",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
					schema: dsh_workspace_plugin_workspace_replaceContext_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#PinnedContextRemoteSnapshot",
				schema: dsh_workspace_plugin_workspace_replaceContext_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 113,
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
				"line": 98,
				"column": 3
			}
		}
	]
};
//#endregion
//#region packages/plugin/src/client.ts
const workspaceClient = Object.freeze({ ready: true });
const inject = [
	"conversationEvents",
	"slots",
	"remote"
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
			}, createWorkspaceChatNodeComponent((model) => (0, import_react.createElement)("section", { "data-dsh-workspace": "summary" }, (0, import_react.createElement)("strong", null, model.summary.workspaceName), (0, import_react.createElement)("span", null, ` ${model.summary.filesTouched} files, ${model.summary.changes} changes`), (0, import_react.createElement)("button", {
				type: "button",
				onClick: model.openWorkspace.action
			}, model.openWorkspace.label)), () => ctx.emit("workspace/open"))));
			let disposed = false;
			disposeConversation = () => {
				if (disposed) return;
				disposed = true;
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

    Object.assign(exports, { apply, applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, createWorkspaceDrawerController, inject, workspaceClient, workspaceConversationDefinition, workspaceConversationView });
    return module.exports;
  }
});
