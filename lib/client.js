window.__ModuleLoader__.load({
  id: "dsh-workspace-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const { CodeBlock, JsonTree, MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
const { createElement, useEffect, useRef, useState } = require("react");
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
	return validCount(summary.filesTouched) && validCount(summary.changes) && validCount(summary.artifacts) && validCount(summary.filesCreated) && validCount(summary.filesModified) && validCount(summary.filesDeleted) && validCount(summary.firstObservedAt) && validCount(summary.lastObservedAt) && validCount(summary.memoryCount) && validCount(summary.decisionCount) && validWorkspaceName(summary.workspaceName);
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
function createWorkspaceSummaryCard(summary) {
	if (!validSummary(summary)) throw new WorkspaceWebIntegrationError("LOCAL_OPERATION_FAILED", "Workspace summary is invalid");
	return { summary };
}
function createWorkspaceChatNodeComponent(render) {
	return ({ node }) => render(createWorkspaceSummaryCard(node.data));
}
function applyWorkspaceConversationContribution(ctx, options) {
	if (!ctx?.conversationEvents || !ctx.conversationViews || !ctx.slots || typeof ctx.effect !== "function") throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Public DSH Web conversation seam is unavailable");
	if (typeof options?.renderSummary !== "function") throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Workspace summary renderer is unavailable");
	ctx.effect(() => {
		const disposeEvent = ctx.conversationEvents.register(workspaceConversationDefinition);
		const disposeView = ctx.conversationViews.register(workspaceConversationView);
		const disposeSlot = ctx.slots.inject(WORKSPACE_CHAT_SLOT, () => ctx.slots.register({
			name: WORKSPACE_CHAT_SLOT,
			key: WORKSPACE_CONVERSATION_KIND
		}, createWorkspaceChatNodeComponent(options.renderSummary)));
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
const dsh_workspace_plugin_workspace_focus_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_focus_result$schema = object({ "focused": boolean().readonly() });
const dsh_workspace_plugin_workspace_gitDiff_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_gitDiff_parameter_1$schema = union([_undefined(), string()]);
const dsh_workspace_plugin_workspace_gitDiff_result$schema = object({
	"path": union([_undefined(), string()]).readonly().optional(),
	"staged": string().readonly(),
	"unstaged": string().readonly(),
	"truncated": boolean().readonly()
});
const dsh_workspace_plugin_workspace_gitStatus_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_gitStatus_result$schema = array(object({
	"path": string().readonly(),
	"previousPath": union([_undefined(), string()]).readonly().optional(),
	"status": union([
		literal("added"),
		literal("modified"),
		literal("deleted"),
		literal("renamed"),
		literal("copied"),
		literal("untracked"),
		literal("typechange"),
		literal("unmerged")
	]).readonly(),
	"staged": boolean().readonly()
}));
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
		}).readonly(),
		"imageUrls": union([_undefined(), record(string(), string()).readonly()]).readonly().optional()
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
const dsh_workspace_plugin_workspace_summary_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_summary_result$schema = object({
	"ready": boolean().readonly(),
	"agent": intersection(string(), unknown()).readonly()
});
const dsh_workspace_plugin_workspace_workspaceSummary_parameter_0$schema = intersection(string(), unknown());
const dsh_workspace_plugin_workspace_workspaceSummary_result$schema = union([_undefined(), object({
	"filesTouched": number().readonly(),
	"changes": number().readonly(),
	"artifacts": number().readonly(),
	"workspaceName": string().readonly(),
	"filesCreated": number().readonly(),
	"filesModified": number().readonly(),
	"filesDeleted": number().readonly(),
	"firstObservedAt": number().readonly(),
	"lastObservedAt": number().readonly(),
	"memoryCount": number().readonly(),
	"decisionCount": number().readonly()
})]);
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
				"line": 191,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/gitDiff",
			service: "workspace",
			namespace: "workspace",
			method: "gitDiff",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_gitDiff_parameter_0$schema
				}
			}, {
				name: "path",
				wire: "path",
				source: "json",
				acceptsUndefined: true,
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin#workspace/gitDiff:path",
					schema: dsh_workspace_plugin_workspace_gitDiff_parameter_1$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin/types#GitDiffResult",
				schema: dsh_workspace_plugin_workspace_gitDiff_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 267,
				"column": 9
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/gitStatus",
			service: "workspace",
			namespace: "workspace",
			method: "gitStatus",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_gitStatus_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/gitStatus:result",
				schema: dsh_workspace_plugin_workspace_gitStatus_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 262,
				"column": 9
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
				"line": 166,
				"column": 3
			}
		},
		{
			id: "dsh-workspace-plugin#workspace/workspaceSummary",
			service: "workspace",
			namespace: "workspace",
			method: "workspaceSummary",
			invocation: { kind: "direct" },
			parameters: [{
				name: "agentId",
				wire: "agentId",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-workspace-plugin/types#AgentId",
					schema: dsh_workspace_plugin_workspace_workspaceSummary_parameter_0$schema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-workspace-plugin#workspace/workspaceSummary:result",
				schema: dsh_workspace_plugin_workspace_workspaceSummary_result$schema
			},
			sourceLocation: {
				"file": "packages/plugin/src/index.ts",
				"line": 177,
				"column": 9
			}
		}
	]
};
//#endregion
//#region packages/plugin/src/web/workspace-markdown.ts
/**
* Compact zero-dependency markdown renderer for Workspace previews.
*
* Why not `MarkdownText` from @deepseek-ai/dsh-client-ui-primitives? That
* primitive only renders images with an absolute http(s) src and drops every
* relative/root-relative image — but Workspace previews need to show images
* that live next to the markdown file, served through the same-origin opaque
* resource route. So the Workspace surface renders markdown itself (GFM
* subset: headings, paragraphs, fenced + inline code, bold/italic/strike,
* links, images, lists, blockquotes, hr, tables) with a `resolveImageSrc`
* hook that rewrites relative srcs to opaque resource URLs.
*
* All HTML is escaped before transformation — the output only ever contains
* the renderer's own tags (ADR 0011 keeps the surface zero-dependency and
* privacy-bounded). Pure and exported for tests.
*/
/** Escape HTML special characters. */
function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** Directory of a workspace-relative file path ("" when at the root). */
function dirOf(filePath) {
	const slash = filePath.lastIndexOf("/");
	return slash === -1 ? "" : filePath.slice(0, slash);
}
/** Collapse . and .. segments; null when .. escapes the base. */
function normalizeRelPath(rel) {
	const out = [];
	for (const part of rel.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (out.length === 0) return null;
			out.pop();
			continue;
		}
		out.push(part);
	}
	return out.join("/");
}
/** Percent-decode a path portion (best effort; never throws). */
function decodePathPart(raw) {
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}
/**
* Resolve one markdown image src against the markdown file's location:
* - Absolute URLs (http/https/data:/...) and fragment-only srcs are left to
*   the browser ('absolute').
* - Root-relative srcs (/img.png) resolve from the project root; other
*   relative srcs resolve against the file's directory. `..` escaping the
*   project root is rejected ('escape').
* - The path portion is percent-decoded and any ?query#fragment suffix is
*   preserved verbatim, so cache-busting srcs like ./img.png?v=2 still work.
*/
function resolveWorkspaceMarkdownImage(filePath, src) {
	const trimmed = src.trim();
	if (trimmed === "" || trimmed.startsWith("#")) return { kind: "absolute" };
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return { kind: "absolute" };
	const q = trimmed.indexOf("?");
	const h = trimmed.indexOf("#");
	let cut = trimmed.length;
	if (q !== -1) cut = Math.min(cut, q);
	if (h !== -1) cut = Math.min(cut, h);
	const pathPart = decodePathPart(trimmed.slice(0, cut));
	const suffix = trimmed.slice(cut);
	const base = pathPart.startsWith("/") ? "" : dirOf(filePath);
	const normalized = normalizeRelPath(base === "" ? pathPart : `${base}/${pathPart}`);
	if (normalized === null) return { kind: "escape" };
	return {
		kind: "relative",
		path: normalized,
		suffix
	};
}
/**
* Guard a raw link/image target against dangerous protocols. Returns the
* (trimmed) raw string when safe, else null. Only these schemes are allowed:
* http:, https:, mailto: and fragment anchors (#...). Scheme-less relative
* paths (./ ../ / and plain filenames) pass through unchanged. Anything with
* a scheme outside the allow-list — javascript:, data:, vbscript:, etc. —
* is rejected so the value never reaches dangerouslySetInnerHTML.
*/
function safeWorkspaceUrl(raw) {
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	if (trimmed.startsWith("#")) return trimmed;
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
	if (scheme === null) return trimmed;
	const name = scheme[1].toLowerCase();
	return name === "http" || name === "https" || name === "mailto" ? trimmed : null;
}
/** Inline pass: code spans, bold, italic, strike, images, links. */
function renderWorkspaceInline(text, options) {
	let out = "";
	let i = 0;
	const n = text.length;
	while (i < n) {
		const char = text[i];
		if (char === "`") {
			const end = text.indexOf("`", i + 1);
			if (end !== -1) {
				out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
				i = end + 1;
				continue;
			}
		}
		if (char === "!" && text[i + 1] === "[") {
			const close = text.indexOf("](", i + 2);
			if (close !== -1) {
				const parenEnd = text.indexOf(")", close + 2);
				if (parenEnd !== -1) {
					const alt = text.slice(i + 2, close);
					const safe = safeWorkspaceUrl(text.slice(close + 2, parenEnd));
					if (safe === null) out += escapeHtml(alt);
					else {
						let target = safe;
						if (options?.resolveImageSrc !== void 0) target = options.resolveImageSrc(safe);
						if (target === null) out += escapeHtml(alt);
						else {
							const srcEsc = escapeHtml(target).replace(/\s+/g, "%20");
							out += `<img alt="${escapeHtml(alt)}" src="${srcEsc}" />`;
						}
					}
					i = parenEnd + 1;
					continue;
				}
			}
		}
		if (char === "[") {
			const close = text.indexOf("](", i + 1);
			if (close !== -1) {
				const parenEnd = text.indexOf(")", close + 2);
				if (parenEnd !== -1) {
					const label = text.slice(i + 1, close);
					const safe = safeWorkspaceUrl(text.slice(close + 2, parenEnd));
					if (safe === null) out += renderWorkspaceInline(label, options);
					else out += `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${renderWorkspaceInline(label, options)}</a>`;
					i = parenEnd + 1;
					continue;
				}
			}
		}
		if (char === "*" && text[i + 1] === "*") {
			const end = text.indexOf("**", i + 2);
			if (end !== -1) {
				out += `<strong>${renderWorkspaceInline(text.slice(i + 2, end), options)}</strong>`;
				i = end + 2;
				continue;
			}
		}
		if (char === "*" && text[i - 1] !== "*" && text[i + 1] !== "*") {
			const end = text.indexOf("*", i + 1);
			if (end !== -1 && text[end + 1] !== "*") {
				out += `<em>${renderWorkspaceInline(text.slice(i + 1, end), options)}</em>`;
				i = end + 1;
				continue;
			}
		}
		if (char === "~" && text[i + 1] === "~") {
			const end = text.indexOf("~~", i + 2);
			if (end !== -1) {
				out += `<del>${renderWorkspaceInline(text.slice(i + 2, end), options)}</del>`;
				i = end + 2;
				continue;
			}
		}
		out += escapeHtml(char);
		i += 1;
	}
	return out;
}
/** Render a markdown document to HTML (block pass). */
function renderWorkspaceMarkdown(source, options) {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const out = [];
	let i = 0;
	const n = lines.length;
	const flushParagraph = (buffer) => {
		if (buffer.length === 0) return;
		out.push(`<p>${renderWorkspaceInline(buffer.join("\n"), options)}</p>`);
		buffer.length = 0;
	};
	let paragraph = [];
	while (i < n) {
		const line = lines[i];
		const fence = /^```([\w+-]*)\s*$/.exec(line);
		if (fence !== null) {
			flushParagraph(paragraph);
			const lang = fence[1] ?? "";
			i += 1;
			const code = [];
			while (i < n && !/^```\s*$/.test(lines[i])) {
				code.push(lines[i]);
				i += 1;
			}
			i += 1;
			const escaped = escapeHtml(code.join("\n"));
			if (lang.toLowerCase() === "mermaid") out.push(`<pre class="language-mermaid" data-dsh-source="${escapeHtml(code.join("\n"))}"><code>${escaped}</code></pre>`);
			else {
				const langAttr = lang === "" ? "" : ` class="language-${escapeHtml(lang)}"`;
				out.push(`<pre${langAttr}><code>${escaped}</code></pre>`);
			}
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading !== null) {
			flushParagraph(paragraph);
			const level = heading[1].length;
			out.push(`<h${level}>${renderWorkspaceInline(heading[2] ?? "", options)}</h${level}>`);
			i += 1;
			continue;
		}
		if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
			flushParagraph(paragraph);
			out.push("<hr />");
			i += 1;
			continue;
		}
		if (line.includes("|") && i + 1 < n && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
			flushParagraph(paragraph);
			const headerCells = splitWorkspaceTableRow(line);
			i += 2;
			const rows = [];
			while (i < n && lines[i].includes("|")) {
				rows.push(splitWorkspaceTableRow(lines[i]));
				i += 1;
			}
			out.push("<table>");
			out.push(`<thead><tr>${headerCells.map((cell) => `<th>${renderWorkspaceInline(cell, options)}</th>`).join("")}</tr></thead>`);
			if (rows.length > 0) out.push(`<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderWorkspaceInline(cell, options)}</td>`).join("")}</tr>`).join("")}</tbody>`);
			out.push("</table>");
			continue;
		}
		if (/^>\s?(.*)$/.exec(line) !== null) {
			flushParagraph(paragraph);
			const body = [];
			while (i < n) {
				const q = /^>\s?(.*)$/.exec(lines[i]);
				if (q === null) break;
				body.push(q[1] ?? "");
				i += 1;
			}
			out.push(`<blockquote><p>${body.map((item) => renderWorkspaceInline(item, options)).join("<br />")}</p></blockquote>`);
			continue;
		}
		if (/^\s*([-*+])\s+(.*)$/.exec(line) !== null) {
			flushParagraph(paragraph);
			const items = [];
			while (i < n) {
				const item = /^\s*([-*+])\s+(.*)$/.exec(lines[i]);
				if (item === null) break;
				items.push(`<li>${renderWorkspaceInline(item[2] ?? "", options)}</li>`);
				i += 1;
			}
			out.push(`<ul>${items.join("")}</ul>`);
			continue;
		}
		if (/^\s*\d+[.)]\s+(.*)$/.exec(line) !== null) {
			flushParagraph(paragraph);
			const items = [];
			while (i < n) {
				const item = /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]);
				if (item === null) break;
				items.push(`<li>${renderWorkspaceInline(item[1] ?? "", options)}</li>`);
				i += 1;
			}
			out.push(`<ol>${items.join("")}</ol>`);
			continue;
		}
		if (line.trim() === "") {
			flushParagraph(paragraph);
			i += 1;
			continue;
		}
		paragraph.push(line);
		i += 1;
	}
	flushParagraph(paragraph);
	return out.join("\n");
}
/** Split one table row into cells (respecting the leading/trailing pipes). */
function splitWorkspaceTableRow(line) {
	const trimmed = line.trim();
	const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
	return (inner.endsWith("|") ? inner.slice(0, -1) : inner).split("|").map((cell) => cell.trim());
}
//#endregion
//#region packages/plugin/src/web/workspace-mermaid.ts
/**
* Mermaid enhancement for rendered Workspace markdown previews (v0.6,
* dsh-web-ui port). After the markdown renderer emits `pre.code.language-mermaid`
* blocks, this module loads the same-origin vendor bundle
* (`/workspace/vendor/mermaid.js`, shipped in the plugin package at build
* time — zero runtime npm dependency, ADR 0011) and renders each block in
* place. Renders that fail restore the block text so the diagram remains
* readable as code. The theme follows the shell's `prefers-color-scheme`.
*/
/** The same-origin vendor route served by the host. */
const MERMAID_VENDOR_URL = "/workspace/vendor/mermaid.js";
/** The markdown renderer emits mermaid fences as `pre.code.language-mermaid`. */
const MERMAID_BLOCK_SELECTOR = "pre code.language-mermaid";
/** Current shell theme from `prefers-color-scheme` (defaults to light). */
function shellIsDark() {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	try {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	} catch {
		return false;
	}
}
/** Observe shell theme flips; returns a disposer. */
function watchShellTheme(listener) {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
	try {
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (event) => listener(event.matches);
		if (typeof query.addEventListener === "function") query.addEventListener("change", onChange);
		else if (typeof query.addListener === "function") query.addListener(onChange);
		return () => {
			if (typeof query.removeEventListener === "function") query.removeEventListener("change", onChange);
			else if (typeof query.removeListener === "function") query.removeListener(onChange);
		};
	} catch {
		return () => {};
	}
}
/** The mermaid theme name for a shell theme. */
function mermaidTheme(isDark) {
	return isDark ? "dark" : "default";
}
/** Resolve the mermaid API from the vendor bundle (window.mermaid). */
function mermaidApi() {
	return globalThis.mermaid;
}
/** Load the vendor bundle once; resolves when mermaid is available. */
let vendorPromise;
function loadVendor() {
	if (mermaidApi()) return Promise.resolve(true);
	if (vendorPromise) return vendorPromise;
	vendorPromise = new Promise((resolve) => {
		if (typeof document === "undefined") {
			resolve(false);
			return;
		}
		const script = document.createElement("script");
		script.src = MERMAID_VENDOR_URL;
		script.async = true;
		script.onload = () => resolve(Boolean(mermaidApi()));
		script.onerror = () => resolve(false);
		document.head.appendChild(script);
	});
	return vendorPromise;
}
/** Initialize mermaid once with the current theme (idempotent per theme). */
let initializedFor;
function ensureInitialized(theme) {
	if (initializedFor === theme) return;
	const api = mermaidApi();
	if (!api) return;
	api.initialize({
		startOnLoad: false,
		theme,
		securityLevel: "strict",
		suppressErrorRendering: true
	});
	initializedFor = theme;
}
/**
* Render one mermaid code block in place. On success the `<pre>` is replaced
* by the diagram SVG (carrying the source in `data-dsh-source` so a later
* shell-theme flip can re-render it); on failure the block is restored so the
* raw text stays readable. Returns true when the block rendered.
*/
async function renderMermaidBlock(block, theme) {
	const code = block.querySelector("code");
	if (!code) return false;
	const source = code.textContent ?? "";
	if (!source.trim()) return false;
	const api = mermaidApi();
	if (!api) return false;
	ensureInitialized(theme);
	const id = `dsh-mermaid-${Math.random().toString(36).slice(2)}`;
	try {
		const { svg } = await api.render(id, source);
		const container = document.createElement("div");
		container.className = "dsh-workspace-mermaid";
		container.setAttribute("data-dsh-source", source);
		container.innerHTML = svg;
		block.replaceWith(container);
		return true;
	} catch {
		return false;
	}
}
/**
* Enhance every mermaid fence inside one rendered markdown subtree. Returns
* the number of blocks found (whether or not they rendered), so callers can
* decide when to show the "diagram unavailable" fallback.
*/
async function enhanceMermaidBlocks(root, theme) {
	const blocks = Array.from(root.querySelectorAll(MERMAID_BLOCK_SELECTOR)).map((code) => code.closest("pre")).slice(0, 16);
	if (blocks.length === 0) return 0;
	if (!await loadVendor()) return blocks.length;
	await Promise.all(blocks.map((block) => block ? renderMermaidBlock(block, theme) : Promise.resolve(false)));
	return blocks.length;
}
/** Re-theme already-rendered diagrams (shell theme flip). */
async function rethemeMermaidBlocks(root, theme) {
	const diagrams = Array.from(root.querySelectorAll(".dsh-workspace-mermaid"));
	if (diagrams.length === 0) return;
	const api = mermaidApi();
	if (!api) return;
	ensureInitialized(theme);
	for (const diagram of diagrams) {
		const source = diagram.getAttribute("data-dsh-source");
		if (!source) continue;
		try {
			const id = `dsh-mermaid-${Math.random().toString(36).slice(2)}`;
			const { svg } = await api.render(id, source);
			const next = document.createElement("div");
			next.className = "dsh-workspace-mermaid";
			next.setAttribute("data-dsh-source", source);
			next.innerHTML = svg;
			diagram.replaceWith(next);
		} catch {}
	}
}
//#endregion
//#region packages/plugin/src/web/workspace-i18n.ts
const table = {
	refresh: {
		en: "Refresh",
		zh: "刷新"
	},
	cancel: {
		en: "Cancel",
		zh: "取消"
	},
	search: {
		en: "Search",
		zh: "搜索"
	},
	download: {
		en: "Download",
		zh: "下载"
	},
	downloading: {
		en: "Downloading…",
		zh: "下载中…"
	},
	cancelDownload: {
		en: "Cancel download",
		zh: "取消下载"
	},
	downloadStarted: {
		en: "Download started.",
		zh: "下载已开始。"
	},
	loading: {
		en: "Loading…",
		zh: "加载中…"
	},
	copy: {
		en: "Copy",
		zh: "复制"
	},
	"artifacts.title": {
		en: "Artifacts",
		zh: "产物"
	},
	"artifacts.count": {
		en: "artifacts",
		zh: "个产物"
	},
	"artifacts.countOne": {
		en: "artifact",
		zh: "个产物"
	},
	"artifacts.requireSession": {
		en: "Workspace artifacts require an active Harness session.",
		zh: "Workspace 产物需要处于活动状态的 Harness 会话。"
	},
	"artifacts.unavailable": {
		en: "Workspace artifacts are unavailable.",
		zh: "Workspace 产物当前不可用。"
	},
	"artifacts.loading": {
		en: "Loading Workspace artifacts…",
		zh: "正在加载 Workspace 产物…"
	},
	"artifacts.empty": {
		en: "No session artifacts yet — ask the agent to create a file and it appears here automatically.",
		zh: "还没有会话产物——让智能体创建一个文件，它会自动出现在这里。"
	},
	"artifacts.noMatch": {
		en: "No artifacts match your search.",
		zh: "没有匹配搜索条件的产物。"
	},
	"artifacts.searchLabel": {
		en: "Search artifacts",
		zh: "搜索产物"
	},
	"artifacts.searchPlaceholder": {
		en: "Filter by name…",
		zh: "按名称筛选…"
	},
	"artifacts.hiddenSkipped": {
		en: "hidden",
		zh: "已隐藏"
	},
	"artifacts.selectHint": {
		en: "Select an artifact to preview it.",
		zh: "选择一个产物以预览。"
	},
	"artifacts.loadingPreview": {
		en: "Loading artifact preview…",
		zh: "正在加载产物预览…"
	},
	"artifacts.previewUnavailable": {
		en: "Workspace artifact preview is unavailable.",
		zh: "Workspace 产物预览不可用。"
	},
	"artifacts.category.documents": {
		en: "Documents",
		zh: "文档"
	},
	"artifacts.category.data": {
		en: "Data",
		zh: "数据"
	},
	"artifacts.category.images": {
		en: "Images",
		zh: "图片"
	},
	"artifacts.category.other": {
		en: "Other",
		zh: "其他"
	},
	"artifacts.provenance": {
		en: "Artifact provenance",
		zh: "产物来源"
	},
	"artifacts.source": {
		en: "Source",
		zh: "来源"
	},
	"artifacts.downloadUnsupported": {
		en: "Download is unsupported in this browser.",
		zh: "当前浏览器不支持下载。"
	},
	"artifacts.previewUnsupported": {
		en: "Preview unavailable",
		zh: "预览不可用"
	},
	"memory.title": {
		en: "Memory",
		zh: "记忆"
	},
	"memory.requireSession": {
		en: "Workspace Memory requires an active Harness session.",
		zh: "Workspace 记忆需要处于活动状态的 Harness 会话。"
	},
	"memory.unavailable": {
		en: "Workspace Memory is unavailable.",
		zh: "Workspace 记忆当前不可用。"
	},
	"memory.loading": {
		en: "Loading Workspace Memory…",
		zh: "正在加载 Workspace 记忆…"
	},
	"memory.scope": {
		en: "Memory scope",
		zh: "记忆范围"
	},
	"memory.scope.project": {
		en: "Project",
		zh: "项目"
	},
	"memory.scope.session": {
		en: "Session",
		zh: "会话"
	},
	"memory.scope.user": {
		en: "User",
		zh: "用户"
	},
	"memory.scope.sharedProject": {
		en: "Shared Project",
		zh: "共享项目"
	},
	"memory.searchLabel": {
		en: "Search Memory",
		zh: "搜索记忆"
	},
	"memory.typeFilter": {
		en: "Type filter",
		zh: "类型筛选"
	},
	"memory.statusFilter": {
		en: "Status filter",
		zh: "状态筛选"
	},
	"memory.allTypes": {
		en: "All types",
		zh: "全部类型"
	},
	"memory.export": {
		en: "Export Memory",
		zh: "导出记忆"
	},
	"memory.import": {
		en: "Import Memory",
		zh: "导入记忆"
	},
	"memory.records": {
		en: "records",
		zh: "条记录"
	},
	"memory.recordOne": {
		en: "record",
		zh: "条记录"
	},
	"memory.governance": {
		en: "Memory governance",
		zh: "记忆治理"
	},
	"memory.operationFailed": {
		en: "Memory operation failed; records were not changed.",
		zh: "记忆操作失败；记录未更改。"
	},
	"memory.newerSchema": {
		en: "This Memory file uses a newer schema and is read-only.",
		zh: "此记忆文件使用更新的架构，为只读。"
	},
	"memory.warnings": {
		en: "local record warning(s).",
		zh: "条本地记录警告。"
	},
	"memory.locally": {
		en: "locally.",
		zh: "到本地。"
	},
	"memory.empty": {
		en: "No Memory records for this scope yet. Save a record or ask the agent to propose one.",
		zh: "此范围内还没有记忆记录。保存一条记录，或让智能体提议一条。"
	},
	"memory.create": {
		en: "Create Memory",
		zh: "新建记忆"
	},
	"memory.edit": {
		en: "Edit",
		zh: "编辑"
	},
	"memory.titleField": {
		en: "Title",
		zh: "标题"
	},
	"memory.typeField": {
		en: "Type",
		zh: "类型"
	},
	"memory.contentField": {
		en: "Content",
		zh: "内容"
	},
	"memory.save": {
		en: "Create Memory",
		zh: "新建记忆"
	},
	"memory.saveChanges": {
		en: "Save changes",
		zh: "保存修改"
	},
	"memory.archive": {
		en: "Archive",
		zh: "归档"
	},
	"memory.forget": {
		en: "Forget",
		zh: "遗忘"
	},
	"memory.restore": {
		en: "Restore",
		zh: "恢复"
	},
	"memory.verify": {
		en: "Verify",
		zh: "验证"
	},
	"memory.reverify": {
		en: "Re-verify",
		zh: "重新验证"
	},
	"memory.reject": {
		en: "Reject conflict",
		zh: "拒绝冲突"
	},
	"memory.pin": {
		en: "Pin",
		zh: "置顶"
	},
	"memory.unpin": {
		en: "Unpin",
		zh: "取消置顶"
	},
	"memory.saved": {
		en: "Memory saved locally.",
		zh: "记忆已保存到本地。"
	},
	"memory.origin": {
		en: "Origin",
		zh: "来源"
	},
	"memory.verification": {
		en: "Verification",
		zh: "验证状态"
	},
	"memory.retention": {
		en: "Retention",
		zh: "保留策略"
	},
	"memory.revision": {
		en: "Revision",
		zh: "修订号"
	},
	"memory.sources": {
		en: "Sources",
		zh: "来源引用"
	},
	"memory.conflictGroup": {
		en: "Conflict group",
		zh: "冲突分组"
	},
	"memory.expires": {
		en: "Expires",
		zh: "过期时间"
	},
	"memory.none": {
		en: "none",
		zh: "无"
	},
	"memory.conflictHint": {
		en: "Conflicting Memory uses the same title and type with different content. Verify one or reject this item.",
		zh: "存在同标题同类型但内容不同的冲突记忆。请验证一条，或拒绝此项。"
	},
	"memory.conflictTitle": {
		en: "Conflict comparison",
		zh: "冲突对比"
	},
	"memory.keepVersion": {
		en: "Keep this version",
		zh: "保留此版本"
	},
	"memory.selected": {
		en: "Selected",
		zh: "已选择"
	},
	"memory.conflict": {
		en: "Conflict",
		zh: "冲突"
	},
	"memory.review": {
		en: "Review",
		zh: "审阅"
	},
	"memory.readOnly": {
		en: "Read-only Memory",
		zh: "只读记忆"
	},
	"memory.reviewOnly": {
		en: "Review only: Memory never injects records into Agent context.",
		zh: "仅审阅：记忆绝不会向智能体上下文注入记录。"
	},
	"memory.forgetTitle": {
		en: "Forget Memory?",
		zh: "遗忘此记忆？"
	},
	"memory.forgetDescription": {
		en: "This will tombstone 1 record in {scope}. Existing exports or model turns cannot be recalled.",
		zh: "这将在{scope}中标记 1 条记录为已删除。已有的导出或模型轮次将无法找回。"
	},
	"memory.forgetRecord": {
		en: "Forget record",
		zh: "遗忘记录"
	},
	"memory.ackSharedWrite": {
		en: " I understand this writes to the shared Workspace Memory.",
		zh: " 我了解这会写入共享的 Workspace 记忆。"
	},
	"memory.userProfile": {
		en: "User profile",
		zh: "用户档案"
	},
	"memory.proposal": {
		en: "Proposal",
		zh: "提议"
	},
	"memory.archived": {
		en: "archived",
		zh: "已归档"
	},
	"memory.forgotten": {
		en: "forgotten",
		zh: "已遗忘"
	},
	"memory.verified": {
		en: "verified",
		zh: "已验证"
	},
	"memory.reverified": {
		en: "re-verified",
		zh: "已重新验证"
	},
	"memory.pinned": {
		en: "pinned",
		zh: "已置顶"
	},
	"memory.unpinned": {
		en: "unpinned",
		zh: "已取消置顶"
	},
	"memory.restored": {
		en: "restored",
		zh: "已恢复"
	},
	"memory.rejected": {
		en: "rejected",
		zh: "已拒绝"
	},
	"memory.exportReady": {
		en: "Memory export ready ({bytes} bytes).",
		zh: "记忆导出就绪（{bytes} 字节）。"
	},
	"memory.imported": {
		en: "{count} record(s) imported as unverified review items.",
		zh: "已导入 {count} 条记录，作为未验证的审阅项。"
	},
	"memory.keptVersion": {
		en: "Kept the selected Memory version and resolved conflicting records.",
		zh: "已保留所选记忆版本并解决冲突记录。"
	},
	"memory.conflictResolved": {
		en: "Memory conflict resolved.",
		zh: "记忆冲突已解决。"
	},
	"memory.sharedWriteAck": {
		en: "Acknowledge Shared Project writes before changing Memory.",
		zh: "修改记忆前，请先确认你了解共享项目的写入。"
	},
	"memory.importSizeLimit": {
		en: "Memory import exceeds the safe size limit.",
		zh: "记忆导入超过安全大小限制。"
	},
	"memory.recordSummary.never": {
		en: "never",
		zh: "从未"
	},
	"changes.title": {
		en: "Changes",
		zh: "变更"
	},
	"changes.count": {
		en: "{count} change",
		zh: "{count} 个变更"
	},
	"changes.countPlural": {
		en: "{count} changes",
		zh: "{count} 个变更"
	},
	"changes.requireSession": {
		en: "Git changes require an active Harness session.",
		zh: "Git 变更需要处于活动状态的 Harness 会话。"
	},
	"changes.unavailable": {
		en: "Git changes are unavailable.",
		zh: "Git 变更当前不可用。"
	},
	"changes.loading": {
		en: "Loading git changes…",
		zh: "正在加载 Git 变更…"
	},
	"changes.empty": {
		en: "No changes in the working tree.",
		zh: "工作区中没有变更。"
	},
	"changes.filter": {
		en: "Filter changes",
		zh: "筛选变更"
	},
	"changes.filter.all": {
		en: "All",
		zh: "全部"
	},
	"changes.filter.added": {
		en: "Added",
		zh: "新增"
	},
	"changes.filter.modified": {
		en: "Modified",
		zh: "修改"
	},
	"changes.filter.deleted": {
		en: "Deleted",
		zh: "删除"
	},
	"changes.filter.untracked": {
		en: "Untracked",
		zh: "未跟踪"
	},
	"changes.filter.staged": {
		en: "Staged",
		zh: "已暂存"
	},
	"changes.noFiltered": {
		en: "No {filter} changes in this view.",
		zh: "此视图中没有{filter}变更。"
	},
	"changes.selectHint": {
		en: "Select a file to preview its diff.",
		zh: "选择文件以预览其 diff。"
	},
	"changes.loadingDiff": {
		en: "Loading diff…",
		zh: "正在加载 diff…"
	},
	"changes.diffUnavailable": {
		en: "Diff is unavailable for this change.",
		zh: "此变更的 diff 不可用。"
	},
	"changes.copyDiff": {
		en: "Copy diff",
		zh: "复制 diff"
	},
	"changes.copyUnavailable": {
		en: "Copy is unavailable in this browser; select the diff text manually.",
		zh: "当前浏览器不支持复制；请手动选择 diff 文本。"
	},
	"changes.noDiffText": {
		en: "There is no diff text to copy.",
		zh: "没有可复制的 diff 文本。"
	},
	"changes.copyFailed": {
		en: "Copy failed; select the diff text manually.",
		zh: "复制失败；请手动选择 diff 文本。"
	},
	"changes.copyCopied": {
		en: "Diff copied to the clipboard.",
		zh: "diff 已复制到剪贴板。"
	},
	"changes.newChanges": {
		en: "New changes · Refresh",
		zh: "有新的变更 · 刷新"
	},
	"changes.diffTruncated": {
		en: "Diff truncated; additional content omitted.",
		zh: "diff 已截断；其余内容已省略。"
	},
	"changes.untrackedNotice": {
		en: "Untracked file — stage it to see a diff.",
		zh: "未跟踪文件——暂存后可查看 diff。"
	},
	"changes.diffCollapsed": {
		en: "Diff collapsed — expand to review.",
		zh: "diff 已折叠——展开以审阅。"
	},
	"changes.staged": {
		en: "Staged",
		zh: "已暂存"
	},
	"changes.unstaged": {
		en: "Unstaged",
		zh: "未暂存"
	},
	"changes.noDiffContent": {
		en: "No diff content for this change.",
		zh: "此变更没有 diff 内容。"
	},
	"changes.collapseDiff": {
		en: "Collapse file diff",
		zh: "折叠文件 diff"
	},
	"changes.expandDiff": {
		en: "Expand file diff",
		zh: "展开文件 diff"
	},
	"changes.previousFile": {
		en: "Previous file",
		zh: "上一个文件"
	},
	"changes.nextFile": {
		en: "Next file",
		zh: "下一个文件"
	},
	"changes.diffMode": {
		en: "Diff view mode",
		zh: "diff 视图模式"
	},
	"changes.unified": {
		en: "Unified",
		zh: "统一视图"
	},
	"changes.split": {
		en: "Split",
		zh: "分栏视图"
	},
	"changes.hiddenLines": {
		en: "Show {count} hidden lines",
		zh: "显示 {count} 行隐藏内容"
	},
	"changes.hiddenLine": {
		en: "Show {count} hidden line",
		zh: "显示 {count} 行隐藏内容"
	},
	"changes.group.staged": {
		en: "Staged",
		zh: "已暂存"
	},
	"changes.group.unstaged": {
		en: "Unstaged",
		zh: "未暂存"
	},
	"changes.group.untracked": {
		en: "Untracked",
		zh: "未跟踪"
	},
	"changes.status.index": {
		en: "Index",
		zh: "暂存区"
	},
	"changes.status.worktree": {
		en: "Worktree",
		zh: "工作区"
	},
	"changes.status.untracked": {
		en: "Untracked",
		zh: "未跟踪"
	},
	"preview.status": {
		en: "status",
		zh: "状态"
	},
	"preview.jsonLabel": {
		en: "Workspace JSON",
		zh: "Workspace JSON"
	},
	"preview.csvTitle": {
		en: "Workspace CSV preview",
		zh: "Workspace CSV 预览"
	},
	"preview.csvTruncatedTitle": {
		en: "Workspace CSV preview (additional rows omitted)",
		zh: "Workspace CSV 预览（其余行已省略）"
	},
	"preview.truncatedNote": {
		en: "Preview truncated; additional content omitted.",
		zh: "预览已截断；其余内容已省略。"
	},
	"preview.downloadName": {
		en: "workspace file",
		zh: "工作区文件"
	},
	"preview.imageAlt": {
		en: "Workspace image",
		zh: "工作区图片"
	},
	"preview.resourceUnavailable": {
		en: "Preview resource is unavailable",
		zh: "预览资源不可用"
	},
	"preview.previewUnavailable": {
		en: "Preview unavailable: {reason}. Download is unavailable for this file.",
		zh: "预览不可用：{reason}。此文件不支持下载。"
	},
	"preview.downloadUnavailable": {
		en: "Download is unavailable for this file.",
		zh: "此文件不支持下载。"
	},
	"preview.downloadAction": {
		en: "Download {name}",
		zh: "下载{name}"
	},
	"view.artifacts": {
		en: "Artifacts",
		zh: "产物"
	},
	"view.memory": {
		en: "Memory",
		zh: "记忆"
	},
	"view.changes": {
		en: "Changes",
		zh: "变更"
	},
	"view.workspace": {
		en: "Workspace",
		zh: "工作区"
	},
	"summary.workspaceName": {
		en: "Workspace",
		zh: "工作区"
	},
	"summary.files": {
		en: "{count} files",
		zh: "{count} 个文件"
	},
	"summary.artifacts": {
		en: "{count} artifacts",
		zh: "{count} 个产物"
	},
	"summary.memory": {
		en: "{count} memory · {count2} decisions",
		zh: "{count} 条记忆 · {count2} 条决策"
	},
	"summary.active": {
		en: "active {span}",
		zh: "活跃 {span}"
	},
	"summary.justNow": {
		en: "just now",
		zh: "刚刚"
	},
	"summary.unavailable": {
		en: "Workspace summary is unavailable.",
		zh: "Workspace 摘要当前不可用。"
	},
	"error.gitUnavailable": {
		en: "Git is not available for this workspace.",
		zh: "此工作区不可用 Git。"
	},
	"error.notGitRepository": {
		en: "This workspace is not a git repository.",
		zh: "此工作区不是 Git 仓库。"
	},
	"error.gitTimeout": {
		en: "Git did not respond in time; try again.",
		zh: "Git 未及时响应；请重试。"
	},
	"error.gitOutputTooLarge": {
		en: "The change is too large to show fully.",
		zh: "变更内容过大，无法完整显示。"
	},
	"error.pathOutsideWorkspace": {
		en: "This change sits outside the Workspace and is blocked.",
		zh: "此变更位于 Workspace 之外，已被拦截。"
	},
	"error.providerUnavailable": {
		en: "The Workspace provider is unavailable right now.",
		zh: "Workspace 提供方当前不可用。"
	},
	"error.projectUnavailable": {
		en: "This session is not bound to a Workspace.",
		zh: "此会话未绑定到 Workspace。"
	},
	"error.resourceStale": {
		en: "This item changed or expired; refresh to see the latest.",
		zh: "此项已变更或过期；刷新以查看最新内容。"
	},
	"error.resourceExpired": {
		en: "This item expired; refresh to reload it.",
		zh: "此项已过期；刷新以重新加载。"
	},
	"error.fileTooLarge": {
		en: "This item is too large to preview.",
		zh: "此项过大，无法预览。"
	},
	"error.symlinkEscape": {
		en: "This item points outside the Workspace and is blocked.",
		zh: "此项指向 Workspace 之外，已被拦截。"
	}
};
let activeLocale = "en";
function detectLocale() {
	if (typeof navigator !== "undefined" && typeof navigator.language === "string") return /^zh/i.test(navigator.language) ? "zh" : "en";
	return "en";
}
/** Look up one message with `{placeholder}` interpolation. */
function t(key, vars) {
	const entry = table[key];
	if (!entry) return key;
	let message = activeLocale === "zh" ? entry.zh : entry.en;
	if (vars) for (const [name, value] of Object.entries(vars)) message = message.replaceAll(`{${name}}`, String(value));
	return message;
}
try {
	activeLocale = detectLocale();
} catch {
	activeLocale = "en";
}
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
/** Single authorized opaque-resource URL builder shared by preview + download paths. */
function workspaceResourceUrl(resourceId, mediaType, options = {}) {
	const resourcePath = options.resourcePath ?? "/workspace/resource";
	if (typeof resourceId !== "string" || !resourceId || typeof mediaType !== "string" || !mediaType || typeof resourcePath !== "string" || !/^\/[A-Za-z0-9._/-]+$/u.test(resourcePath) || resourcePath.endsWith("/")) return;
	const url = new URL(resourcePath, "http://workspace.local");
	url.searchParams.set("id", resourceId);
	url.searchParams.set("type", mediaType);
	if (options.download) url.searchParams.set("download", "1");
	return `${url.pathname}${url.search}`;
}
function buildWorkspaceResourceUrl(artifact, resourcePath = "/workspace/resource") {
	const safeArtifact = assertArtifact(artifact);
	if (!safeArtifact.resourceId) return void 0;
	return workspaceResourceUrl(safeArtifact.resourceId, safeArtifact.mediaType, {
		download: true,
		resourcePath
	});
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
//#region packages/plugin/src/web/workspace-preview-adapters.ts
/**
* Remove remote Markdown image fetches before rendering, while preserving
* relative images so the v0.6 renderer can resolve them to same-origin opaque
* resource URLs. Relative srcs (`./x.png`, `../x.png`, `/x.png`, plain
* filenames) pass through unchanged; absolute http(s)/data:/other-scheme srcs
* and remote reference definitions are stripped to their alt text. The
* renderer's `resolveImageSrc` hook then decides what actually renders.
*/
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
				const hasExplicitDestination = withoutRemoteDefinitions[destinationStart] === "(" || withoutRemoteDefinitions[destinationStart] === "[";
				const isRemote = hasExplicitDestination && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(withoutRemoteDefinitions.slice(destinationStart + 1, destinationEnd === -1 ? void 0 : destinationEnd).trim());
				if ((!hasExplicitDestination || destinationEnd !== -1) && isRemote) {
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
	const table = createElement("table", { "data-dsh-workspace-preview": "csv" }, createElement("caption", null, truncated ? t("preview.csvTruncatedTitle") : t("preview.csvTitle")), createElement("thead", null, createElement("tr", null, columns.map((column, index) => createElement("th", {
		key: index,
		scope: "col"
	}, column)))), createElement("tbody", null, rows.map((row, rowIndex) => createElement("tr", { key: rowIndex }, row.map((cell, columnIndex) => createElement("td", { key: columnIndex }, cell))))));
	return createElement("div", {
		role: "region",
		"aria-label": t("preview.csvTitle"),
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
	return workspaceResourceUrl(descriptor.resourceId, descriptor.mediaType, {
		download,
		resourcePath: options.resourcePath
	});
}
function imageAlt(descriptor, options) {
	return (options.altText ?? descriptor.path.split("/").pop() ?? t("preview.imageAlt")).replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 180) || t("preview.imageAlt");
}
function withTruncation(content, truncated) {
	if (!truncated) return content;
	return createElement("div", { "data-dsh-workspace-preview": "truncated" }, content, createElement("p", { role: "status" }, t("preview.truncatedNote")));
}
/** Render only bounded, already-authorized Host data through public UI primitives. */
function createWorkspacePreviewRenderer(primitives, descriptor, options = {}) {
	if (descriptor.type === "error") return status(descriptor.message);
	if (descriptor.type === "unsupported") {
		const metadata = [descriptor.mediaType, descriptor.size === void 0 ? void 0 : `${descriptor.size} bytes`].filter(Boolean).join(", ");
		return status(t("preview.previewUnavailable", { reason: descriptor.reason }) + (metadata ? ` (${metadata})` : ""));
	}
	if (descriptor.type === "text") return withTruncation(primitiveElement(primitives.CodeBlock, {
		code: descriptor.content,
		lang: descriptor.language
	}), descriptor.truncated);
	if (descriptor.type === "markdown") {
		const imageUrls = descriptor.imageUrls;
		const html = renderWorkspaceMarkdown(sanitizeWorkspaceMarkdown(descriptor.content), { resolveImageSrc: (src) => {
			const safe = safeWorkspaceUrl(src);
			if (safe === null) return null;
			if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(safe)) return null;
			if (imageUrls && Object.prototype.hasOwnProperty.call(imageUrls, safe)) return imageUrls[safe] ?? null;
			return resolveWorkspaceMarkdownImage(descriptor.path, safe).kind === "relative" ? imageUrls?.[safe] ?? null : null;
		} });
		return withTruncation(createElement(WorkspaceMarkdownView, { html }), descriptor.truncated);
	}
	if (descriptor.type === "json") {
		const data = descriptor.value !== null && typeof descriptor.value === "object" ? descriptor.value : { value: descriptor.value };
		return primitiveElement(primitives.JsonTree, {
			data,
			label: t("preview.jsonLabel"),
			copyable: true,
			expandTopLevel: true
		});
	}
	if (descriptor.type === "csv") return withTruncation(csvTable(descriptor.columns, descriptor.rows, descriptor.truncated), descriptor.truncated);
	const resourceUrl = resourceHref(descriptor, options, false);
	if (!resourceUrl) return status(t("preview.resourceUnavailable"));
	if (descriptor.mediaType.startsWith("image/")) return createElement("img", {
		src: resourceUrl,
		alt: imageAlt(descriptor, options),
		loading: "lazy"
	});
	if (descriptor.mediaType === "application/pdf") return createElement("iframe", {
		src: resourceUrl,
		title: t("preview.downloadName")
	});
	const downloadUrl = resourceHref(descriptor, options, true);
	return createElement("a", {
		href: downloadUrl,
		download: options.downloadName
	}, t("preview.downloadAction", { name: options.downloadName ?? t("preview.downloadName") }));
}
/**
* Rendered markdown body plus the mermaid enhancement lifecycle: fresh blocks
* render once per html, completed diagrams re-render on shell theme flips.
*/
function WorkspaceMarkdownView({ html }) {
	const ref = useRef(null);
	useEffect(() => {
		const el = ref.current;
		if (el === null) return void 0;
		enhanceMermaidBlocks(el, mermaidTheme(shellIsDark()));
		return watchShellTheme((isDark) => {
			rethemeMermaidBlocks(el, mermaidTheme(isDark));
		});
	}, [html]);
	return createElement("div", {
		ref,
		"data-dsh-workspace-preview": "markdown",
		dangerouslySetInnerHTML: { __html: html }
	});
}
//#endregion
//#region packages/plugin/src/web/workspace-remote.ts
/** Unwrap a RemoteResult, throwing a normalized `CODE: message` error on failure. */
function unwrapRemote(result) {
	if (result.ok) return result.value;
	throw new Error(`${result.error.code}: ${result.error.message}`);
}
/** Best-effort extraction of the leading error code from a thrown message. */
function remoteCode(error) {
	if (!(error instanceof Error)) return void 0;
	const code = error.message.split(":")[0]?.trim();
	return code && code.length > 0 && code.length <= 64 ? code : void 0;
}
const remoteMessages = {
	GIT_UNAVAILABLE: "error.gitUnavailable",
	NOT_A_GIT_REPOSITORY: "error.notGitRepository",
	GIT_TIMEOUT: "error.gitTimeout",
	GIT_OUTPUT_TOO_LARGE: "error.gitOutputTooLarge",
	PATH_OUTSIDE_WORKSPACE: "error.pathOutsideWorkspace",
	PROVIDER_UNAVAILABLE: "error.providerUnavailable",
	PROJECT_UNAVAILABLE: "error.projectUnavailable",
	RESOURCE_STALE: "error.resourceStale",
	RESOURCE_EXPIRED: "error.resourceExpired",
	FILE_TOO_LARGE: "error.fileTooLarge",
	SYMLINK_ESCAPE: "error.symlinkEscape"
};
/** Map a remote error code to a friendly, non-technical message. */
function friendlyRemoteMessage(code, fallback) {
	if (code) {
		const key = remoteMessages[code];
		if (key) return t(key);
	}
	return fallback;
}
/** Friendly user-facing message for a thrown remote error. */
function remoteErrorMessage(error, fallback) {
	if (error instanceof Error && error.message) return friendlyRemoteMessage(remoteCode(error), error.message);
	return fallback;
}
//#endregion
//#region packages/plugin/src/web/workspace-primitives.ts
/** A notice callout with an informational/warning/error tone. */
function workspaceNotice(tone, children, key) {
	return createElement("div", {
		key,
		"data-dsh-workspace": "notice",
		"data-dsw-tone": tone
	}, createElement("p", { role: "status" }, children));
}
/** A dashed empty-state callout with guidance. */
function workspaceEmptyState(children, key) {
	return createElement("div", {
		key,
		"data-dsh-workspace": "empty-state"
	}, children);
}
/** A pill count badge. `text` is the fully-formed label (e.g. "2 changes"). */
function workspaceCountBadge(text, variant = "accent", key) {
	return createElement("span", {
		key,
		"data-dsh-workspace": "count-badge",
		...variant === "neutral" ? { "data-dsw-variant": "neutral" } : {}
	}, text);
}
/** Surface header row: title + optional count badge + optional action buttons. */
function workspaceSurfaceHeader(parts) {
	return createElement("header", { "data-dsh-workspace": "surface-header" }, createElement("div", { "data-dsh-workspace": "surface-title" }, createElement("h3", null, parts.title), parts.count), parts.actions && createElement("div", { "data-dsh-workspace": "surface-actions" }, parts.actions));
}
/** A filter chip button with pressed state. */
function workspaceFilterChip(label, active, onClick, key) {
	return createElement("button", {
		key,
		type: "button",
		"data-dsh-workspace": "filter-chip",
		"aria-pressed": active,
		onClick
	}, label);
}
/**
* Shared two-column list | detail layout. Wraps the v0.7 `columns` CSS so the
* three Workspace surfaces (Artifacts / Memory / Changes) share one structure
* without per-surface UI atoms. Left column holds the persistent list; right
* column holds the detail/preview that stays visible while the list is browsed.
* Collapses to a single column below 760px via the shared stylesheet.
*/
function workspaceListDetail(list, detail, key) {
	return createElement("div", {
		key,
		"data-dsh-workspace": "columns"
	}, createElement("div", { "data-dsh-workspace": "column-list" }, list), createElement("div", { "data-dsh-workspace": "column-detail" }, detail));
}
//#endregion
//#region packages/plugin/src/web/workspace-artifact-surface.ts
const WORKSPACE_ARTIFACT_SLOT_NAME = "shell.overlay";
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
			policy: preview.policy,
			...preview.imageUrls === void 0 ? {} : { imageUrls: preview.imageUrls }
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
const documentTypes = /* @__PURE__ */ new Set([
	"text/markdown",
	"text/plain",
	"application/pdf",
	"text/html",
	"application/x-yaml",
	"text/yaml",
	"application/x-toml"
]);
const dataTypes = /* @__PURE__ */ new Set([
	"application/json",
	"text/csv",
	"application/x-ndjson",
	"application/xml"
]);
const imageTypes = /* @__PURE__ */ new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif"
]);
/** Deterministic PRD-style grouping by media type (documents / data / images / other). */
function workspaceArtifactCategory(mediaType) {
	if (imageTypes.has(mediaType)) return "images";
	if (dataTypes.has(mediaType)) return "data";
	if (documentTypes.has(mediaType) || mediaType.startsWith("text/")) return "documents";
	return "other";
}
const categoryLabels = {
	documents: () => t("artifacts.category.documents"),
	data: () => t("artifacts.category.data"),
	images: () => t("artifacts.category.images"),
	other: () => t("artifacts.category.other")
};
const categoryOrder = [
	"documents",
	"data",
	"images",
	"other"
];
function artifactGroups(artifacts) {
	return categoryOrder.map((group) => artifacts.filter((artifact) => workspaceArtifactCategory(artifact.mediaType) === group));
}
function artifactTypeBadge(artifact) {
	const name = artifact.name;
	const index = name.lastIndexOf(".");
	return index === -1 ? "FILE" : name.slice(index + 1).toUpperCase().slice(0, 6);
}
function artifactStatus(artifact) {
	return artifact.preview;
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
/** Lenient normalization: a single malformed artifact is skipped, not fatal. */
function normalizeLenient(input) {
	try {
		return {
			items: normalizeWorkspaceArtifacts(input),
			skipped: 0
		};
	} catch {
		const items = [];
		let skipped = 0;
		for (const item of input) try {
			items.push(...normalizeWorkspaceArtifacts([item]));
		} catch {
			skipped += 1;
		}
		return {
			items,
			skipped
		};
	}
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
		const [openTabs, setOpenTabs] = useState([]);
		const [tabStates, setTabStates] = useState(/* @__PURE__ */ new Map());
		const [detail, setDetail] = useState();
		const [detailStatus, setDetailStatus] = useState("idle");
		const [query, setQuery] = useState("");
		const [skipped, setSkipped] = useState(0);
		const [message, setMessage] = useState();
		const [download, setDownload] = useState({});
		const [refreshTick, setRefreshTick] = useState(0);
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
				setMessage(t("artifacts.unavailable"));
				return () => {
					active = false;
				};
			}
			if (!sessionId) {
				setStatus("degraded");
				return () => {
					active = false;
				};
			}
			const refresh = async () => {
				const token = ++refreshRequest.current;
				try {
					const normalized = normalizeLenient(unwrapRemote(await activeRemote.artifactMetadata()));
					if (!active || token !== refreshRequest.current) return;
					const items = normalized.items;
					const currentId = selectedIdRef.current;
					const nextId = currentId && items.some((item) => item.id === currentId) ? currentId : items[0]?.id;
					const nextArtifact = items.find((item) => item.id === nextId);
					const nextIdentity = artifactIdentity(nextArtifact);
					const selectedArtifactChanged = selectedIdentityRef.current !== nextIdentity;
					const refreshTextPreview = nextArtifact !== void 0 && nextArtifact.resourceId === void 0;
					selectedIdRef.current = nextId;
					selectedIdentityRef.current = nextIdentity;
					setArtifacts(items);
					setSkipped(normalized.skipped);
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
					setMessage(normalized.skipped > 0 ? `${normalized.skipped} ${t("artifacts.hiddenSkipped")}` : void 0);
				} catch {
					if (!active || token !== refreshRequest.current) return;
					setStatus((current) => current === "loading" ? "degraded" : current);
					setMessage(t("artifacts.unavailable"));
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
		}, [
			activeRemote,
			options.refreshMs,
			refreshTick
		]);
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
			setDownload({});
			setOpenTabs((tabs) => tabs.includes(artifact.id) ? tabs : tabs.length >= 8 ? tabs : [...tabs, artifact.id]);
			const cached = tabStates.get(artifact.id);
			if (cached) {
				setDetail(cached.descriptor);
				setDetailStatus(cached.status);
				setMessage(cached.message);
				return;
			}
			setTabStates((states) => new Map(states).set(artifact.id, { status: "loading" }));
			setDetail(void 0);
			setDetailStatus("loading");
			setMessage(void 0);
			const token = ++request.current;
			activeRemote?.previewArtifact(artifact.id).then((result) => {
				if (token !== request.current) return;
				if (!result.ok) {
					const state = {
						status: "error",
						message: t("artifacts.previewUnavailable")
					};
					setTabStates((states) => new Map(states).set(artifact.id, state));
					setDetailStatus("error");
					setMessage(t("artifacts.previewUnavailable"));
					return;
				}
				const detailValue = createWorkspaceArtifactDetail(artifact, descriptorFor(artifact, result.value));
				const state = {
					descriptor: detailValue.descriptor,
					status: detailValue.status,
					message: detailValue.message
				};
				setTabStates((states) => new Map(states).set(artifact.id, state));
				setDetail(detailValue.descriptor);
				setDetailStatus(detailValue.status);
				setMessage(detailValue.message);
			}).catch((error) => {
				if (token !== request.current) return;
				const state = {
					status: "error",
					message: friendlyRemoteMessage(remoteCode(error), t("artifacts.previewUnavailable"))
				};
				setTabStates((states) => new Map(states).set(artifact.id, state));
				setDetailStatus("error");
				setMessage(t("artifacts.previewUnavailable"));
			});
		};
		const closeTab = (id) => {
			setOpenTabs((tabs) => {
				const index = tabs.indexOf(id);
				if (index === -1) return tabs;
				const next = tabs.filter((tab) => tab !== id);
				setTabStates((states) => {
					const copy = new Map(states);
					copy.delete(id);
					return copy;
				});
				if (id === selectedIdRef.current) {
					const nextActive = next[Math.min(index, next.length - 1)];
					const nextArtifact = nextActive ? artifacts.find((item) => item.id === nextActive) : void 0;
					if (nextArtifact) {
						selectedIdRef.current = nextArtifact.id;
						selectedIdentityRef.current = artifactIdentity(nextArtifact);
						setSelectedId(nextArtifact.id);
						const cached = tabStates.get(nextArtifact.id);
						setDetail(cached?.descriptor);
						setDetailStatus(cached?.status ?? "idle");
						setMessage(cached?.message);
					} else {
						selectedIdRef.current = void 0;
						selectedIdentityRef.current = "";
						setSelectedId(void 0);
						setDetail(void 0);
						setDetailStatus("idle");
						setMessage(void 0);
					}
				}
				return next;
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
				setDownload({
					status: "unsupported",
					message: t("artifacts.downloadUnsupported")
				});
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
				name: result.downloadName,
				message: result.message
			});
			if (result.status === "ready" && result.url && result.downloadName && typeof document !== "undefined") {
				const anchor = document.createElement("a");
				anchor.href = result.url;
				anchor.download = result.downloadName;
				anchor.click();
			}
		};
		const groupList = (group, groupIndex) => {
			const category = categoryOrder[groupIndex];
			return createElement("section", {
				key: category,
				"data-dsh-workspace": "artifact-group",
				"aria-label": `${categoryLabels[category]()} ${t("artifacts.title").toLowerCase()}`
			}, createElement("div", { "data-dsh-workspace": "artifact-group-header" }, createElement("h4", null, categoryLabels[category]()), createElement("span", {
				"data-dsh-workspace": "count-badge",
				"data-dsw-variant": "neutral"
			}, String(group.length))), createElement("ul", { "data-dsh-workspace": "artifact-list" }, group.map((artifact) => createElement("li", {
				key: artifact.id,
				"data-dsh-workspace": "artifact-item",
				"data-selected": String(artifact.id === selectedId)
			}, createElement("span", {
				"aria-hidden": "true",
				"data-dsh-workspace": "artifact-type-badge"
			}, artifactTypeBadge(artifact)), createElement("button", {
				ref: artifact.id === selectedId ? selectedButton : void 0,
				type: "button",
				"data-dsh-workspace": "artifact-select",
				"aria-pressed": artifact.id === selectedId,
				onClick: () => select(artifact)
			}, artifact.name), createElement("span", {
				"data-dsh-workspace": "artifact-meta",
				"aria-label": `${artifact.mediaType}, ${formatSize(artifact.sizeBytes)}, ${artifact.preview}`
			}, `${formatSize(artifact.sizeBytes)} · ${artifact.preview}`), createElement("span", {
				"aria-hidden": "true",
				"data-dsh-workspace": "artifact-status-chip",
				"data-status": artifactStatus(artifact)
			}, artifactStatus(artifact))))));
		};
		const filtered = query.trim() ? artifacts.filter((artifact) => artifact.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : artifacts;
		const filteredGroups = artifactGroups(filtered);
		const artifactDetail = selected && detail ? createElement("article", {
			"aria-label": `${selected.name} preview`,
			"data-dsh-workspace": "artifact-detail"
		}, createElement("h3", null, selected.name), createElement("p", {
			"aria-label": t("artifacts.provenance"),
			"data-dsh-workspace": "artifact-provenance"
		}, `${t("artifacts.source")} ${selected.source.kind} · session ${selected.source.sessionId} · workspace ${selected.source.workspaceId}`), createWorkspacePreviewRenderer(primitives, detail, {
			resourcePath: options.resourcePath,
			downloadName: selected.downloadName,
			altText: selected.altText
		}), createElement("div", { role: "group" }, selected.resourceId && createElement("button", {
			type: "button",
			onClick: () => {
				downloadArtifact();
			}
		}, download.status === "loading" ? t("downloading") : t("download")), download.status === "loading" && createElement("button", {
			type: "button",
			onClick: () => downloadController.current?.cancel()
		}, t("cancelDownload"))), download.message && createElement("p", { role: "status" }, download.message), download.status === "ready" && createElement("p", { role: "status" }, t("downloadStarted")), message && createElement("p", { role: "status" }, message)) : selected && !detail && detailStatus === "loading" ? createElement("p", { role: "status" }, t("artifacts.loadingPreview")) : selected && !detail && detailStatus !== "loading" && message ? createElement("p", { role: "status" }, message) : workspaceEmptyState(t("artifacts.selectHint"));
		const tablistRef = useRef(null);
		const onTablistKeyDown = (event) => {
			if (!event.target?.closest?.("[data-dsh-workspace='artifact-tab']")) return;
			const tabs = openTabs;
			if (tabs.length < 2) return;
			const current = tabs.indexOf(selectedId ?? "");
			const index = current === -1 ? 0 : current;
			let next = index;
			if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
			else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
			else if (event.key === "Home") next = 0;
			else if (event.key === "End") next = tabs.length - 1;
			else return;
			event.preventDefault();
			const artifact = artifacts.find((item) => item.id === tabs[next]);
			if (artifact) select(artifact);
		};
		const tabStrip = openTabs.length >= 1 ? createElement("div", {
			ref: tablistRef,
			role: "tablist",
			"aria-label": t("artifacts.title"),
			"data-dsh-workspace": "artifact-tabs",
			onKeyDown: onTablistKeyDown
		}, openTabs.map((id) => {
			const artifact = artifacts.find((item) => item.id === id);
			if (!artifact) return null;
			const active = id === selectedId;
			return createElement("div", {
				key: id,
				role: "tab",
				"aria-selected": String(active),
				"data-dsh-workspace": "artifact-tab",
				"data-active": String(active),
				tabIndex: active ? 0 : -1
			}, createElement("button", {
				type: "button",
				"data-dsh-workspace": "artifact-tab-select",
				"aria-pressed": active,
				onClick: () => select(artifact)
			}, artifact.name), createElement("button", {
				type: "button",
				"data-dsh-workspace": "artifact-tab-close",
				"aria-label": `${t("cancel")} ${artifact.name}`,
				onClick: () => closeTab(id)
			}, "×"));
		})) : null;
		const body = status === "loading" ? createElement("p", { role: "status" }, t("artifacts.loading")) : status === "degraded" ? workspaceNotice("error", message ?? t("artifacts.unavailable")) : createElement("div", { "data-dsh-workspace": "artifact-surface" }, workspaceSurfaceHeader({
			title: t("artifacts.title"),
			count: workspaceCountBadge(`${artifacts.length} ${artifacts.length === 1 ? t("artifacts.countOne") : t("artifacts.count")}`),
			actions: createElement("button", {
				type: "button",
				onClick: () => setRefreshTick((tick) => tick + 1)
			}, t("refresh"))
		}), createElement("div", { "data-dsh-workspace": "surface-toolbar" }, createElement("form", {
			role: "search",
			onSubmit: (event) => event.preventDefault(),
			"aria-label": t("artifacts.searchLabel")
		}, createElement("label", null, `${t("artifacts.searchLabel")} `, createElement("input", {
			type: "search",
			placeholder: t("artifacts.searchPlaceholder"),
			value: query,
			"aria-label": t("artifacts.searchLabel"),
			onChange: (event) => setQuery(event.target.value)
		}))), skipped > 0 && createElement("span", {
			"data-dsh-workspace": "status-chip",
			"data-status": "stale"
		}, `${skipped} ${t("artifacts.hiddenSkipped")}`)), artifacts.length === 0 && workspaceEmptyState(t("artifacts.empty")), artifacts.length > 0 && workspaceListDetail(filtered.length === 0 ? workspaceEmptyState(t("artifacts.noMatch")) : filteredGroups.map((group, groupIndex) => group.length === 0 ? null : groupList(group, groupIndex)), createElement("div", { "data-dsh-workspace": "artifact-detail-column" }, tabStrip, artifactDetail)));
		if (!sessionId) return createElement("section", {
			"data-dsh-workspace": "artifacts",
			role: "region",
			"aria-label": t("artifacts.title")
		}, createElement("h2", null, t("artifacts.title")), createElement("p", { role: "status" }, t("artifacts.requireSession")));
		return createElement("section", {
			"data-dsh-workspace": "artifacts",
			role: "region",
			"aria-label": t("artifacts.title")
		}, createElement("h2", null, t("artifacts.title")), body);
	};
}
function workspaceArtifactResourceUrl(artifact) {
	return buildWorkspaceResourceUrl(artifact);
}
//#endregion
//#region packages/plugin/src/web/workspace-memory-surface.ts
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
	return unwrapRemote(result);
}
function errorMessage(error, fallback = t("memory.operationFailed")) {
	return remoteErrorMessage(error, fallback);
}
function scopeLabel(scope) {
	return scope === "shared-project" ? t("memory.scope.sharedProject") : t(`memory.scope.${scope}`);
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
		const [forgetPending, setForgetPending] = useState(false);
		const [status, setStatus] = useState("loading");
		const [message, setMessage] = useState();
		const requestToken = useRef(0);
		const searchTimer = useRef(void 0);
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
				setMessage(t("memory.unavailable"));
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
				setMessage(opened.readOnly ? t("memory.newerSchema") : opened.warnings.length ? `${opened.warnings.length} ${t("memory.warnings")}` : void 0);
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
		const markedUsed = useRef(void 0);
		useEffect(() => {
			if (!remote?.memoryMarkUsed || !selected || state?.readOnly) return;
			if (markedUsed.current === selected.id) return;
			markedUsed.current = selected.id;
			remote.memoryMarkUsed(request, selected.id).catch(() => {});
		}, [
			remote,
			selectedId,
			state?.readOnly
		]);
		const closeRequest = useRef(void 0);
		useEffect(() => {
			const previous = closeRequest.current;
			closeRequest.current = {
				remote,
				request
			};
			if (previous && previous.remote !== remote && previous.remote?.memoryClose) previous.remote.memoryClose(previous.request).catch(() => {});
			return () => {
				if (remote?.memoryClose && closeRequest.current?.remote === remote) {
					remote.memoryClose(closeRequest.current.request).catch(() => {});
					closeRequest.current = void 0;
				}
			};
		}, [remote]);
		const save = async () => {
			if (!remote || !state) return;
			try {
				if (!writesAllowed) {
					setMessage(t("memory.sharedWriteAck"));
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
				setMessage(t("memory.saved"));
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const mutate = async (operation) => {
			if (!remote || !selected) return;
			if (!writesAllowed) {
				setMessage(t("memory.sharedWriteAck"));
				return;
			}
			try {
				valueOf(await remote.memoryGovern(request, selected.id, operation, selectedGovernance?.revision ?? 1, selected.contentHash));
				setSelectedId(void 0);
				setTitle("");
				setContent("");
				await load("");
				if (operation === "forget") setTimeout(() => scopeFirstButton.current?.focus(), 0);
				const labels = {
					archive: t("memory.archived"),
					forget: t("memory.forgotten"),
					verify: t("memory.verified"),
					reverify: t("memory.reverified"),
					pin: t("memory.pinned"),
					unpin: t("memory.unpinned"),
					restore: t("memory.restored"),
					reject: t("memory.rejected")
				};
				setMessage(`${t("memory.title")} ${labels[operation]} ${t("memory.locally")}`);
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
				setMessage(t("memory.keptVersion"));
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
				setMessage(t("memory.exportReady", { bytes: serialized.length }));
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const importMemory = async (event) => {
			const file = event.target.files?.[0];
			if (!remote || !file) return;
			try {
				if (!writesAllowed) throw new Error(t("memory.sharedWriteAck"));
				if (file.size !== void 0 && file.size > 8388608) throw new Error(t("memory.importSizeLimit"));
				const imported = valueOf(await remote.memoryImport(request, await file.text()));
				await load("");
				setMessage(t("memory.imported", { count: imported.length }));
			} catch (error) {
				setMessage(errorMessage(error));
			}
		};
		const scopeButtons = createElement("div", {
			"data-dsw-segment": "true",
			role: "group",
			"aria-label": t("memory.scope")
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
		const recordList = createElement("ul", {
			"aria-label": t("memory.records"),
			"data-dsh-workspace": "memory-list"
		}, records.map((record) => {
			const governance = displayGovernance(record);
			return createElement("li", {
				key: record.id,
				"data-dsh-workspace": "memory-card",
				"data-selected": String(record.id === selectedId)
			}, createElement("div", { "data-dsh-workspace": "memory-card-header" }, createElement("span", {
				"aria-hidden": "true",
				"data-dsh-workspace": "memory-badge"
			}, record.type), createElement("span", {
				"aria-hidden": "true",
				"data-dsh-workspace": "memory-badge",
				"data-dsh-workspace-verification": governance.verification
			}, governance.verification), governance.origin === "model-suggested" && createElement("span", {
				"aria-hidden": "true",
				"data-dsh-workspace": "memory-badge",
				"data-dsh-workspace-proposal": "true"
			}, t("memory.proposal")), createElement("button", {
				ref: record.id === selectedId ? selectedButton : void 0,
				type: "button",
				"data-dsh-workspace": "memory-select",
				"aria-pressed": record.id === selectedId,
				onClick: () => setSelectedId(record.id)
			}, record.title)), createElement("span", { "data-dsh-workspace": "memory-meta" }, `${workspaceMemoryRecordSummary(record)}${record.status !== "active" ? ` · ${record.status}` : ""}`), createElement("span", { "data-dsh-workspace": "memory-preview" }, record.content.slice(0, 96)));
		}));
		const editor = createElement("details", { "data-dsh-workspace": "memory-editor" }, createElement("summary", null, selected ? `${t("memory.edit")} ${selected.title}` : t("memory.create")), createElement("form", {
			onSubmit: (event) => {
				event.preventDefault();
				save();
			},
			"aria-label": selected ? t("memory.edit") : t("memory.create")
		}, createElement("label", null, `${t("memory.titleField")} `, createElement("input", {
			value: title,
			maxLength: 256,
			onChange: (event) => setTitle(event.target.value)
		})), createElement("label", null, `${t("memory.typeField")} `, createElement("select", {
			value: type,
			onChange: (event) => setType(event.target.value)
		}, workspaceMemoryTypes.map((value) => createElement("option", {
			key: value,
			value
		}, value)))), createElement("label", null, `${t("memory.contentField")} `, createElement("textarea", {
			value: content,
			maxLength: 65536,
			onChange: (event) => setContent(event.target.value)
		})), createElement("div", { "data-dsw-editor-actions": "true" }, createElement("button", {
			type: "submit",
			"data-dsw-primary": "true",
			disabled: !state || state.readOnly || !writesAllowed
		}, selected ? t("memory.saveChanges") : t("memory.save")), selected && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("archive")
		}, t("memory.archive")), selected && createElement("button", {
			ref: forgetTrigger,
			type: "button",
			disabled: !writesAllowed,
			onClick: () => setForgetPending(true)
		}, t("memory.forget")), selected?.status === "archived" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("restore")
		}, t("memory.restore")), selectedGovernance?.verification === "unverified" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("verify")
		}, t("memory.verify")), selectedGovernance?.verification === "unverified" && hasConflict && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("reject")
		}, t("memory.reject")), selectedGovernance?.verification === "stale" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate("reverify")
		}, t("memory.reverify")), selectedGovernance?.verification === "verified" && createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void mutate(selectedGovernance.pinnedAt === void 0 ? "pin" : "unpin")
		}, selectedGovernance.pinnedAt === void 0 ? t("memory.pin") : t("memory.unpin")))));
		const body = status === "loading" ? createElement("p", { role: "status" }, t("memory.loading")) : status === "degraded" ? workspaceNotice("error", message ?? t("memory.unavailable")) : createElement("div", { "data-dsh-workspace": "memory-surface" }, createElement("div", { "data-dsh-workspace": "memory-toolbar" }, createElement("div", { "data-dsw-row": "true" }, scopeButtons, scope === "shared-project" && createElement("label", null, createElement("input", {
			type: "checkbox",
			checked: sharedWriteAcknowledged,
			onChange: (event) => setSharedWriteAcknowledged(event.target.checked)
		}), t("memory.ackSharedWrite")), scope === "user" && createElement("label", null, `${t("memory.userProfile")} `, createElement("input", {
			value: userId,
			onChange: (event) => setUserId(event.target.value),
			"aria-label": t("memory.userProfile")
		}))), createElement("div", { "data-dsw-row": "true" }, createElement("form", { onSubmit: (event) => {
			event.preventDefault();
			if (searchTimer.current) clearTimeout(searchTimer.current);
			load(query);
		} }, createElement("label", null, `${t("memory.searchLabel")} `, createElement("input", {
			value: query,
			onChange: (event) => {
				setQuery(event.target.value);
				if (searchTimer.current) clearTimeout(searchTimer.current);
				searchTimer.current = setTimeout(() => {
					load(event.target.value);
				}, 250);
			},
			"aria-label": t("memory.searchLabel")
		})), createElement("button", { type: "submit" }, t("search"))), createElement("label", null, `${t("memory.typeFilter")} `, createElement("select", {
			value: filterType,
			onChange: (event) => setFilterType(event.target.value),
			"aria-label": t("memory.typeFilter")
		}, createElement("option", { value: "" }, t("memory.allTypes")), workspaceMemoryTypes.map((value) => createElement("option", {
			key: value,
			value
		}, value)))), createElement("label", null, `${t("memory.statusFilter")} `, createElement("select", {
			value: statusFilter,
			onChange: (event) => setStatusFilter(event.target.value),
			"aria-label": t("memory.statusFilter")
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
		}, t("memory.export")), createElement("label", null, `${t("memory.import")} `, createElement("input", {
			type: "file",
			disabled: !writesAllowed,
			accept: "application/json,.json,.jsonl",
			onChange: (event) => void importMemory(event)
		})))), createElement("header", { "data-dsh-workspace": "surface-header" }, createElement("div", { "data-dsh-workspace": "surface-title" }, createElement("h3", null, t("memory.title")), workspaceCountBadge(`${records.length} ${records.length === 1 ? t("memory.recordOne") : t("memory.records")}`))), workspaceListDetail(records.length === 0 ? workspaceEmptyState(t("memory.empty")) : recordList, createElement("div", { "data-dsh-workspace": "memory-detail-column" }, selected && selectedGovernance && createElement("dl", {
			"aria-label": t("memory.governance"),
			"data-dsh-workspace": "memory-governance"
		}, createElement("dt", null, t("memory.origin")), createElement("dd", null, selectedGovernance.origin), createElement("dt", null, t("memory.verification")), createElement("dd", null, selectedGovernance.verification), createElement("dt", null, t("memory.retention")), createElement("dd", null, selectedGovernance.retention), createElement("dt", null, t("memory.revision")), createElement("dd", null, String(selectedGovernance.revision)), createElement("dt", null, t("memory.sources")), createElement("dd", null, selectedGovernance.sourceRefs.map((source) => `${source.kind}/${source.id}`).join(", ") || t("memory.none")), selectedGovernance.conflictGroup && createElement("dt", null, t("memory.conflictGroup")), selectedGovernance.conflictGroup && createElement("dd", null, selectedGovernance.conflictGroup), selectedGovernance.expiresAt !== void 0 && createElement("dt", null, t("memory.expires")), selectedGovernance.expiresAt !== void 0 && createElement("dd", null, String(selectedGovernance.expiresAt))), hasConflict && createElement("p", { role: "status" }, t("memory.conflictHint")), hasConflict && createElement("aside", {
			"aria-label": t("memory.conflictTitle"),
			"data-dsh-workspace": "memory-conflict"
		}, createElement("h3", null, t("memory.conflictTitle")), createElement("button", {
			type: "button",
			disabled: !writesAllowed,
			onClick: () => void resolveConflict()
		}, t("memory.keepVersion")), createElement("div", { "data-dsh-workspace": "memory-conflict-columns" }, [selected, ...conflictingRecords].map((record) => {
			const keep = record.id === selectedId;
			const governance = displayGovernance(record);
			return createElement("section", {
				key: record.id,
				"data-dsw-version": keep ? "keep" : "conflict",
				"aria-label": `Version ${record.contentHash.slice(0, 8)}`
			}, createElement("div", { "data-dsh-workspace": "surface-header" }, createElement("div", { "data-dsh-workspace": "surface-title" }, createElement("h4", null, keep ? t("memory.selected") : t("memory.conflict")), createElement("span", {
				"data-dsh-workspace": "status-chip",
				"data-status": governance.verification === "verified" ? "verified" : "unverified"
			}, governance.verification))), createElement("button", {
				type: "button",
				onClick: () => setSelectedId(record.id)
			}, `${t("memory.review")} · rev ${governance.revision} · ${record.contentHash.slice(0, 15)}`), createElement("pre", null, record.content.slice(0, 512)));
		}))), editor, createElement("p", { role: "status" }, state?.readOnly ? t("memory.readOnly") : t("memory.reviewOnly")), message && createElement("p", { role: "status" }, message))));
		const confirmation = forgetPending && selected && createElement("div", {
			role: "alertdialog",
			"aria-modal": "true",
			"aria-labelledby": "memory-forget-title",
			"aria-describedby": "memory-forget-description"
		}, createElement("h3", { id: "memory-forget-title" }, t("memory.forgetTitle")), createElement("p", { id: "memory-forget-description" }, t("memory.forgetDescription", { scope: scopeLabel(selected.scope) })), createElement("button", {
			ref: confirmButton,
			type: "button",
			onClick: () => {
				setForgetPending(false);
				mutate("forget");
			}
		}, t("memory.forgetRecord")), createElement("button", {
			type: "button",
			onClick: () => {
				setForgetPending(false);
				forgetTrigger.current?.focus();
			}
		}, t("cancel")));
		if (!sessionId) return createElement("section", {
			role: "region",
			"aria-label": t("memory.title"),
			"data-dsh-workspace": "memory"
		}, createElement("h2", null, t("memory.title")), createElement("p", { role: "status" }, t("memory.requireSession")));
		return createElement("section", {
			role: "region",
			"aria-label": t("memory.title"),
			"data-dsh-workspace": "memory"
		}, createElement("h2", null, t("memory.title")), body, confirmation);
	};
}
/**
* Stable, dependency-free string hash (FNV-1a). Used to anchor expander rows
* to the hunk they precede so collapse state survives re-parses and refreshes.
*/
function hunkAnchor(text) {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
/**
* Turn parsed diff lines into render rows with inter-hunk context collapsing.
*
* A *gap* is the span between two change blocks: the trailing context of the
* previous block, the following hunk header, and the leading context of the
* next block. Gaps that follow a change block and contain a hunk header keep up
* to `contextLines` lines of context on EACH side (default 3, git's default
* context), then hide the *middle* — the hunk header plus any leading context
* beyond the budget — behind an `expander` row. Expanding reveals the middle
* incrementally. For a standard 7-unit gap (3 ctx + @@ + 3 ctx) the middle is
* just the hunk header, so the expander reads "Show 1 hidden line" and acts as
* a hunk-boundary marker; larger gaps hide proportionally more. Leading context
* of a file's first hunk and trailing context at the end are never collapsed
* (they don't follow a change block). Pure and bounded: it only reorders or
* reduces the parsed lines it is given.
*/
function buildDiffRows(parsed, revealed, options = {}) {
	const contextLines = Math.max(0, options.contextLines ?? 3);
	const rows = [];
	const trailing = [];
	const leading = [];
	let gapHunk = "";
	let afterChange = false;
	const flushGap = () => {
		if (trailing.length === 0 && gapHunk === "" && leading.length === 0) return;
		const keptTrailing = Math.min(contextLines, trailing.length);
		const keptLeading = Math.min(contextLines, leading.length);
		const middle = [];
		if (gapHunk !== "") middle.push({
			kind: "hunk",
			text: gapHunk
		});
		for (let index = 0; index < leading.length - keptLeading; index += 1) middle.push(leading[index]);
		const middleTotal = middle.length;
		const collapsible = afterChange && gapHunk !== "" && middleTotal > 0 && (trailing.length > 0 || leading.length > 0);
		for (let index = 0; index < keptTrailing; index += 1) rows.push(trailing[index]);
		if (collapsible) {
			const anchor = hunkAnchor(gapHunk);
			const midShown = Math.min(middleTotal, revealed.get(anchor) ?? 0);
			for (let index = 0; index < midShown; index += 1) rows.push(middle[index]);
			if (midShown < middleTotal) rows.push({
				kind: "expander",
				anchor,
				revealed: midShown,
				hidden: middleTotal - midShown,
				total: middleTotal
			});
		} else for (const line of middle) rows.push(line);
		for (let index = leading.length - keptLeading; index < leading.length; index += 1) rows.push(leading[index]);
		trailing.length = 0;
		leading.length = 0;
		gapHunk = "";
		afterChange = false;
	};
	for (const line of parsed) {
		if (line.kind === "context") {
			if (gapHunk === "") trailing.push(line);
			else leading.push(line);
			continue;
		}
		if (line.kind === "hunk") {
			if (gapHunk !== "" && trailing.length === 0 && leading.length === 0) {
				rows.push({
					kind: "hunk",
					text: gapHunk
				});
				gapHunk = "";
				afterChange = false;
			}
			gapHunk = line.text;
			continue;
		}
		flushGap();
		rows.push(line);
		afterChange = true;
		if (line.kind === "header") afterChange = false;
	}
	flushGap();
	return rows;
}
const DEFAULT_MAX_LINE_LENGTH = 512;
const DEFAULT_MAX_LINE_COUNT = 4e3;
/** Split into whitespace and non-whitespace runs so the word-level diff is granular. */
function tokenizeWords(value) {
	return value.match(/\s+|[^\s]+/gu) ?? [];
}
/** LCS alignment over two token arrays; marks which tokens are shared. */
function alignTokens(a, b) {
	const n = a.length;
	const m = b.length;
	const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
	const aCommon = new Array(n).fill(false);
	const bCommon = new Array(m).fill(false);
	let i = 0;
	let j = 0;
	while (i < n && j < m) if (a[i] === b[j]) {
		aCommon[i] = true;
		bCommon[j] = true;
		i += 1;
		j += 1;
	} else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
	else j += 1;
	return {
		aCommon,
		bCommon
	};
}
/** Word-level diff of one removed line against one added line. */
function diffLineWords(removed, added) {
	const a = tokenizeWords(removed);
	const b = tokenizeWords(added);
	const { aCommon, bCommon } = alignTokens(a, b);
	return {
		removedTokens: a.map((text, index) => ({
			kind: aCommon[index] ? "equal" : "removed",
			text
		})),
		addedTokens: b.map((text, index) => ({
			kind: bCommon[index] ? "equal" : "added",
			text
		}))
	};
}
/**
* Pair two sequences positionally, padding with `null` on the shorter side.
* Shared by the intra-line word diff (removes vs adds) and the split-view
* renderer (old column vs new column) so the pairing shape lives in one place.
*/
function pairByIndex(left, right) {
	const count = Math.max(left.length, right.length);
	const pairs = [];
	for (let index = 0; index < count; index += 1) pairs.push([left[index] ?? null, right[index] ?? null]);
	return pairs;
}
function isChangedLine(line) {
	return line.kind === "add" || line.kind === "remove";
}
/**
* Parse a unified diff into colored line groups with running line numbers and
* (when the Operational Budget allows) intra-line token segments for changed
* lines. Pure and bounded: it only inspects the text it is given, so the Web
* surface can render readable add/remove/context lines without another dependency.
*/
function parseUnifiedDiff(diffText, options = {}) {
	const maxLineLength = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;
	const maxLineCount = options.maxLineCount ?? DEFAULT_MAX_LINE_COUNT;
	const lines = [];
	let insertions = 0;
	let deletions = 0;
	let oldLine = 0;
	let newLine = 0;
	for (const raw of String(diffText ?? "").split("\n")) {
		if (raw === "") continue;
		if (raw.startsWith("---") || raw.startsWith("+++")) {
			lines.push({
				kind: "header",
				text: raw
			});
			continue;
		}
		if (raw.startsWith("@@")) {
			const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(raw);
			oldLine = match ? Number(match[1]) : 0;
			newLine = match ? Number(match[2]) : 0;
			lines.push({
				kind: "hunk",
				text: raw
			});
			continue;
		}
		const marker = raw[0];
		if (marker === "+") {
			const content = raw.slice(1);
			lines.push({
				kind: "add",
				text: raw,
				content,
				newLine
			});
			newLine += 1;
			insertions += 1;
			continue;
		}
		if (marker === "-") {
			const content = raw.slice(1);
			lines.push({
				kind: "remove",
				text: raw,
				content,
				oldLine
			});
			oldLine += 1;
			deletions += 1;
			continue;
		}
		if (marker === " ") {
			lines.push({
				kind: "context",
				text: raw,
				content: raw.slice(1),
				oldLine,
				newLine
			});
			oldLine += 1;
			newLine += 1;
			continue;
		}
		lines.push({
			kind: "header",
			text: raw
		});
	}
	const intraLine = lines.length <= maxLineCount && lines.every((line) => !isChangedLine(line) || (line.content?.length ?? 0) <= maxLineLength);
	if (intraLine) {
		let blockRemoves = [];
		let blockAdds = [];
		const flush = () => {
			for (const [removedIndex, addedIndex] of pairByIndex(blockRemoves, blockAdds)) {
				const removed = removedIndex !== null ? lines[removedIndex] : void 0;
				const added = addedIndex !== null ? lines[addedIndex] : void 0;
				if (removed && added) {
					const { removedTokens, addedTokens } = diffLineWords(removed.content ?? "", added.content ?? "");
					removed.tokens = removedTokens;
					added.tokens = addedTokens;
				} else if (removed) removed.tokens = [{
					kind: "removed",
					text: removed.content ?? ""
				}];
				else if (added) added.tokens = [{
					kind: "added",
					text: added.content ?? ""
				}];
			}
			blockRemoves = [];
			blockAdds = [];
		};
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			if (line.kind === "remove") blockRemoves.push(index);
			else if (line.kind === "add") blockAdds.push(index);
			else flush();
		}
		flush();
	}
	return {
		lines,
		insertions,
		deletions,
		intraLine
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-changes-surface.ts
const statusLabels = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
	copied: "C",
	untracked: "??",
	typechange: "T",
	unmerged: "U"
};
const filterLabels = [
	{
		key: "all",
		label: () => t("changes.filter.all")
	},
	{
		key: "added",
		label: () => t("changes.filter.added")
	},
	{
		key: "modified",
		label: () => t("changes.filter.modified")
	},
	{
		key: "deleted",
		label: () => t("changes.filter.deleted")
	},
	{
		key: "untracked",
		label: () => t("changes.filter.untracked")
	},
	{
		key: "staged",
		label: () => t("changes.filter.staged")
	}
];
/** Session-scoped view-mode preference, remembered per carrier (never written to durable Memory). */
const modeStore = /* @__PURE__ */ new Map();
function matchesFilter(change, filter) {
	switch (filter) {
		case "all": return true;
		case "staged": return change.staged;
		case "added": return change.status === "added";
		case "modified": return change.status === "modified";
		case "deleted": return change.status === "deleted";
		case "untracked": return change.status === "untracked";
	}
}
function statusText(status, staged) {
	const label = statusLabels[status];
	if (status === "untracked") return t("changes.status.untracked");
	return `${staged ? t("changes.status.index") : t("changes.status.worktree")} ${label}`;
}
function renderDiffContent(line) {
	if ((line.kind === "add" || line.kind === "remove") && line.tokens && line.tokens.length > 0) return line.tokens.map((token, index) => createElement("span", {
		key: index,
		"data-dsh-workspace": "diff-token",
		"data-token": token.kind
	}, token.text));
	return line.text;
}
/** Old/new line numbers plus the (token-aware) line text — the shared cell body. */
function diffLineCells(line) {
	return [
		createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.oldLine !== void 0 ? String(line.oldLine) : ""),
		createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.newLine !== void 0 ? String(line.newLine) : ""),
		createElement("span", { "data-dsh-workspace": "diff-line-text" }, renderDiffContent(line))
	];
}
function expanderRow(row, onExpand, key) {
	return createElement("div", {
		key,
		"data-dsh-workspace": "diff-expander",
		"data-anchor": row.anchor
	}, createElement("button", {
		type: "button",
		onClick: () => onExpand(row.anchor, row.total, row.revealed)
	}, `Show ${row.hidden} ${row.hidden === 1 ? t("changes.hiddenLine", { count: row.hidden }) : t("changes.hiddenLines", { count: row.hidden })}`));
}
function unifiedRows(rows, onExpand) {
	return createElement("div", { "data-dsh-workspace": "diff-lines" }, rows.map((row, index) => row.kind === "expander" ? expanderRow(row, onExpand, index) : createElement("div", {
		key: index,
		"data-dsh-workspace": "diff-code-line",
		"data-kind": row.kind
	}, diffLineCells(row))));
}
/**
* Pair slots only ever receive add/remove/context lines (expanders and hunks
* go full-width), so narrowing from `DiffRow` to `DiffLine` is safe here.
*/
function asDiffLine(row) {
	return row;
}
/** Pair removes with adds positionally within each change block for split view. */
function splitRows(rows) {
	const items = [];
	let block = [];
	const flushBlock = () => {
		if (block.length === 0) return;
		const removes = block.filter((row) => row.kind === "remove");
		const adds = block.filter((row) => row.kind === "add");
		for (const [removed, added] of pairByIndex(removes, adds)) items.push({
			kind: "pair",
			old: removed ? asDiffLine(removed) : null,
			new: added ? asDiffLine(added) : null
		});
		block = [];
	};
	for (const row of rows) {
		if (row.kind === "add" || row.kind === "remove") {
			block.push(row);
			continue;
		}
		flushBlock();
		if (row.kind === "context") items.push({
			kind: "pair",
			old: asDiffLine(row),
			new: asDiffLine(row)
		});
		else items.push({
			kind: "full",
			row
		});
	}
	flushBlock();
	return items;
}
function splitCells(item, onExpand, key) {
	if (item.kind === "full") {
		const row = item.row;
		if (row.kind === "expander") return expanderRow(row, onExpand, key);
		return createElement("div", {
			key,
			"data-dsh-workspace": "diff-code-line",
			"data-kind": row.kind,
			"data-split": "full"
		}, createElement("div", {
			"data-dsh-workspace": "diff-cell",
			"data-side": "old",
			"data-kind": row.kind
		}, diffLineCells(row)));
	}
	const oldLine = item.old;
	const newLine = item.new;
	return createElement("div", {
		key,
		"data-dsh-workspace": "diff-code-line",
		"data-kind": oldLine && newLine ? "pair" : oldLine ? "remove" : "add",
		"data-split": "true"
	}, createElement("div", {
		"data-dsh-workspace": "diff-cell",
		"data-side": "old",
		...oldLine ? { "data-kind": oldLine.kind } : { "data-empty": "true" }
	}, oldLine ? diffLineCells(oldLine) : createElement("span", null, "")), createElement("div", {
		"data-dsh-workspace": "diff-cell",
		"data-side": "new",
		...newLine ? { "data-kind": newLine.kind } : { "data-empty": "true" }
	}, newLine ? diffLineCells(newLine) : createElement("span", null, "")));
}
function splitRowsNode(rows, onExpand) {
	return createElement("div", { "data-dsh-workspace": "diff-split" }, splitRows(rows).map((item, index) => splitCells(item, onExpand, index)));
}
/** One change row (badge + select button + meta), shared by every group. */
function changeRow(change, state) {
	return createElement("li", {
		key: `${change.staged ? "i" : "w"}:${change.path}`,
		"data-dsh-workspace": "change-item",
		"data-selected": String(change.path === state.selectedPath),
		"data-status": change.status
	}, createElement("span", {
		"aria-hidden": "true",
		"data-dsh-workspace": "change-status-badge",
		"data-status": change.status
	}, statusLabels[change.status]), createElement("button", {
		ref: change.path === state.selectedPath ? state.selectedButton : void 0,
		type: "button",
		"data-dsh-workspace": "change-select",
		"aria-pressed": change.path === state.selectedPath,
		onClick: () => state.select(change.path)
	}, change.path), createElement("span", { "data-dsh-workspace": "change-meta" }, `${statusText(change.status, change.staged)}${change.previousPath ? ` (from ${change.previousPath})` : ""}`));
}
/** One grouped section (Staged / Unstaged / Untracked) with a header and rows. */
function changeGroupSection(label, rows, state) {
	if (rows.length === 0) return null;
	return createElement("section", {
		key: label,
		"data-dsh-workspace": "change-group",
		"aria-label": label
	}, createElement("h4", { "data-dsh-workspace": "change-group-title" }, label), createElement("ul", { "data-dsh-workspace": "changes-list" }, rows.map((change) => changeRow(change, state))));
}
/**
* Render the visible changes grouped by Staged / Unstaged / Untracked
* (dsh-web-ui ScmPanel grouping, read-only adaptation — ADR #115). When a
* non-"all" filter is active, only the matching group(s) are shown.
*/
function changeGroups(visible, filter, state) {
	const staged = visible.filter((change) => change.staged);
	const untracked = visible.filter((change) => !change.staged && change.status === "untracked");
	const unstaged = visible.filter((change) => !change.staged && change.status !== "untracked");
	if (filter === "staged") return changeGroupSection(t("changes.group.staged"), staged, state) ?? workspaceEmptyState(t("changes.noFiltered", { filter: t("changes.filter.staged").toLowerCase() }));
	if (filter === "untracked") return changeGroupSection(t("changes.group.untracked"), untracked, state) ?? workspaceEmptyState(t("changes.noFiltered", { filter: t("changes.filter.untracked").toLowerCase() }));
	return createElement("div", { "data-dsh-workspace": "change-groups" }, changeGroupSection(t("changes.group.staged"), staged, state), changeGroupSection(t("changes.group.unstaged"), unstaged, state), changeGroupSection(t("changes.group.untracked"), untracked, state));
}
/** Read-only Changes view: git status list + readable unified diff preview. */
function createWorkspaceChangesSurfaceComponent(remote, options = {}) {
	return function WorkspaceChangesSurface(props) {
		const useSessions = props.useSessions;
		const sessionId = useSessions?.((state) => state.current);
		const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
		const carrier = options.carrier ?? "tab";
		const [status, setStatus] = useState("loading");
		const [changes, setChanges] = useState([]);
		const [selectedPath, setSelectedPath] = useState();
		const [diff, setDiff] = useState();
		const [diffStatus, setDiffStatus] = useState("idle");
		const [filter, setFilter] = useState("all");
		const [refreshTick, setRefreshTick] = useState(0);
		const [diffTick, setDiffTick] = useState(0);
		const [message, setMessage] = useState();
		const [revealed, setRevealed] = useState(/* @__PURE__ */ new Map());
		const [fileCollapsed, setFileCollapsed] = useState(false);
		const [width, setWidth] = useState(options.carrierWidth);
		const [modeOverride, setModeOverride] = useState(() => modeStore.get(carrier));
		const [pendingDiff, setPendingDiff] = useState();
		const [stale, setStale] = useState(false);
		const request = useRef(0);
		const selectedButton = useRef(null);
		const lastPathRef = useRef();
		const renderedRef = useRef();
		const detailRef = useRef(null);
		useEffect(() => {
			let active = true;
			if (!activeRemote) {
				setStatus("degraded");
				setMessage(t("changes.unavailable"));
				return () => {
					active = false;
				};
			}
			if (!sessionId) {
				setStatus("degraded");
				return () => {
					active = false;
				};
			}
			const load = async () => {
				const token = ++request.current;
				try {
					const value = unwrapRemote(await activeRemote.gitStatus());
					if (!active || token !== request.current) return;
					setChanges(value);
					setSelectedPath((current) => current && value.some((c) => c.path === current) ? current : value[0]?.path);
					setStatus("ready");
					setMessage(void 0);
				} catch (error) {
					if (!active || token !== request.current) return;
					setStatus("degraded");
					setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.unavailable")));
				}
			};
			load();
			const refreshMs = options.refreshMs ?? 5e3;
			const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => {
				load();
				setDiffTick((tick) => tick + 1);
			}, refreshMs) : void 0;
			return () => {
				active = false;
				request.current += 1;
				if (timer !== void 0) clearInterval(timer);
			};
		}, [activeRemote, refreshTick]);
		useEffect(() => {
			if (options.carrierWidth !== void 0) return;
			const element = detailRef.current;
			if (!element || typeof ResizeObserver !== "function") return;
			const observer = new ResizeObserver((entries) => {
				const next = entries[0]?.contentRect?.width;
				if (next !== void 0) setWidth(Math.round(next));
			});
			observer.observe(element);
			return () => observer.disconnect();
		}, []);
		useEffect(() => {
			if (!selectedPath || !activeRemote) return;
			const token = ++request.current;
			const isNewPath = lastPathRef.current !== selectedPath;
			lastPathRef.current = selectedPath;
			if (isNewPath) {
				setDiffStatus("loading");
				setDiff(void 0);
				setStale(false);
				setPendingDiff(void 0);
				setRevealed(/* @__PURE__ */ new Map());
				setFileCollapsed(false);
			}
			const applyDiffResult = (result) => {
				const key = `${result.staged}\u0000${result.unstaged}`;
				const rendered = renderedRef.current;
				if (rendered && rendered.path === selectedPath) {
					if (rendered.key === key) {
						setDiff(result);
						setDiffStatus("idle");
						setPendingDiff(void 0);
						setStale(false);
						return;
					}
					setPendingDiff(result);
					setStale(true);
					setDiffStatus("idle");
					return;
				}
				renderedRef.current = {
					path: selectedPath,
					key
				};
				setDiff(result);
				setDiffStatus("idle");
				setPendingDiff(void 0);
				setStale(false);
			};
			activeRemote.gitDiff(selectedPath).then((result) => {
				if (token !== request.current) return;
				if (!result.ok) {
					setDiffStatus("error");
					setMessage(friendlyRemoteMessage(result.error.code, t("changes.diffUnavailable")));
					return;
				}
				applyDiffResult(result.value);
				setMessage(void 0);
			}).catch((error) => {
				if (token === request.current) {
					setDiffStatus("error");
					setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.diffUnavailable")));
				}
			});
		}, [
			selectedPath,
			activeRemote,
			refreshTick,
			diffTick
		]);
		useEffect(() => {
			if (selectedPath) selectedButton.current?.focus();
		}, [selectedPath]);
		const select = (path) => setSelectedPath(path);
		const refresh = () => {
			setRefreshTick((tick) => tick + 1);
			setDiffTick((tick) => tick + 1);
		};
		const copyDiff = async () => {
			if (!diff) return;
			if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
				setMessage(t("changes.copyUnavailable"));
				return;
			}
			const text = [diff.staged, diff.unstaged].filter(Boolean).join("\n");
			if (!text) {
				setMessage(t("changes.noDiffText"));
				return;
			}
			try {
				await navigator.clipboard.writeText(text);
				setMessage(t("changes.copyCopied"));
			} catch {
				setMessage(t("changes.copyFailed"));
			}
		};
		const visible = changes.filter((change) => matchesFilter(change, filter));
		const selectedIsUntracked = changes.find((change) => change.path === selectedPath)?.status === "untracked";
		const stagedDiff = diff ? parseUnifiedDiff(diff.staged) : void 0;
		const unstagedDiff = diff ? parseUnifiedDiff(diff.unstaged) : void 0;
		const stagedRows = stagedDiff ? buildDiffRows(stagedDiff.lines, revealed) : void 0;
		const unstagedRows = unstagedDiff ? buildDiffRows(unstagedDiff.lines, revealed) : void 0;
		const diffInsertions = (stagedDiff?.insertions ?? 0) + (unstagedDiff?.insertions ?? 0);
		const diffDeletions = (stagedDiff?.deletions ?? 0) + (unstagedDiff?.deletions ?? 0);
		const navigate = (delta) => {
			if (visible.length < 2) return;
			const index = visible.findIndex((change) => change.path === selectedPath);
			const next = index === -1 ? 0 : (index + delta + visible.length) % visible.length;
			select(visible[next].path);
		};
		const onKeyDown = (event) => {
			if (event.key !== "[" && event.key !== "]") return;
			if (visible.length < 2) return;
			event.preventDefault();
			navigate(event.key === "]" ? 1 : -1);
		};
		const expand = (anchor, total, revealed) => {
			setRevealed((previous) => new Map(previous).set(anchor, Math.min(total, revealed + 20)));
		};
		const wideEnough = width !== void 0 && width >= 900;
		const effectiveMode = width !== void 0 && width < 900 ? "unified" : modeOverride ?? (wideEnough ? "split" : "unified");
		const setMode = (mode) => {
			modeStore.set(carrier, mode);
			setModeOverride(mode);
		};
		const applyPending = () => {
			if (!pendingDiff || !selectedPath) return;
			const key = `${pendingDiff.staged}\u0000${pendingDiff.unstaged}`;
			renderedRef.current = {
				path: selectedPath,
				key
			};
			setDiff(pendingDiff);
			setPendingDiff(void 0);
			setStale(false);
		};
		const diffHeader = () => createElement("div", { "data-dsh-workspace": "diff-file-header" }, createElement("button", {
			type: "button",
			"data-dsh-workspace": "diff-collapse",
			"aria-expanded": String(!fileCollapsed),
			"aria-label": fileCollapsed ? t("changes.expandDiff") : t("changes.collapseDiff"),
			onClick: () => setFileCollapsed((value) => !value)
		}, fileCollapsed ? "▸" : "▾"), createElement("div", { "data-dsh-workspace": "diff-file-title" }, createElement("h3", null, selectedPath), createElement("span", { "data-dsh-workspace": "diff-stats" }, createElement("b", { "data-sign": "add" }, `+${diffInsertions}`), " ", createElement("b", { "data-sign": "del" }, `−${diffDeletions}`))), wideEnough && createElement("div", {
			role: "group",
			"aria-label": t("changes.diffMode"),
			"data-dsh-workspace": "diff-mode-toggle"
		}, createElement("button", {
			type: "button",
			"aria-pressed": effectiveMode === "unified",
			onClick: () => setMode("unified")
		}, t("changes.unified")), createElement("button", {
			type: "button",
			"aria-pressed": effectiveMode === "split",
			onClick: () => setMode("split")
		}, t("changes.split"))), createElement("button", {
			type: "button",
			"data-dsh-workspace": "diff-prev",
			"aria-label": t("changes.previousFile"),
			disabled: visible.length < 2,
			onClick: () => navigate(-1)
		}, "‹"), createElement("button", {
			type: "button",
			"data-dsh-workspace": "diff-next",
			"aria-label": t("changes.nextFile"),
			disabled: visible.length < 2,
			onClick: () => navigate(1)
		}, "›"), createElement("button", {
			type: "button",
			onClick: () => {
				copyDiff();
			}
		}, t("changes.copyDiff")));
		const renderDiffBlock = (label, rows) => {
			if (!rows || rows.length === 0) return null;
			return createElement("section", {
				"aria-label": label,
				"data-dsh-workspace": "diff-block"
			}, createElement("h4", null, label), createElement("pre", {
				"data-dsh-workspace": "diff-code",
				...effectiveMode === "split" ? { "data-mode": "split" } : {}
			}, effectiveMode === "split" ? splitRowsNode(rows, expand) : unifiedRows(rows, expand)));
		};
		const body = status === "loading" ? createElement("p", { role: "status" }, t("changes.loading")) : status === "degraded" ? workspaceNotice("error", message ?? t("changes.unavailable")) : createElement("div", { "data-dsh-workspace": "changes-surface" }, workspaceSurfaceHeader({
			title: t("changes.title"),
			count: workspaceCountBadge(changes.length === 1 ? t("changes.count", { count: 1 }) : t("changes.countPlural", { count: changes.length })),
			actions: createElement("button", {
				type: "button",
				onClick: refresh
			}, t("refresh"))
		}), changes.length === 0 && workspaceEmptyState(t("changes.empty")), changes.length > 0 && workspaceListDetail(createElement("div", { "data-dsh-workspace": "changes-list-column" }, createElement("div", {
			role: "group",
			"aria-label": t("changes.filter"),
			"data-dsh-workspace": "changes-filter"
		}, filterLabels.map(({ key, label }) => workspaceFilterChip(label(), filter === key, () => setFilter(key), key))), visible.length > 0 ? changeGroups(visible, filter, {
			selectedPath,
			selectedButton,
			select
		}) : workspaceEmptyState(t("changes.noFiltered", { filter: (filterLabels.find((f) => f.key === filter)?.label() ?? "").toLowerCase() }))), createElement("div", {
			ref: detailRef,
			"data-dsh-workspace": "changes-detail-column"
		}, !selectedPath && workspaceEmptyState(t("changes.selectHint")), selectedPath && diffStatus === "loading" && createElement("p", { role: "status" }, t("changes.loadingDiff")), selectedPath && diffStatus === "error" && workspaceNotice("error", t("changes.diffUnavailable")), selectedPath && diff && createElement("article", {
			"aria-label": `${selectedPath} diff`,
			"data-dsh-workspace": "change-diff"
		}, diffHeader(), stale && createElement("button", {
			type: "button",
			"data-dsh-workspace": "diff-refresh-pill",
			onClick: applyPending
		}, t("changes.newChanges")), diff.truncated && workspaceNotice("warning", t("changes.diffTruncated")), selectedIsUntracked && workspaceNotice("info", t("changes.untrackedNotice")), fileCollapsed ? workspaceEmptyState(t("changes.diffCollapsed")) : createElement("div", null, !selectedIsUntracked && diff.staged && renderDiffBlock(t("changes.staged"), stagedRows), !selectedIsUntracked && diff.unstaged && renderDiffBlock(t("changes.unstaged"), unstagedRows), !selectedIsUntracked && !diff.staged && !diff.unstaged && createElement("p", { role: "status" }, t("changes.noDiffContent")))))), message && createElement("p", { role: "status" }, message));
		if (!sessionId) return createElement("section", {
			tabIndex: -1,
			"data-dsh-workspace": "changes",
			role: "region",
			"aria-label": t("changes.title"),
			onKeyDown
		}, createElement("h2", null, t("changes.title")), createElement("p", { role: "status" }, t("changes.requireSession")));
		return createElement("section", {
			tabIndex: -1,
			"data-dsh-workspace": "changes",
			role: "region",
			"aria-label": t("changes.title"),
			onKeyDown
		}, createElement("h2", null, t("changes.title")), body);
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-styles.ts
const WORKSPACE_STYLE_ID = "dsh-workspace-view-styles";
/**
* Shared Workspace styling for the `conversation.view` tab and the surfaces it
* hosts. The overlay (`shell.overlay`) pill and its floating drawer styles were
* retired; only the tab (`[data-dsh-workspace="view"]`) and the shared
* `[data-dsh-workspace="panel-content"]` surface styles remain.
*
* The visual system below (cards, badges, chips, lists, empty/notice states) is
* scoped to `[data-dsh-workspace="view"]` and the individual surface attributes
* so it never leaks into the rest of the Harness UI.
*/
const WORKSPACE_VIEW_STYLES = `
[data-dsh-workspace="view"] {
  --dsw-font: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --dsw-bg: Canvas;
  --dsw-surface: color-mix(in srgb, CanvasText 5%, Canvas);
  --dsw-surface-hover: color-mix(in srgb, CanvasText 9%, Canvas);
  --dsw-border: color-mix(in srgb, CanvasText 14%, transparent);
  --dsw-border-strong: color-mix(in srgb, CanvasText 24%, transparent);
  --dsw-text: CanvasText;
  --dsw-muted: color-mix(in srgb, CanvasText 62%, transparent);
  --dsw-faint: color-mix(in srgb, CanvasText 46%, transparent);
  --dsw-accent: Highlight;
  --dsw-accent-soft: color-mix(in srgb, Highlight 14%, transparent);
  --dsw-success: color-mix(in srgb, #2e9e5b 78%, CanvasText 22%);
  --dsw-warning: color-mix(in srgb, #c98a1b 72%, CanvasText 28%);
  --dsw-danger: color-mix(in srgb, #d4565b 78%, CanvasText 22%);
  /* v0.5: consolidated spacing / type / radius scales (4px base). */
  --dsw-space-1: 4px;
  --dsw-space-2: 8px;
  --dsw-space-3: 12px;
  --dsw-space-4: 16px;
  --dsw-type-xs: 11px;
  --dsw-type-sm: 12px;
  --dsw-type-md: 13px;
  --dsw-type-lg: 15px;
  --dsw-radius: 12px;
  --dsw-radius-sm: 8px;
  --dsw-radius-xs: 6px;
  /* v0.5: two-tone diff palette — pale line tint, stronger word-level shade. */
  --dsw-diff-add-bg: color-mix(in srgb, var(--dsw-success) 17%, transparent);
  --dsw-diff-add-word: color-mix(in srgb, var(--dsw-success) 34%, transparent);
  --dsw-diff-del-bg: color-mix(in srgb, var(--dsw-danger) 17%, transparent);
  --dsw-diff-del-word: color-mix(in srgb, var(--dsw-danger) 34%, transparent);
  --dsw-diff-hunk-bg: color-mix(in srgb, CanvasText 5%, transparent);
  --dsw-diff-band: color-mix(in srgb, CanvasText 4%, Canvas);
  color: var(--dsw-text);
  font-family: var(--dsw-font);
}

[data-dsh-workspace="view"] *,
[data-dsh-workspace="view"] *::before,
[data-dsh-workspace="view"] *::after {
  box-sizing: border-box;
}

[data-dsh-workspace="view"] button,
[data-dsh-workspace="view"] input,
[data-dsh-workspace="view"] select,
[data-dsh-workspace="view"] textarea {
  color: inherit;
  font: inherit;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] {
  min-width: 0;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [for="dsh-workspace-view-tab-artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [for="dsh-workspace-view-tab-memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: color-mix(in srgb, Highlight 14%, transparent);
  color: CanvasText;
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace-tab] {
  display: none;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [data-dsh-workspace-tab="artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [data-dsh-workspace-tab="memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [data-dsh-workspace-tab="changes"] {
  display: block;
}

[data-dsh-workspace="panel-tabs"] {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

[data-dsh-workspace="panel-tab"]:hover,
[data-dsh-workspace="panel-tab"]:focus-visible {
  border-color: color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 7%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 1px;
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
  font-size: 15px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h3 {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h4 {
  margin: 0;
  font-size: 12px;
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
  min-height: 32px;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 8px;
  background: Canvas;
}

[data-dsh-workspace="panel-content"] button {
  padding: 5px 10px;
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
  padding: 6px 9px;
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

/* ============ Visual system ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="surface-header"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  margin: 0 0 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] h3 {
  font-size: 14px;
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-actions"] {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="count-badge"] {
  flex: none;
  padding: 2px 9px;
  border: 1px solid color-mix(in srgb, Highlight 40%, transparent);
  border-radius: 999px;
  background: var(--dsw-accent-soft);
  color: color-mix(in srgb, Highlight 82%, CanvasText 18%);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="count-badge"][data-dsw-variant="neutral"] {
  border-color: var(--dsw-border);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] label {
  display: grid;
  gap: 4px;
  margin: 0;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] form {
  margin: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  color: var(--dsw-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .03em;
  line-height: 1.4;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="created"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="added"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="verified"] {
  border-color: color-mix(in srgb, var(--dsw-success) 45%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="modified"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="unverified"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 45%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="deleted"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="rejected"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 45%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="stale"] {
  border-color: var(--dsw-border-strong);
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="card"] {
  margin: 0 0 10px;
  padding: 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="empty-state"] {
  margin: 0 0 var(--dsw-space-3);
  padding: var(--dsw-space-4) var(--dsw-space-4);
  border: 1px dashed var(--dsw-border-strong);
  border-radius: var(--dsw-radius);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.6;
  text-align: center;
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"] {
  margin: 0 0 var(--dsw-space-3);
  padding: var(--dsw-space-2) var(--dsw-space-3);
  border: 1px solid var(--dsw-border);
  border-left: 3px solid var(--dsw-accent);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.5;
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"][data-dsw-tone="error"] {
  border-left-color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"][data-dsw-tone="warning"] {
  border-left-color: var(--dsw-warning);
}

/* ============ Artifacts ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group"] {
  margin: 0 0 12px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] h4 {
  font-size: 12px;
  font-weight: 650;
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] [data-dsh-workspace="count-badge"] {
  font-size: 10px;
  padding: 1px 7px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="changes-list"] {
  display: grid;
  gap: 6px;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  list-style: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 10px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"]:hover {
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"][data-selected="true"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"][data-selected="true"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"][data-selected="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-accent-soft);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-type-badge"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 2px 6px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 6px;
  color: var(--dsw-faint);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .04em;
  text-align: center;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="added"] {
  border-color: color-mix(in srgb, var(--dsw-success) 50%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="modified"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="deleted"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 50%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="renamed"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="copied"] {
  border-color: color-mix(in srgb, var(--dsw-accent) 45%, transparent);
  color: color-mix(in srgb, var(--dsw-accent) 80%, CanvasText 20%);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"] {
  min-width: 0;
  padding: 4px 6px;
  border: none;
  background: transparent;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"]:focus-visible {
  border: 1px solid color-mix(in srgb, Highlight 55%, transparent);
  border-radius: 6px;
  outline: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-meta"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-meta"] {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-faint);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-meta"] {
  grid-column: 2 / -1;
  color: var(--dsw-faint);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] {
  margin: 12px 0 0;
  padding: 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] h3,
[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-provenance"] {
  margin: 0 0 8px;
  color: var(--dsw-faint);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] [role="group"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] form {
  margin: 8px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-block"] {
  margin: 8px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-block"] h4 {
  margin: 0 0 4px;
  color: var(--dsw-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"] {
  margin: 0;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: Canvas;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ============ Memory ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="memory-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] label {
  margin: 0;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] [role="group"] {
  margin: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"] {
  grid-template-columns: minmax(0, 1fr) auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-header"] {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"] {
  flex: none;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, CanvasText 60%, transparent);
  font-size: 10px;
  line-height: 1.3;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="verified"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  color: color-mix(in srgb, Highlight 80%, CanvasText 20%);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="unverified"] {
  border-color: color-mix(in srgb, CanvasText 24%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-proposal="true"] {
  border-color: color-mix(in srgb, Highlight 40%, transparent);
  background: color-mix(in srgb, Highlight 10%, transparent);
  color: CanvasText;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-preview"] {
  grid-column: 1 / -1;
  color: color-mix(in srgb, CanvasText 52%, transparent);
  font-size: 11px;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-meta"] {
  grid-column: 1 / -1;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 12px;
  margin: 10px 0 0;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: Canvas;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] dt {
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin: 8px 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] pre {
  margin: 6px 0 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-editor"] summary {
  cursor: pointer;
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-editor"] form {
  display: grid;
  gap: 6px;
}

/* ============ Changes ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="changes-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-item"][data-selected="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
}

/* ============ Chat summary card ============ */

[data-dsh-workspace="summary"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
  color: CanvasText;
  font-size: 12px;
  line-height: 1.5;
}

[data-dsh-workspace="summary"] strong {
  font-size: 13px;
}

[data-dsh-workspace="summary"] [data-dsh-workspace="summary-metric"] {
  color: color-mix(in srgb, CanvasText 62%, transparent);
  white-space: nowrap;
}

/* ============ v0.7: segmented tab chrome ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tabs"] {
  gap: var(--dsw-space-1);
  padding: var(--dsw-space-1);
  margin: var(--dsw-space-3) var(--dsw-space-3) 0;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: var(--dsw-radius);
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"] {
  min-height: 30px;
  font-size: var(--dsw-type-sm);
  border-radius: var(--dsw-radius-xs);
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [for="dsh-workspace-view-tab-artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [for="dsh-workspace-view-tab-memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"] {
  border-color: color-mix(in srgb, Highlight 50%, transparent);
  background: color-mix(in srgb, Highlight 18%, transparent);
  color: CanvasText;
  font-weight: 650;
  box-shadow: 0 1px 2px color-mix(in srgb, CanvasText 12%, transparent);
}

/* ============ v0.7: filter chips ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"] {
  flex: none;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"][aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 50%, transparent);
  background: var(--dsw-accent-soft);
  color: CanvasText;
}

/* ============ v0.7: two-column list | detail ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="columns"] {
  display: grid;
  gap: 12px;
  min-width: 0;
  align-items: start;
}

@media (min-width: 760px) {
  [data-dsh-workspace="view"] [data-dsh-workspace="columns"] {
    grid-template-columns: minmax(250px, 340px) minmax(0, 1fr);
  }
}

[data-dsh-workspace="view"] [data-dsh-workspace="column-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="column-detail"] {
  min-width: 0;
}

/* ============ v0.7: readable diff ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"] {
  padding: 0;
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-lines"] {
  display: grid;
  grid-template-columns: min-content min-content minmax(0, 1fr);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-line-num"] {
  padding: 0 6px;
  color: var(--dsw-faint);
  font-size: 10px;
  text-align: right;
  user-select: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-line-text"] {
  padding: 0 10px 0 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="add"] {
  background: var(--dsw-diff-add-bg);
  box-shadow: inset 3px 0 0 var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="remove"] {
  background: var(--dsw-diff-del-bg);
  box-shadow: inset 3px 0 0 var(--dsw-danger);
}

/* v0.5: hunk headers are dimmed (delta-style hierarchy — the file header is the strong band). */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="hunk"] {
  background: var(--dsw-diff-hunk-bg);
  color: var(--dsw-muted);
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="header"] {
  color: var(--dsw-faint);
}

/* ============ v0.7: intra-line (word-level) diff tokens ============ */

/* Unchanged run inside a changed line — quiet, inherits the line color. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="equal"] {
  color: inherit;
}

/* Inserted run — stronger highlight than the line-level add background. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="added"] {
  background: var(--dsw-diff-add-word);
  border-radius: 2px;
}

/* Deleted run — stronger highlight than the line-level remove background. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="removed"] {
  background: var(--dsw-diff-del-word);
  border-radius: 2px;
  text-decoration: line-through;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] {
  color: var(--dsw-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] b[data-sign="add"] {
  color: var(--dsw-success);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] b[data-sign="del"] {
  color: var(--dsw-danger);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] [data-dsh-workspace="diff-block"] + [data-dsh-workspace="diff-block"] {
  margin-top: 12px;
}

/* ============ v0.7: artifact status chips ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 999px;
  color: var(--dsw-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .03em;
  line-height: 1.4;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="available"] {
  border-color: color-mix(in srgb, var(--dsw-success) 50%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="oversized"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="stale"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="error"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 50%, transparent);
  color: var(--dsw-danger);
}

/* ============ v0.7: toolbar rows + segmented scopes + primary actions ============ */

[data-dsh-workspace="view"] [data-dsw-row] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsw-row] + [data-dsw-row] {
  margin-top: 8px;
}

[data-dsh-workspace="view"] [data-dsw-segment] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--dsw-border);
  border-radius: 9px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsw-segment] button {
  min-height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
}

[data-dsh-workspace="view"] [data-dsw-segment] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: var(--dsw-accent-soft);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] button[data-dsw-primary="true"] {
  background: color-mix(in srgb, Highlight 24%, Canvas);
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  color: CanvasText;
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsw-editor-actions] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

[data-dsh-workspace="view"] [data-dsw-editor-actions] button {
  flex: 1 1 120px;
}

/* ============ v0.7: memory conflict version identity ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section {
  border: 1px solid var(--dsw-border);
  border-radius: 9px;
  padding: 8px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section[data-dsw-version="keep"] {
  border-color: color-mix(in srgb, var(--dsw-success) 45%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section[data-dsw-version="conflict"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 45%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-warning);
}

/* ============ v0.7: artifact item grid with status chip ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"] [data-dsh-workspace="artifact-status-chip"] {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"] [data-dsh-workspace="artifact-meta"] {
  grid-column: 1 / -1;
  grid-row: 2;
}

/* ============ v0.5: diff file header (sticky band) ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] {
  scroll-margin-top: 4px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-header"] {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--dsw-space-2);
  margin: calc(-1 * var(--dsw-space-3)) calc(-1 * var(--dsw-space-3)) var(--dsw-space-3);
  padding: var(--dsw-space-2) var(--dsw-space-3);
  border-bottom: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius) var(--dsw-radius) 0 0;
  background: var(--dsw-diff-band);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-title"] {
  display: flex;
  align-items: center;
  gap: var(--dsw-space-2);
  min-width: 0;
  flex: 1 1 auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-title"] h3 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  font-size: var(--dsw-type-md);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"],
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"],
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"] {
  flex: none;
  min-height: 26px;
  min-width: 26px;
  padding: 0 var(--dsw-space-2);
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:disabled,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:disabled {
  cursor: not-allowed;
  opacity: .45;
}

/* v0.5: unified/split mode toggle (compact segmented control). */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] button {
  min-height: 22px;
  padding: 0 var(--dsw-space-2);
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-xs);
  background: transparent;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: var(--dsw-accent-soft);
  color: var(--dsw-text);
  font-weight: 650;
}

/* ============ v0.5: context expander ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] {
  grid-column: 1 / -1;
  padding: var(--dsw-space-1) var(--dsw-space-3);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button {
  width: 100%;
  min-height: 26px;
  border: 1px dashed var(--dsw-border-strong);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-diff-hunk-bg);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  font-weight: 600;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  border-style: solid;
  color: var(--dsw-text);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

/* ============ v0.5: split (side-by-side) view ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"][data-mode="split"] {
  overflow-x: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] > [data-dsh-workspace="diff-code-line"] {
  display: contents;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"] {
  display: grid;
  grid-template-columns: min-content minmax(0, 1fr);
  min-width: 0;
  padding-left: var(--dsw-space-1);
  border-left: 1px solid var(--dsw-border);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-code-line"][data-split="full"] [data-dsh-workspace="diff-cell"] {
  grid-column: 1 / -1;
  border-left: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-empty="true"] {
  background: color-mix(in srgb, CanvasText 3%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-side="old"][data-kind="remove"] {
  background: var(--dsw-diff-del-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-side="new"][data-kind="add"] {
  background: var(--dsw-diff-add-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-kind="hunk"] {
  background: var(--dsw-diff-hunk-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-kind="header"] {
  background: transparent;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"] [data-dsh-workspace="diff-line-text"] {
  padding-right: var(--dsw-space-2);
}

/* ============ v0.5: refresh pill ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"] {
  display: block;
  width: 100%;
  margin: 0 0 var(--dsw-space-2);
  padding: var(--dsw-space-2);
  border: 1px solid color-mix(in srgb, Highlight 45%, transparent);
  border-radius: 999px;
  background: var(--dsw-accent-soft);
  color: var(--dsw-text);
  font-size: var(--dsw-type-sm);
  font-weight: 650;
  line-height: 1.4;
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 60%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

/* v0.6: session summary block at the top of the Workspace tab. */
[data-dsh-workspace="view"] [data-dsh-workspace="summary-block"] {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-border);
  border-radius: 10px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block-body"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block-body"] strong {
  font-size: var(--dsw-type-sm);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block"] [data-dsh-workspace="summary-metric"] {
  font-size: var(--dsw-type-xs);
  color: var(--dsw-text-secondary);
}

/* v0.6: read-only multi-tab preview inside Artifacts (ADR #114). */
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tabs"] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
  padding: 3px 8px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  background: var(--dsw-surface);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab"][data-active="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-select"] {
  border: none;
  background: none;
  padding: 0;
  font-size: var(--dsw-type-xs);
  color: var(--dsw-text-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-close"] {
  border: none;
  background: none;
  padding: 0 2px;
  font-size: var(--dsw-type-sm);
  line-height: 1;
  color: var(--dsw-text-tertiary);
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-close"]:hover {
  color: var(--dsw-text-primary);
}

/* v0.6: SCM grouped display (ADR #115). */
[data-dsh-workspace="view"] [data-dsh-workspace="change-groups"] {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-group-title"] {
  margin: 0 0 4px;
  font-size: var(--dsw-type-xs);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dsw-text-tertiary);
}

/* v0.6: rendered markdown preview (self-contained; mermaid diagrams scroll). */
[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] {
  overflow-x: auto;
  line-height: 1.6;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] img {
  max-width: 100%;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] .dsh-workspace-mermaid {
  overflow-x: auto;
  margin: 8px 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] pre {
  overflow-x: auto;
  padding: 8px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 8px;
  background: var(--dsw-surface-hover);
}
`;
let styleUsers = 0;
function installWorkspaceStyles() {
	const dom = typeof document === "object" ? document : void 0;
	if (!dom || typeof dom.getElementById !== "function" || typeof dom.createElement !== "function" || !dom.head || typeof dom.head.appendChild !== "function") return () => void 0;
	let style = dom.getElementById(WORKSPACE_STYLE_ID);
	if (!style) {
		style = dom.createElement("style");
		style.id = WORKSPACE_STYLE_ID;
		style.textContent = WORKSPACE_VIEW_STYLES;
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
* Conversation view tab body: the Artifacts/Memory/Changes switch rendered in
* the tab row's body, reusing the existing surfaces unchanged. Session-scoped
* slot components receive the global `useSessions` seat, which the surfaces
* already read, so no remote-resolution changes are needed.
*/
function createWorkspaceConversationViewComponent(options) {
	return function WorkspaceConversationView(props) {
		const children = [];
		if (options.summary) children.push(createElement(options.summary, props));
		children.push(createElement("input", {
			id: "dsh-workspace-view-tab-artifacts",
			name: "dsh-workspace-view-tab",
			type: "radio",
			defaultChecked: true,
			"data-dsh-workspace": "tab-input",
			"aria-label": t("view.artifacts")
		}), createElement("input", {
			id: "dsh-workspace-view-tab-memory",
			name: "dsh-workspace-view-tab",
			type: "radio",
			"data-dsh-workspace": "tab-input",
			"aria-label": t("view.memory")
		}), createElement("input", {
			id: "dsh-workspace-view-tab-changes",
			name: "dsh-workspace-view-tab",
			type: "radio",
			"data-dsh-workspace": "tab-input",
			"aria-label": t("view.changes")
		}), createElement("div", {
			role: "group",
			"aria-label": t("view.workspace"),
			"data-dsh-workspace": "panel-tabs"
		}, createElement("label", {
			htmlFor: "dsh-workspace-view-tab-artifacts",
			"data-dsh-workspace": "panel-tab"
		}, t("view.artifacts")), createElement("label", {
			htmlFor: "dsh-workspace-view-tab-memory",
			"data-dsh-workspace": "panel-tab"
		}, t("view.memory")), createElement("label", {
			htmlFor: "dsh-workspace-view-tab-changes",
			"data-dsh-workspace": "panel-tab"
		}, t("view.changes"))), createElement("div", { "data-dsh-workspace": "panel-content" }, createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "artifacts"
		}, createElement(options.artifacts, props)), createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "memory"
		}, createElement(options.memory, props)), createElement("div", {
			"data-dsh-workspace": "tab-content",
			"data-dsh-workspace-tab": "changes"
		}, createElement(options.changes, props))));
		return createElement("section", {
			role: "region",
			"aria-label": t("view.workspace"),
			"data-dsh-workspace": "view"
		}, children);
	};
}
//#endregion
//#region packages/plugin/src/web/workspace-summary-block.ts
/** Compact human-readable session activity span derived from host timestamps. */
function formatActiveSpan(firstObservedAt, lastObservedAt) {
	if (!firstObservedAt || !lastObservedAt || lastObservedAt <= firstObservedAt) return t("summary.justNow");
	const seconds = Math.round((lastObservedAt - firstObservedAt) / 1e3);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
/**
* Read-only summary block rendered at the top of the Workspace conversation
* tab. The data is derived on demand by the host from allow-listed durable
* tool records (tool/call + tool/result) — never from a persisted custom
* event — so it works identically for live and resumed sessions (the
* history-resume fix, wayfinder #112).
*/
function workspaceSummaryBlockComponent(options = {}) {
	return function WorkspaceSummaryBlock(props) {
		const useSessions = props.useSessions;
		const sessionId = useSessions?.((state) => state.current);
		const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : options.remote;
		const [summary, setSummary] = useState();
		const [message, setMessage] = useState();
		const [loaded, setLoaded] = useState(false);
		const request = useRef(0);
		useEffect(() => {
			let active = true;
			if (!activeRemote || !sessionId) {
				setLoaded(true);
				setSummary(void 0);
				return () => {
					active = false;
				};
			}
			const load = async () => {
				const token = ++request.current;
				try {
					const value = await activeRemote.workspaceSummary();
					if (!active || token !== request.current) return;
					setSummary(value);
					setMessage(void 0);
				} catch (error) {
					if (!active || token !== request.current) return;
					setMessage(friendlyRemoteMessage(remoteCode(error), t("summary.unavailable")));
				} finally {
					if (active && token === request.current) setLoaded(true);
				}
			};
			load();
			const refreshMs = options.refreshMs ?? 5e3;
			const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => {
				load();
			}, refreshMs) : void 0;
			return () => {
				active = false;
				request.current += 1;
				if (timer !== void 0) clearInterval(timer);
			};
		}, [
			activeRemote,
			sessionId,
			options.refreshMs
		]);
		if (!sessionId || !loaded) return null;
		if (!summary) return null;
		const span = formatActiveSpan(summary.firstObservedAt, summary.lastObservedAt);
		return createElement("section", {
			"data-dsh-workspace": "summary-block",
			"aria-label": t("view.workspace")
		}, createElement("div", { "data-dsh-workspace": "summary-block-body" }, createElement("strong", null, summary.workspaceName), createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.files", { count: summary.filesTouched })), createElement("span", { "data-dsh-workspace": "summary-metric" }, `${summary.filesCreated} ${t("changes.filter.added").toLowerCase()} · ${summary.filesModified} ${t("changes.filter.modified").toLowerCase()} · ${summary.filesDeleted} ${t("changes.filter.deleted").toLowerCase()}`), createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.artifacts", { count: summary.artifacts })), summary.memoryCount > 0 && createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.memory", {
			count: summary.memoryCount,
			count2: summary.decisionCount
		})), createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.active", { span }))), message && workspaceEmptyState(message));
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
			let disposed = false;
			let disposeSurfaces = () => {};
			const viewSlots = ctx.slots;
			const registerWorkspaceSurfaces = (scope) => {
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
						gitStatus: () => call("gitStatus"),
						gitDiff: (path) => call("gitDiff", path),
						workspaceSummary: () => call("workspaceSummary"),
						memoryOpen: (request) => call("memoryOpen", request),
						memoryList: (request, options) => call("memoryList", request, options),
						memorySearch: (request, query, options) => call("memorySearch", request, query, options),
						memoryUpsert: (request, draft) => call("memoryUpsert", request, draft),
						memoryArchive: (request, id, revision, hash) => call("memoryArchive", request, id, revision, hash),
						memoryForget: (request, id, revision, hash) => call("memoryForget", request, id, revision, hash),
						memoryGovern: (request, id, action, revision, hash) => call("memoryGovern", request, id, action, revision, hash),
						memoryExport: (request) => call("memoryExport", request),
						memoryImport: (request, serialized) => call("memoryImport", request, serialized),
						memoryMarkUsed: (request, id) => call("memoryMarkUsed", request, id),
						memoryClose: (request) => call("memoryClose", request)
					};
					remotes.set(sessionId, adapted);
					return adapted;
				};
				const disposers = [installWorkspaceStyles()];
				const artifacts = createWorkspaceArtifactSurfaceComponent(void 0, {
					MarkdownText,
					CodeBlock,
					JsonTree
				}, { resolveRemote });
				const memory = createWorkspaceMemorySurfaceComponent({ resolveRemote });
				const changes = createWorkspaceChangesSurfaceComponent(void 0, { resolveRemote });
				if (typeof viewSlots.inject === "function" && typeof viewSlots.register === "function") disposers.push(viewSlots.inject(WORKSPACE_VIEW_SLOT, () => viewSlots.register(workspaceConversationViewRegistration(), createWorkspaceConversationViewComponent({
					artifacts,
					memory,
					changes,
					summary: workspaceSummaryBlockComponent({ resolveRemote })
				}))));
				return () => {
					remotes.clear();
					for (const dispose of disposers.reverse()) dispose();
				};
			};
			let directWorkspace = false;
			try {
				directWorkspace = Boolean(ctx.remote.workspace);
			} catch {}
			if (directWorkspace) disposeSurfaces = registerWorkspaceSurfaces(ctx);
			else {
				const remoteScope = ctx.inject?.(["remote.workspace"], registerWorkspaceSurfaces);
				if (remoteScope) disposeSurfaces = () => {
					remoteScope.dispose();
				};
				else disposeSurfaces = registerWorkspaceSurfaces(ctx);
			}
			disposeConversation = () => {
				if (disposed) return;
				disposed = true;
				disposeSurfaces();
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

    Object.assign(exports, { WORKSPACE_ARTIFACT_SLOT_NAME, WORKSPACE_VIEW_ENTRY_KEY, WORKSPACE_VIEW_LABEL, WORKSPACE_VIEW_ORDER, WORKSPACE_VIEW_SLOT, apply, applyWorkspaceConversationContribution, buildWorkspaceResourceUrl, createWorkspaceArtifactDetail, createWorkspaceArtifactSurfaceComponent, createWorkspaceArtifactView, createWorkspaceChangesSurfaceComponent, createWorkspaceChatNodeComponent, createWorkspaceConversationViewComponent, createWorkspaceDownloadController, createWorkspaceMemorySurfaceComponent, createWorkspacePreviewRenderer, inject, installWorkspaceStyles, normalizeWorkspaceArtifacts, renderWorkspacePreview, sanitizeWorkspaceMarkdown, workspaceArtifactPreviewDescriptor, workspaceArtifactResourceUrl, workspaceClient, workspaceConversationDefinition, workspaceConversationView, workspaceConversationViewRegistration, workspaceMemoryRecordSummary, workspaceMemoryRequest, workspaceMemoryTypes });
    return module.exports;
  }
});
