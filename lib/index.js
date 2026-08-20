import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { homedir } from "node:os";
import { chmod, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { fileURLToPath } from "node:url";
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
//#region packages/plugin/src/domain/workspace.ts
var WorkspaceIdentityError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "WorkspaceIdentityError";
		this.code = code;
	}
};
function resolveWorkspaceRoot(processCwd, configuredRoot = ".") {
	if (typeof processCwd !== "string" || !processCwd.trim()) throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory is required");
	if (typeof configuredRoot !== "string") throw new WorkspaceIdentityError("INVALID_ROOT", "Configured Workspace Root must be a string");
	const logicalRoot = configuredRoot.replaceAll("\\", "/");
	if (logicalRoot.startsWith("/") || /^[A-Za-z]:/.test(logicalRoot) || logicalRoot.split("/").includes("..")) throw new WorkspaceIdentityError("ROOT_OUTSIDE_PROCESS", "Configured Workspace Root must stay below the process working directory");
	let canonicalProcessRoot;
	try {
		if (!statSync(processCwd).isDirectory()) throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory must be a directory");
		canonicalProcessRoot = realpathSync.native(processCwd);
	} catch (error) {
		if (error instanceof WorkspaceIdentityError) throw error;
		throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory is unavailable");
	}
	const candidate = resolve(canonicalProcessRoot, logicalRoot || ".");
	try {
		if (!statSync(candidate).isDirectory()) throw new WorkspaceIdentityError("INVALID_ROOT", "Workspace Root must be a directory");
		const canonicalCandidate = realpathSync.native(candidate);
		const relativeCandidate = relative(canonicalProcessRoot, canonicalCandidate);
		if (relativeCandidate === ".." || relativeCandidate.startsWith(`..${sep}`) || isAbsolute(relativeCandidate)) throw new WorkspaceIdentityError("ROOT_OUTSIDE_PROCESS", "Configured Workspace Root must stay below the process working directory");
		return canonicalCandidate;
	} catch (error) {
		if (error instanceof WorkspaceIdentityError) throw error;
		throw new WorkspaceIdentityError("INVALID_ROOT", "Workspace Root is unavailable");
	}
}
function rootId(canonicalRoot) {
	return `root:${createHash("sha256").update(canonicalRoot).digest("hex")}`;
}
function baselineFor(identity, observation, capturedAt) {
	return {
		sessionId: identity.sessionId,
		rootId: identity.rootId,
		capturedAt,
		source: observation?.source ?? "unknown",
		gitHead: observation?.gitHead,
		gitStatus: observation?.gitStatus?.map((change) => ({
			status: change.status,
			path: normalizeWorkspacePath(change.path)
		})),
		fingerprint: observation?.fingerprint,
		reason: observation?.reason ?? (observation ? void 0 : "baseline observation unavailable")
	};
}
function startWorkspace(args) {
	if (typeof args.sessionId !== "string" || !args.sessionId.trim()) throw new WorkspaceIdentityError("INVALID_SESSION", "Harness Session id is required");
	if (args.existingSnapshot) return resumeWorkspace({
		snapshot: args.existingSnapshot,
		sessionId: args.sessionId,
		processCwd: args.processCwd,
		configuredRoot: args.configuredRoot
	});
	const identity = {
		sessionId: args.sessionId,
		rootId: rootId(resolveWorkspaceRoot(args.processCwd, args.configuredRoot))
	};
	return {
		identity,
		baseline: baselineFor(identity, args.baseline, args.capturedAt ?? Date.now())
	};
}
function resumeWorkspace(args) {
	const root = resolveWorkspaceRoot(args.processCwd, args.configuredRoot);
	if (args.snapshot.identity.sessionId !== args.sessionId) throw new WorkspaceIdentityError("SESSION_MISMATCH", "Harness Session does not match the snapshot");
	if (args.snapshot.baseline.sessionId !== args.snapshot.identity.sessionId || args.snapshot.baseline.rootId !== args.snapshot.identity.rootId) throw new WorkspaceIdentityError("BASELINE_MISMATCH", "Workspace snapshot baseline does not match its identity");
	if (args.snapshot.identity.rootId !== rootId(root)) throw new WorkspaceIdentityError("ROOT_MISMATCH", "Workspace Root does not match the snapshot");
	return args.snapshot;
}
//#endregion
//#region packages/plugin/src/types.ts
/**
* Canonical record types, defined here (not in the node-bound store module)
* so client bundles can reference the values without pulling in node:crypto.
*/
const MEMORY_TYPES = [
	"decision",
	"preference",
	"convention",
	"fact"
];
//#endregion
//#region packages/plugin/src/domain/memory-store.ts
const MEMORY_SCHEMA_VERSION = 1;
const MEMORY_MAX_TITLE_BYTES = 256;
const MEMORY_MAX_CONTENT_BYTES = 65536;
const MEMORY_MAX_TAGS = 32;
const MEMORY_MAX_TAG_BYTES = 64;
const MEMORY_MAX_QUERY_BYTES = 256;
const MEMORY_MAX_RESULTS = 100;
const MEMORY_MAX_FILE_BYTES = 8388608;
function hashMemoryContent(content) {
	return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
var MemoryStoreError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "MemoryStoreError";
		this.code = code;
	}
};
const scopes = [
	"session",
	"project",
	"user",
	"shared-project"
];
const types = MEMORY_TYPES;
const statuses = [
	"active",
	"archived",
	"forgotten"
];
const provenanceKinds = [
	"user",
	"agent",
	"tool",
	"import"
];
function text(value, max, label) {
	if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new MemoryStoreError("INVALID_RECORD", `${label} is invalid`);
}
function optionalText(value, max, label) {
	if (value !== void 0) text(value, max, label);
}
function contentText(value, max) {
	if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > max || /[\u0000\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new MemoryStoreError("INVALID_RECORD", "Memory content is invalid");
}
function boundedInteger(value, label) {
	if (!Number.isSafeInteger(value) || value < 0) throw new MemoryStoreError("INVALID_RECORD", `${label} is invalid`);
}
function validateGovernance(value, scope) {
	if (value === void 0) return void 0;
	if (!value || typeof value !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory governance is invalid");
	const governance = value;
	const origins = [
		"user-authored",
		"imported",
		"derived",
		"model-suggested"
	];
	const verifications = [
		"unverified",
		"verified",
		"rejected",
		"stale"
	];
	const confidences = [
		"low",
		"medium",
		"high"
	];
	if (!origins.includes(governance.origin) || !verifications.includes(governance.verification) || ![
		"session-end",
		"project-delete",
		"user-managed"
	].includes(governance.retention)) throw new MemoryStoreError("INVALID_RECORD", "Memory governance enum is invalid");
	if (!Array.isArray(governance.sourceRefs) || governance.sourceRefs.length > 32) throw new MemoryStoreError("INVALID_RECORD", "Memory source references are invalid");
	const sourceRefs = governance.sourceRefs.map((source) => {
		if (!source || typeof source !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory source reference is invalid");
		const ref = source;
		if (![
			"session",
			"event",
			"file",
			"url",
			"import"
		].includes(ref.kind)) throw new MemoryStoreError("INVALID_RECORD", "Memory source reference kind is invalid");
		text(ref.id, 256, "Memory source reference id");
		if (ref.contentHash !== void 0 && !/^sha256:[0-9a-f]{64}$/u.test(String(ref.contentHash))) throw new MemoryStoreError("INVALID_RECORD", "Memory source reference hash is invalid");
		return Object.freeze({
			kind: ref.kind,
			id: ref.id,
			...ref.contentHash === void 0 ? {} : { contentHash: ref.contentHash }
		});
	});
	if (governance.origin !== "user-authored" && sourceRefs.length === 0) throw new MemoryStoreError("INVALID_RECORD", "Non-user Memory requires a source reference");
	if (!Number.isSafeInteger(governance.revision) || governance.revision < 1) throw new MemoryStoreError("INVALID_RECORD", "Memory revision is invalid");
	if (governance.confidence !== void 0 && !confidences.includes(governance.confidence)) throw new MemoryStoreError("INVALID_RECORD", "Memory confidence is invalid");
	if (governance.verifiedBy !== void 0 && governance.verifiedBy !== "user" && governance.verifiedBy !== "trusted-tool") throw new MemoryStoreError("INVALID_RECORD", "Memory verifiedBy is invalid");
	if (governance.verifiedAt !== void 0) boundedInteger(governance.verifiedAt, "Memory verifiedAt");
	if (governance.expiresAt !== void 0) boundedInteger(governance.expiresAt, "Memory expiresAt");
	if (governance.pinnedAt !== void 0) boundedInteger(governance.pinnedAt, "Memory pinnedAt");
	if (governance.pinnedBy !== void 0 && governance.pinnedBy !== "user") throw new MemoryStoreError("INVALID_RECORD", "Memory pinnedBy is invalid");
	if (governance.pinnedAt !== void 0 && governance.pinnedBy === void 0) throw new MemoryStoreError("INVALID_RECORD", "Pinned Memory requires an actor");
	if (governance.verification === "verified" && governance.verifiedAt === void 0) throw new MemoryStoreError("INVALID_RECORD", "Verified Memory requires a timestamp");
	return Object.freeze({
		origin: governance.origin,
		sourceRefs: Object.freeze(sourceRefs),
		verification: governance.verification,
		...governance.verifiedAt === void 0 ? {} : { verifiedAt: governance.verifiedAt },
		...governance.verifiedBy === void 0 ? {} : { verifiedBy: governance.verifiedBy },
		...governance.confidence === void 0 ? {} : { confidence: governance.confidence },
		revision: governance.revision,
		...governance.conflictGroup === void 0 ? {} : { conflictGroup: governance.conflictGroup },
		...governance.pinnedAt === void 0 ? {} : { pinnedAt: governance.pinnedAt },
		...governance.pinnedBy === void 0 ? {} : { pinnedBy: "user" },
		...governance.expiresAt === void 0 ? {} : { expiresAt: governance.expiresAt },
		retention: governance.retention
	});
}
function safeLimit(value, fallback) {
	return Number.isSafeInteger(value) && value > 0 ? Math.min(value, fallback) : fallback;
}
function safeFilePart(value) {
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
function memoryStorePath(options) {
	if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
	text(options.scopeKey, 512, "Memory scope key");
	if (options.scope === "project" || options.scope === "shared-project") {
		if (typeof options.projectRoot !== "string" || !options.projectRoot.trim()) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
		return join(options.projectRoot, ".dsh", "workspace-memory", options.scope === "project" ? "records.jsonl" : "shared.jsonl");
	}
	if (typeof options.dshHome !== "string" || !options.dshHome.trim()) throw new MemoryStoreError("STORE_UNAVAILABLE", "DSH_HOME is unavailable");
	return options.scope === "user" ? join(options.dshHome, "workspace-memory", "user.jsonl") : join(options.dshHome, "workspace-memory", "sessions", `${safeFilePart(options.scopeKey)}.jsonl`);
}
/** Stable path-shaped vocabulary for the UI without exposing host paths. */
function memoryLogicalLocation(options) {
	if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
	text(options.scopeKey, 512, "Memory scope key");
	if (options.scope === "project") return ".dsh/workspace-memory/records.jsonl";
	if (options.scope === "shared-project") return ".dsh/workspace-memory/shared.jsonl";
	if (options.scope === "user") return "~/.dsh/workspace-memory/user.jsonl";
	return `~/.dsh/workspace-memory/sessions/${safeFilePart(options.scopeKey)}.jsonl`;
}
function validateRecord(value, expectedScope, expectedScopeKey, maxContentBytes = MEMORY_MAX_CONTENT_BYTES) {
	if (!value || typeof value !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory record must be an object");
	const record = value;
	if (record.schemaVersion !== 1) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
	text(record.id, 256, "Memory id");
	if (!scopes.includes(record.scope) || record.scope !== expectedScope || record.scopeKey !== expectedScopeKey) throw new MemoryStoreError("SCOPE_MISMATCH", "Memory record scope does not match this store");
	text(record.scopeKey, 512, "Memory scope key");
	if (!types.includes(record.type)) throw new MemoryStoreError("INVALID_RECORD", "Memory type is invalid");
	text(record.title, 256, "Memory title");
	contentText(record.content, maxContentBytes);
	if (!Array.isArray(record.tags) || record.tags.length > 32) throw new MemoryStoreError("INVALID_RECORD", "Memory tags are invalid");
	const tags = record.tags.map((tag) => {
		text(tag, 64, "Memory tag");
		return tag;
	});
	if (!record.provenance || typeof record.provenance !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory provenance is invalid");
	const provenance = record.provenance;
	if (!provenanceKinds.includes(provenance.kind)) throw new MemoryStoreError("INVALID_RECORD", "Memory provenance kind is invalid");
	optionalText(provenance.sessionId, 256, "Memory provenance session");
	optionalText(provenance.note, 512, "Memory provenance note");
	if (provenance.eventSeq !== void 0) boundedInteger(provenance.eventSeq, "Memory provenance event");
	boundedInteger(record.createdAt, "Memory createdAt");
	boundedInteger(record.updatedAt, "Memory updatedAt");
	if (record.updatedAt < record.createdAt) throw new MemoryStoreError("INVALID_RECORD", "Memory timestamps are invalid");
	if (record.lastUsedAt !== void 0) boundedInteger(record.lastUsedAt, "Memory lastUsedAt");
	boundedInteger(record.useCount, "Memory useCount");
	if (!statuses.includes(record.status)) throw new MemoryStoreError("INVALID_RECORD", "Memory status is invalid");
	text(record.contentHash, 80, "Memory content hash");
	if (!/^sha256:[0-9a-f]{64}$/u.test(record.contentHash) || record.contentHash !== hashMemoryContent(record.content)) throw new MemoryStoreError("INVALID_RECORD", "Memory content hash is invalid");
	const governance = validateGovernance(record.governance, expectedScope);
	const normalizedProvenance = { kind: provenance.kind };
	if (provenance.sessionId !== void 0) normalizedProvenance.sessionId = provenance.sessionId;
	if (provenance.eventSeq !== void 0) normalizedProvenance.eventSeq = provenance.eventSeq;
	if (provenance.note !== void 0) normalizedProvenance.note = provenance.note;
	return Object.freeze({
		schemaVersion: 1,
		id: record.id,
		scope: record.scope,
		scopeKey: record.scopeKey,
		type: record.type,
		title: record.title,
		content: record.content,
		tags: Object.freeze(tags),
		provenance: Object.freeze(normalizedProvenance),
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		...record.lastUsedAt === void 0 ? {} : { lastUsedAt: record.lastUsedAt },
		useCount: record.useCount,
		contentHash: record.contentHash,
		status: record.status,
		...governance === void 0 ? {} : { governance }
	});
}
function recordRank(record, query) {
	const lower = query.toLocaleLowerCase();
	const title = record.title.toLocaleLowerCase();
	const content = record.content.toLocaleLowerCase();
	const tags = record.tags.map((tag) => tag.toLocaleLowerCase());
	if (title === lower) return 0;
	if (title.includes(lower) || content.includes(lower) || tags.some((tag) => tag === lower)) return 1;
	const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	const haystack = `${title} ${content} ${tags.join(" ")}`;
	const overlap = tokens.filter((token) => haystack.includes(token)).length;
	if (overlap === tokens.length && tokens.length > 0) return 2;
	if (title.startsWith(lower) || tags.some((tag) => tag.startsWith(lower))) return 3;
	if (overlap > 0) return 4;
	return 5;
}
/**
* Escape raw control characters (LF / CR / TAB) that sit *inside* JSON string
* literals. JSONL forbids them; a non-JSONL writer (or a hand edit) that
* wrote unescaped newlines in `content` produces a file that fails JSON.parse
* line-by-line *and* joined. This state-machine pass turns those back into
* `\n` / `\r` / `\t` escapes so the joined record parses again.
*/
function fixStringControlCharacters(source) {
	let out = "";
	let inString = false;
	let escaped = false;
	for (const ch of source) {
		if (escaped) {
			out += ch;
			escaped = false;
			continue;
		}
		if (inString && ch === "\\") {
			out += ch;
			escaped = true;
			continue;
		}
		if (ch === "\"") {
			inString = !inString;
			out += ch;
			continue;
		}
		if (inString && (ch === "\n" || ch === "\r" || ch === "	")) {
			out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
			continue;
		}
		out += ch;
	}
	return out;
}
/**
* Recover a record that spans multiple physical lines. JSONL requires one
* JSON document per line, but a record whose `content` holds raw (unescaped)
* newlines occupies several lines. Join subsequent lines (bounded), fix the
* in-string control characters, and re-parse; returns the parsed value and the
* index of the last consumed line, or undefined when no bounded prefix is
* recoverable.
*/
function recoverMultiline(lines, start, maxBytes) {
	let buffer = lines[start] ?? "";
	for (let index = start + 1; index < lines.length; index += 1) {
		if (index - start > 32 || buffer.length > maxBytes) return void 0;
		buffer = `${buffer}\n${lines[index]}`;
		try {
			const value = JSON.parse(fixStringControlCharacters(buffer));
			if (value && typeof value === "object") return {
				value,
				lastIndex: index
			};
		} catch {}
	}
}
function migrateValue(value, migrations) {
	let current = value;
	let version = typeof current.schemaVersion === "number" ? current.schemaVersion : NaN;
	const seen = /* @__PURE__ */ new Set();
	while (version !== 1) {
		if (!Number.isSafeInteger(version)) throw new MemoryStoreError("INVALID_RECORD", "Memory record schema is invalid");
		if (seen.has(version)) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
		seen.add(version);
		const migration = migrations.find((candidate) => candidate.from === version);
		if (!migration || migration.to <= migration.from) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
		current = migration.migrate(current);
		version = typeof current.schemaVersion === "number" ? current.schemaVersion : NaN;
	}
	return current;
}
var MemoryStore = class {
	filePath;
	scope;
	scopeKey;
	now;
	idFactory;
	maxContentBytes;
	lockStaleMs;
	projectRoot;
	migrations;
	records = /* @__PURE__ */ new Map();
	foreignLines = [];
	warnings = [];
	readOnly = false;
	opened = false;
	async ensureSafePath() {
		if (!this.projectRoot) return;
		let canonicalRoot;
		try {
			canonicalRoot = await realpath(this.projectRoot);
		} catch {
			throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
		}
		let probe = dirname(this.filePath);
		while (true) try {
			const canonicalProbe = await realpath(probe);
			const relativeProbe = relative(canonicalRoot, canonicalProbe);
			if (relativeProbe === ".." || relativeProbe.startsWith(`..${sep}`) || relativeProbe.startsWith(sep)) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path escapes the Workspace Root");
			break;
		} catch (error) {
			if (error instanceof MemoryStoreError) throw error;
			const parent = dirname(probe);
			if (parent === probe) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path is unavailable");
			probe = parent;
		}
		try {
			const canonicalFile = await realpath(this.filePath);
			const relativeFile = relative(canonicalRoot, canonicalFile);
			if (relativeFile === ".." || relativeFile.startsWith(`..${sep}`) || relativeFile.startsWith(sep)) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path escapes the Workspace Root");
		} catch (error) {
			if (error?.code !== "ENOENT") throw error instanceof MemoryStoreError ? error : new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path is unavailable");
		}
	}
	constructor(options) {
		if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
		text(options.scopeKey, 512, "Memory scope key");
		this.scope = options.scope;
		this.scopeKey = options.scopeKey;
		this.filePath = options.filePath ?? memoryStorePath(options);
		this.projectRoot = options.projectRoot;
		this.migrations = options.migrations ?? [];
		this.now = options.now ?? Date.now;
		this.idFactory = options.idFactory ?? (() => `memory:${randomUUID()}`);
		this.maxContentBytes = safeLimit(options.maxContentBytes, MEMORY_MAX_CONTENT_BYTES);
		const lockStaleMs = options.lockStaleMs;
		this.lockStaleMs = typeof lockStaleMs === "number" && Number.isSafeInteger(lockStaleMs) && lockStaleMs > 0 ? lockStaleMs : 6e4;
	}
	async open() {
		if (this.opened) return this.state();
		if (this.scope === "project" || this.scope === "shared-project") {
			if (!this.projectRoot) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
			try {
				if (!(await stat(this.projectRoot)).isDirectory()) throw new Error("not-directory");
			} catch {
				throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
			}
		}
		await this.ensureSafePath();
		this.opened = true;
		let source;
		try {
			if ((await stat(this.filePath)).size > 8388608) {
				this.readOnly = true;
				this.warnings.push({
					code: "STORE_TOO_LARGE",
					line: 0,
					message: "Memory store exceeds the safe read limit"
				});
				return this.state();
			}
			source = await readFile(this.filePath, "utf8");
		} catch (error) {
			if (error?.code === "ENOENT") try {
				await mkdir(dirname(this.filePath), {
					recursive: true,
					mode: 448
				});
				await chmod(dirname(this.filePath), 448);
				return this.state();
			} catch {
				this.opened = false;
				throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store directory cannot be secured");
			}
			this.opened = false;
			throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store cannot be read");
		}
		try {
			await chmod(dirname(this.filePath), 448);
			await chmod(this.filePath, 384);
		} catch {
			this.opened = false;
			throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store permissions cannot be secured");
		}
		const lines = source.split("\n");
		let migrated = false;
		let index = 0;
		while (index < lines.length) {
			const line = lines[index].trim();
			if (!line) {
				index += 1;
				continue;
			}
			let parsed;
			let consumed = index;
			let recovered = false;
			try {
				parsed = JSON.parse(line);
			} catch {
				const joined = recoverMultiline(lines, index, this.maxContentBytes);
				if (joined === void 0) {
					this.warnings.push({
						code: "CORRUPT_RECORD",
						line: index + 1,
						message: "Memory record is invalid"
					});
					await this.quarantine(`${line}\n`, index + 1);
					index += 1;
					continue;
				}
				parsed = joined.value;
				consumed = joined.lastIndex;
				recovered = true;
			}
			try {
				const recordScope = parsed && typeof parsed === "object" ? parsed.scope : void 0;
				const recordScopeKey = parsed && typeof parsed === "object" ? parsed.scopeKey : void 0;
				if (recordScope === this.scope && typeof recordScopeKey === "string" && recordScopeKey !== this.scopeKey) {
					this.foreignLines.push(recovered ? lines.slice(index, consumed + 1).join("\n") : line);
					index = consumed + 1;
					continue;
				}
				const migratedValue = parsed && typeof parsed === "object" ? migrateValue(parsed, this.migrations) : parsed;
				migrated ||= migratedValue !== parsed;
				const record = validateRecord(migratedValue, this.scope, this.scopeKey, this.maxContentBytes);
				this.records.set(record.id, record);
				if (recovered) this.warnings.push({
					code: "RECOVERED_LINE",
					line: index + 1,
					message: "Memory record spanned multiple lines and was recovered"
				});
			} catch (error) {
				const truncated = consumed === lines.length - 1 && !source.endsWith("\n");
				const code = error instanceof MemoryStoreError && error.code === "UNSUPPORTED_SCHEMA" ? "UNSUPPORTED_SCHEMA" : truncated ? "TRUNCATED_LINE" : error instanceof MemoryStoreError && error.message.includes("hash") ? "BAD_HASH" : "CORRUPT_RECORD";
				this.warnings.push({
					code,
					line: index + 1,
					message: error instanceof Error ? error.message : "Memory record is invalid"
				});
				if (code === "UNSUPPORTED_SCHEMA") this.readOnly = true;
				else await this.quarantine(`${recovered ? lines.slice(index, consumed + 1).join("\n") : line}\n`, index + 1);
			}
			index = consumed + 1;
		}
		if (migrated && !this.readOnly) try {
			await this.compact();
		} catch (error) {
			this.records.clear();
			this.foreignLines = [];
			this.opened = false;
			throw error;
		}
		return this.state();
	}
	state() {
		return Object.freeze({
			scope: this.scope,
			scopeKey: this.scopeKey,
			logicalLocation: memoryLogicalLocation({
				scope: this.scope,
				scopeKey: this.scopeKey
			}),
			records: Object.freeze([...this.records.values()].map((record) => this.expiredView(record))),
			warnings: Object.freeze([...this.warnings]),
			readOnly: this.readOnly
		});
	}
	list(options = {}) {
		this.ensureOpen();
		const limit = safeLimit(options.limit, 100);
		return Object.freeze(this.all({
			...options,
			status: options.status ?? "active"
		}).slice(0, limit));
	}
	all(options = {}) {
		this.ensureOpen();
		return Object.freeze([...this.records.values()].map((record) => this.expiredView(record)).filter((record) => (options.type === void 0 || record.type === options.type) && (options.status === void 0 || record.status === options.status)).sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)));
	}
	expiredView(record) {
		const governance = record.governance;
		if (!governance || governance.verification !== "verified" || governance.expiresAt === void 0 || governance.expiresAt > this.now()) return record;
		const { pinnedAt: _pinnedAt, pinnedBy: _pinnedBy, ...withoutPin } = governance;
		return Object.freeze({
			...record,
			governance: Object.freeze({
				...withoutPin,
				verification: "stale",
				revision: governance.revision + 1
			})
		});
	}
	async upsert(draft) {
		this.ensureWritable();
		if (draft.scope !== this.scope || draft.scopeKey !== this.scopeKey) throw new MemoryStoreError("SCOPE_MISMATCH", "Memory draft scope does not match this store");
		contentText(draft.content, this.maxContentBytes);
		const id = draft.id ?? this.idFactory();
		return this.withLock(async () => {
			await this.reloadLatest();
			const contentHash = hashMemoryContent(draft.content);
			if (draft.id === void 0) {
				const exact = [...this.records.values()].find((record) => record.type === draft.type && record.contentHash === contentHash);
				if (exact) {
					const incomingRefs = draft.governance?.sourceRefs ?? [];
					const currentGovernance = exact.governance;
					const refs = currentGovernance ? [...currentGovernance.sourceRefs] : [];
					for (const incoming of incomingRefs) if (!refs.some((existing) => existing.kind === incoming.kind && existing.id === incoming.id && existing.contentHash === incoming.contentHash)) refs.push(incoming);
					if (currentGovernance && refs.length === currentGovernance.sourceRefs.length) return this.expiredView(exact);
					if (!currentGovernance && refs.length === 0) return this.expiredView(exact);
					const mergedGovernance = {
						...currentGovernance ?? draft.governance,
						sourceRefs: refs,
						revision: (currentGovernance?.revision ?? draft.governance?.revision ?? 1) + 1
					};
					const merged = validateRecord({
						...exact,
						updatedAt: this.now(),
						governance: mergedGovernance
					}, this.scope, this.scopeKey, this.maxContentBytes);
					await this.appendLocked(merged);
					this.records.set(merged.id, merged);
					return merged;
				}
			}
			const previous = this.records.get(id);
			const current = previous === void 0 ? void 0 : this.expiredView(previous);
			if (draft.expectedRevision !== void 0 || draft.expectedHash !== void 0) {
				if (draft.expectedRevision === void 0 || draft.expectedHash === void 0 || current === void 0) throw new MemoryStoreError("CONFLICT", `Memory ${id} changed before this edit`);
				if ((current.governance?.revision ?? 1) !== draft.expectedRevision || current.contentHash !== draft.expectedHash) throw new MemoryStoreError("CONFLICT", `Memory ${id} changed before this edit`);
			}
			const now = this.now();
			const record = validateRecord({
				schemaVersion: 1,
				id,
				scope: this.scope,
				scopeKey: this.scopeKey,
				type: draft.type,
				title: draft.title,
				content: draft.content,
				tags: draft.tags,
				provenance: draft.provenance,
				createdAt: draft.createdAt ?? previous?.createdAt ?? now,
				updatedAt: draft.updatedAt ?? now,
				...draft.lastUsedAt === void 0 && previous?.lastUsedAt === void 0 ? {} : { lastUsedAt: draft.lastUsedAt ?? previous?.lastUsedAt },
				useCount: draft.useCount ?? previous?.useCount ?? 0,
				contentHash,
				status: draft.status ?? "active",
				...draft.governance === void 0 && previous?.governance === void 0 ? {} : { governance: draft.governance ?? previous?.governance }
			}, this.scope, this.scopeKey, this.maxContentBytes);
			await this.appendLocked(record);
			this.records.set(record.id, record);
			return record;
		});
	}
	async archive(id) {
		return this.tombstone(id, "archived");
	}
	async forget(id) {
		return this.tombstone(id, "forgotten");
	}
	async markUsed(id) {
		this.ensureWritable();
		const current = this.require(id);
		const now = this.now();
		return await this.upsert({
			...current,
			id: current.id,
			updatedAt: now,
			lastUsedAt: now,
			useCount: current.useCount + 1,
			provenance: current.provenance,
			expectedRevision: current.governance?.revision ?? 1,
			expectedHash: current.contentHash
		});
	}
	search(query, options = {}) {
		this.ensureOpen();
		text(query, 256, "Memory query");
		const limit = safeLimit(options.limit, 100);
		return Object.freeze(this.all({
			status: options.status ?? "active",
			...options.type === void 0 ? {} : { type: options.type }
		}).filter((record) => recordRank(record, query) < 5).sort((left, right) => recordRank(left, query) - recordRank(right, query) || right.updatedAt - left.updatedAt || (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0) || left.id.localeCompare(right.id)).slice(0, limit));
	}
	async compact() {
		this.ensureWritable();
		return this.withLock(async () => {
			await this.reloadLatest();
			const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
			const backup = `${this.filePath}.bak`;
			const lines = [...this.foreignLines, ...this.records.values()].map((record) => typeof record === "string" ? record : JSON.stringify(record));
			const body = lines.join("\n") + (lines.length ? "\n" : "");
			let backupCreated = false;
			try {
				await mkdir(dirname(this.filePath), {
					recursive: true,
					mode: 448
				});
				await writeFile(temporary, body, {
					encoding: "utf8",
					mode: 384
				});
				const handle = await open(temporary, "r+");
				await handle.sync();
				await handle.close();
				try {
					await rename(this.filePath, backup);
					backupCreated = true;
				} catch (error) {
					if (error?.code !== "ENOENT") throw error;
				}
				await rename(temporary, this.filePath);
				await chmod(this.filePath, 384);
			} catch {
				try {
					await unlink(temporary);
				} catch {}
				if (backupCreated) {
					try {
						await unlink(this.filePath);
					} catch {}
					try {
						await rename(backup, this.filePath);
					} catch {}
				}
				throw new MemoryStoreError("SAVE_FAILURE", "Memory compaction failed");
			}
		});
	}
	async close() {
		this.opened = false;
		this.records.clear();
		this.foreignLines = [];
		this.warnings = [];
		this.readOnly = false;
	}
	async tombstone(id, status) {
		this.ensureWritable();
		const current = this.require(id);
		return await this.upsert({
			...current,
			id: current.id,
			status,
			updatedAt: this.now(),
			provenance: current.provenance
		});
	}
	require(id) {
		text(id, 256, "Memory id");
		const record = this.records.get(id);
		if (!record) throw new MemoryStoreError("INVALID_RECORD", "Memory record is unavailable");
		return this.expiredView(record);
	}
	ensureOpen() {
		if (!this.opened) throw new MemoryStoreError("STORE_CLOSED", "Memory store is not open");
	}
	ensureWritable() {
		this.ensureOpen();
		if (this.readOnly) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory store is read-only because its schema is newer");
	}
	async appendLocked(record) {
		try {
			await mkdir(dirname(this.filePath), {
				recursive: true,
				mode: 448
			});
			const handle = await open(this.filePath, "a", 384);
			await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
			await handle.sync();
			await handle.close();
			await chmod(this.filePath, 384);
		} catch {
			throw new MemoryStoreError("SAVE_FAILURE", "Memory record could not be saved");
		}
	}
	async reloadLatest() {
		await this.ensureSafePath();
		let source;
		try {
			source = await readFile(this.filePath, "utf8");
		} catch (error) {
			if (error?.code === "ENOENT") return;
			throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store cannot be refreshed");
		}
		const latest = new Map(this.records);
		const foreign = [];
		for (const line of source.split("\n")) {
			if (!line.trim()) continue;
			try {
				const parsed = JSON.parse(line);
				if (this.scope === "user" && parsed && typeof parsed === "object" && parsed.scope === "user" && typeof parsed.scopeKey === "string" && parsed.scopeKey !== this.scopeKey) {
					foreign.push(line.trim());
					continue;
				}
				const record = validateRecord(parsed, this.scope, this.scopeKey, this.maxContentBytes);
				latest.set(record.id, record);
			} catch {}
		}
		this.records = latest;
		if (this.scope === "user") this.foreignLines = foreign;
	}
	async withLock(operation) {
		await this.ensureSafePath();
		const lockPath = `${this.filePath}.lock`;
		let lock;
		for (let attempt = 0; attempt < 2; attempt += 1) try {
			await mkdir(dirname(this.filePath), {
				recursive: true,
				mode: 448
			});
			lock = await open(lockPath, "wx", 384);
			await lock.writeFile(`${process.pid}\n`, "utf8");
			await lock.close();
			break;
		} catch (error) {
			try {
				await lock?.close();
			} catch {}
			if (error?.code !== "EEXIST" || attempt > 0) throw new MemoryStoreError("SAVE_FAILURE", "Memory store is busy");
			try {
				const info = await stat(lockPath);
				if (Date.now() - info.mtimeMs < this.lockStaleMs) throw new MemoryStoreError("SAVE_FAILURE", "Memory store is busy");
				await unlink(lockPath);
			} catch (staleError) {
				if (staleError instanceof MemoryStoreError) throw staleError;
			}
		}
		try {
			return await operation();
		} finally {
			try {
				await unlink(lockPath);
			} catch {}
		}
	}
	async quarantine(line, lineNumber) {
		await this.ensureSafePath();
		try {
			await mkdir(dirname(this.filePath), {
				recursive: true,
				mode: 448
			});
			const quarantinePath = `${this.filePath}.corrupt`;
			const entry = JSON.stringify({
				line: lineNumber,
				capturedAt: this.now(),
				raw: line
			});
			const handle = await open(quarantinePath, "a", 384);
			await handle.writeFile(`${entry}\n`, "utf8");
			await handle.close();
			await chmod(quarantinePath, 384);
		} catch {}
	}
};
var MemoryGovernanceError = class extends Error {
	code;
	conflict;
	constructor(code, message, conflict) {
		super(message);
		this.name = "MemoryGovernanceError";
		this.code = code;
		this.conflict = conflict;
	}
};
const originFor = (record) => record.provenance.kind === "user" ? "user-authored" : record.provenance.kind === "import" ? "imported" : record.provenance.kind === "agent" ? "derived" : "derived";
const memoryRetentionForScope = (scope) => scope === "session" ? "session-end" : scope === "user" ? "user-managed" : "project-delete";
function memoryGovernance(record) {
	return record.governance ?? {
		origin: originFor(record),
		sourceRefs: record.provenance.kind === "user" ? [] : [sourceRef(record.provenance.kind === "import" ? "import" : "session", record.provenance.sessionId ?? record.id)],
		verification: record.provenance.kind === "user" ? "verified" : "unverified",
		...record.provenance.kind === "user" ? {
			verifiedAt: record.updatedAt,
			verifiedBy: "user"
		} : {},
		revision: 1,
		retention: memoryRetentionForScope(record.scope)
	};
}
function memoryGovernanceEligible(record, now = Date.now()) {
	const governance = memoryGovernance(record);
	return record.status === "active" && governance.verification === "verified" && (governance.expiresAt === void 0 || governance.expiresAt > now);
}
function assertMemoryRevision(record, expectedRevision, expectedHash) {
	const governance = memoryGovernance(record);
	if (governance.revision !== expectedRevision || record.contentHash !== expectedHash) throw new MemoryGovernanceError("CONFLICT", `Memory ${record.id} changed before this edit`, {
		code: "CONFLICT",
		id: record.id,
		currentRevision: governance.revision,
		currentHash: record.contentHash,
		expectedRevision,
		expectedHash
	});
}
function requireUser(actor) {
	if (actor !== "user") throw new MemoryGovernanceError("UNAUTHORIZED", "This Memory action requires explicit user confirmation");
}
function transitionMemoryGovernance(record, action, actor = "user", now = Date.now()) {
	const current = memoryGovernance(record);
	let next = current;
	let status = record.status;
	if (action === "verify" || action === "reverify") {
		requireUser(actor);
		if (action === "verify" && current.verification !== "unverified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only unverified Memory can be verified");
		if (action === "reverify" && current.verification !== "stale") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only stale Memory can be re-verified");
		next = {
			...current,
			verification: "verified",
			verifiedAt: now,
			verifiedBy: actor
		};
	} else if (action === "reject") {
		requireUser(actor);
		if (current.verification !== "unverified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only unverified Memory can be rejected");
		next = {
			...current,
			verification: "rejected",
			verifiedAt: void 0,
			verifiedBy: void 0
		};
	} else if (action === "stale") {
		if (current.verification !== "verified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only verified Memory can become stale");
		next = {
			...current,
			verification: "stale",
			pinnedAt: void 0,
			pinnedBy: void 0
		};
	} else if (action === "pin") {
		requireUser(actor);
		if (!memoryGovernanceEligible(record, now)) throw new MemoryGovernanceError("INELIGIBLE", "Only verified active Memory can be pinned");
		next = {
			...current,
			pinnedAt: now,
			pinnedBy: "user"
		};
	} else if (action === "unpin") {
		requireUser(actor);
		next = {
			...current,
			pinnedAt: void 0,
			pinnedBy: void 0
		};
	} else if (action === "archive") {
		requireUser(actor);
		if (record.status !== "active") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only active Memory can be archived");
		status = "archived";
		next = {
			...current,
			pinnedAt: void 0,
			pinnedBy: void 0
		};
	} else if (action === "restore") {
		requireUser(actor);
		if (record.status !== "archived") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only archived Memory can be restored");
		status = "active";
	} else if (action === "forget") {
		requireUser(actor);
		if (record.status === "forgotten") throw new MemoryGovernanceError("INVALID_TRANSITION", "Memory is already forgotten");
		status = "forgotten";
		next = {
			...current,
			pinnedAt: void 0,
			pinnedBy: void 0
		};
	}
	return Object.freeze({
		...record,
		status,
		governance: Object.freeze({
			...next,
			revision: current.revision + 1
		})
	});
}
function conflictGroupFor(title) {
	return `conflict:${createHash("sha256").update(title.trim().toLocaleLowerCase()).digest("hex").slice(0, 24)}`;
}
function sourceRef(kind, id, contentHash) {
	if (!id.trim() || /[\\/\u0000-\u001f\u007f]/u.test(id)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory source reference id is invalid");
	if (contentHash !== void 0 && !/^sha256:[0-9a-f]{64}$/u.test(contentHash)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory source reference hash is invalid");
	return Object.freeze({
		kind,
		id,
		...contentHash === void 0 ? {} : { contentHash }
	});
}
function exportMemoryBundle(records, now = Date.now()) {
	const bundle = {
		schemaVersion: 1,
		exportedAt: now,
		records: records.map((record) => ({
			...record,
			governance: memoryGovernance(record)
		}))
	};
	return JSON.stringify(bundle);
}
function importMemoryBundle(serialized, now = Date.now()) {
	if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > 8388608) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import exceeds the safe size limit");
	let parsed;
	try {
		parsed = JSON.parse(serialized);
	} catch {
		throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import is not valid JSON");
	}
	if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import bundle is invalid");
	const records = parsed.records;
	if (records.length > 1e4) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains too many records");
	return records.map((record) => {
		if (!record || typeof record !== "object" || typeof record.content !== "string" || record.contentHash !== hashMemoryContent(record.content)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import content hash is invalid");
		const governance = memoryGovernance(record);
		const sourceRefs = [...governance.sourceRefs, sourceRef("import", record.id, record.contentHash)];
		if (sourceRefs.length > 32) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import has too many source references");
		return Object.freeze({
			...record,
			id: `memory:import:${randomUUID()}`,
			status: "active",
			updatedAt: now,
			governance: {
				...governance,
				origin: "imported",
				sourceRefs,
				verification: "unverified",
				verifiedAt: void 0,
				verifiedBy: void 0,
				pinnedAt: void 0,
				pinnedBy: void 0,
				revision: 1
			}
		});
	});
}
function exportMemoryMarkdown(records, now = Date.now()) {
	const sections = records.filter((record) => record.status !== "forgotten").map((record) => {
		const governance = memoryGovernance(record);
		const meta = [
			`type: ${record.type}`,
			`scope: ${record.scope}`,
			`verification: ${governance.verification}`,
			`origin: ${governance.origin}`,
			`retention: ${governance.retention}`
		];
		if (record.tags.length > 0) meta.push(`tags: ${record.tags.join(", ")}`);
		meta.push(`updated: ${new Date(record.updatedAt).toISOString()}`);
		return `# ${record.title}\n\n${meta.join("\n")}\n\n${record.content}`;
	});
	if (sections.length === 0) return "# Workspace Memory\n\n(empty)\n";
	return `${sections.join("\n\n---\n\n")}\n`;
}
function importMemoryMarkdown(markdown, now = Date.now()) {
	if (typeof markdown !== "string" || Buffer.byteLength(markdown, "utf8") > 8388608) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import exceeds the safe size limit");
	const sections = markdown.split(/\r?\n---[ \t]*\r?\n/u);
	const records = [];
	for (const section of sections) {
		const parsed = parseMemoryMarkdownSection(section);
		if (parsed === void 0) continue;
		if (records.length >= 1e4) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains too many records");
		const { title, content, type, tags, verification, origin, retention } = parsed;
		records.push(Object.freeze({
			schemaVersion: 1,
			id: `memory:import:${randomUUID()}`,
			scope: "project",
			scopeKey: "",
			type,
			title,
			content,
			tags,
			provenance: {
				kind: "import",
				note: "markdown import"
			},
			createdAt: now,
			updatedAt: now,
			useCount: 0,
			contentHash: hashMemoryContent(content),
			status: "active",
			governance: {
				origin,
				sourceRefs: [],
				verification,
				revision: 1,
				retention
			}
		}));
	}
	if (records.length === 0) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains no records");
	return records;
}
function parseMemoryMarkdownSection(section) {
	const lines = section.split(/\r?\n/u);
	let cursor = 0;
	while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
	const titleLine = lines[cursor]?.trim();
	if (!titleLine?.startsWith("# ")) return void 0;
	const title = titleLine.slice(2).trim();
	if (!title) return void 0;
	cursor += 1;
	while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
	const meta = /* @__PURE__ */ new Map();
	while (cursor < lines.length) {
		const line = lines[cursor].trim();
		if (!line) break;
		const match = /^([A-Za-z-]+):\s*(.*)$/u.exec(line);
		if (!match) break;
		meta.set(match[1].toLowerCase(), match[2].trim());
		cursor += 1;
	}
	while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
	const content = lines.slice(cursor).join("\n").trim();
	if (!content) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory markdown record has no content");
	const type = meta.get("type") ?? "fact";
	if (!MEMORY_TYPES.includes(type)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory markdown type is invalid");
	return {
		title,
		content,
		type,
		tags: (meta.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 32),
		verification: meta.get("verification") ?? "unverified",
		origin: meta.get("origin") ?? "imported",
		retention: meta.get("retention") ?? "user-managed"
	};
}
//#endregion
//#region packages/plugin/src/domain/memory.ts
/**
* Resolve the canonical Workspace identity and Root for one agent/session.
* Shared by the Host RPC service and the memory-propose tool so both write
* through the same identity semantics.
*/
function workspaceMemoryContextFor(agent) {
	const cwd = agent.session?.header?.cwd;
	if (typeof agent.id !== "string" || !agent.id.trim() || !cwd) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
	let snapshot;
	try {
		snapshot = startWorkspace({
			sessionId: agent.id,
			processCwd: cwd
		});
	} catch (error) {
		throw new MemoryStoreError("PROJECT_UNAVAILABLE", error instanceof Error ? error.message : "Workspace Root is unavailable");
	}
	return {
		identity: snapshot.identity,
		root: resolveWorkspaceRoot(cwd, "."),
		snapshot
	};
}
const scopeNames = [
	"session",
	"project",
	"user",
	"shared-project"
];
function assertRequest(request) {
	if (!request || typeof request !== "object" || !scopeNames.includes(request.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope request is invalid");
	if (request.scope === "user") {
		if (typeof request.userId !== "string" || !request.userId.trim() || request.userId.length > 256 || /[\\/\u0000-\u001f\u007f]/u.test(request.userId)) throw new MemoryStoreError("INVALID_RECORD", "User Memory id is invalid");
		if (request.sharedProject === true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project opt-in does not apply to User Memory");
		return;
	}
	if (request.userId !== void 0) throw new MemoryStoreError("SCOPE_MISMATCH", "User Memory id does not apply to this scope");
	if (request.scope === "shared-project" && request.sharedProject !== true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project Memory requires explicit opt-in");
	if (request.scope !== "shared-project" && request.sharedProject === true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project opt-in does not apply to this scope");
}
function assertWritableRequest(request) {
	if (request.scope === "shared-project" && request.sharedWriteAcknowledged !== true) throw new MemoryGovernanceError("UNAUTHORIZED", "Shared Project Memory writes require explicit acknowledgement");
}
function locationFor(context, request, dshHome) {
	assertRequest(request);
	if (!context || !context.identity?.sessionId || !context.identity.rootId) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace identity is unavailable");
	if ((request.scope === "project" || request.scope === "shared-project") && (typeof context.root !== "string" || !context.root.trim())) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Root is unavailable");
	const scopeKey = request.scope === "session" ? `${context.identity.sessionId}|${context.identity.rootId}` : request.scope === "user" ? request.userId : context.identity.rootId;
	const options = {
		scope: request.scope,
		scopeKey,
		projectRoot: request.scope === "project" || request.scope === "shared-project" ? context.root : void 0,
		dshHome: request.scope === "session" || request.scope === "user" ? dshHome : void 0
	};
	return {
		key: `${request.scope}:${scopeKey}:${memoryStorePath(options)}`,
		options
	};
}
var WorkspaceMemoryDomain = class {
	stores = /* @__PURE__ */ new Map();
	dshHome;
	constructor(dshHome = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh")) {
		this.dshHome = dshHome;
	}
	async open(context, request) {
		const location = locationFor(context, request, this.dshHome);
		let store = this.stores.get(location.key);
		if (!store) {
			store = new MemoryStore(location.options);
			this.stores.set(location.key, store);
		}
		const state = await store.open();
		return Object.freeze({
			...state,
			records: Object.freeze(this.withConflictGroups(state.records))
		});
	}
	async list(context, request, options = {}) {
		const store = await this.store(context, request);
		return this.withConflictGroups(store.list(options));
	}
	async upsert(context, request, draft) {
		assertWritableRequest(request);
		const store = await this.store(context, request);
		const previous = draft.id === void 0 ? void 0 : store.all().find((record) => record.id === draft.id);
		if (previous) {
			if (draft.expectedRevision === void 0 || draft.expectedHash === void 0) throw new MemoryGovernanceError("CONFLICT", `Memory ${previous.id} requires a revision and content hash`);
			assertMemoryRevision(previous, draft.expectedRevision, draft.expectedHash);
		}
		const duplicate = draft.id === void 0 && store.all({ type: draft.type }).find((record) => record.title.trim().toLocaleLowerCase() === draft.title.trim().toLocaleLowerCase() && record.contentHash !== hashMemoryContent(draft.content));
		const currentGovernance = previous ? memoryGovernance(previous) : void 0;
		const changed = previous !== void 0 && (previous.title !== draft.title || previous.content !== draft.content || previous.type !== draft.type || JSON.stringify(previous.tags) !== JSON.stringify(draft.tags) || JSON.stringify(previous.provenance) !== JSON.stringify(draft.provenance));
		const editedGovernance = currentGovernance === void 0 ? void 0 : {
			...currentGovernance,
			verification: changed && currentGovernance.verification === "verified" ? "stale" : currentGovernance.verification,
			...changed ? {
				verifiedAt: void 0,
				verifiedBy: void 0,
				pinnedAt: void 0,
				pinnedBy: void 0
			} : {},
			revision: currentGovernance.revision + 1
		};
		const retention = memoryRetentionForScope(request.scope);
		const newGovernance = draft.governance ? {
			...draft.governance,
			verification: "unverified",
			verifiedAt: void 0,
			verifiedBy: void 0,
			pinnedAt: void 0,
			pinnedBy: void 0,
			revision: 1,
			retention,
			...duplicate ? { conflictGroup: conflictGroupFor(draft.title) } : {}
		} : {
			origin: "user-authored",
			sourceRefs: [],
			verification: "unverified",
			revision: 1,
			retention,
			...duplicate ? { conflictGroup: conflictGroupFor(draft.title) } : {}
		};
		const governance = previous ? editedGovernance : newGovernance;
		try {
			return await store.upsert({
				...draft,
				...governance === void 0 ? {} : { governance }
			});
		} catch (error) {
			if (error instanceof MemoryStoreError && error.code === "CONFLICT") {
				const current = draft.id === void 0 ? void 0 : store.all().find((record) => record.id === draft.id);
				if (current && draft.expectedRevision !== void 0 && draft.expectedHash !== void 0) {
					const currentGovernance = memoryGovernance(current);
					throw new MemoryGovernanceError("CONFLICT", error.message, {
						code: "CONFLICT",
						id: current.id,
						currentRevision: currentGovernance.revision,
						currentHash: current.contentHash,
						expectedRevision: draft.expectedRevision,
						expectedHash: draft.expectedHash
					});
				}
				throw new MemoryGovernanceError("CONFLICT", error.message);
			}
			throw error;
		}
	}
	async archive(context, request, id) {
		assertWritableRequest(request);
		return (await this.store(context, request)).archive(id);
	}
	async forget(context, request, id) {
		assertWritableRequest(request);
		return (await this.store(context, request)).forget(id);
	}
	async search(context, request, query, options = {}) {
		const store = await this.store(context, request);
		return this.withConflictGroups(store.search(query, options));
	}
	async markUsed(context, request, id) {
		assertWritableRequest(request);
		return (await this.store(context, request)).markUsed(id);
	}
	async govern(context, request, id, action, expectedRevision, expectedHash) {
		assertWritableRequest(request);
		const store = await this.store(context, request);
		const current = store.all().find((record) => record.id === id);
		if (!current) throw new MemoryStoreError("INVALID_RECORD", "Memory record is unavailable");
		assertMemoryRevision(current, expectedRevision, expectedHash);
		let next;
		try {
			next = transitionMemoryGovernance(current, action, "user");
		} catch (error) {
			if (error instanceof MemoryGovernanceError) throw error;
			throw new MemoryStoreError("INVALID_RECORD", "Memory governance transition failed");
		}
		return store.upsert({
			scope: current.scope,
			scopeKey: current.scopeKey,
			type: current.type,
			title: current.title,
			content: current.content,
			tags: current.tags,
			provenance: current.provenance,
			id: current.id,
			createdAt: current.createdAt,
			updatedAt: Date.now(),
			lastUsedAt: current.lastUsedAt,
			useCount: current.useCount,
			status: next.status,
			governance: next.governance,
			expectedRevision,
			expectedHash
		});
	}
	async export(context, request) {
		const store = await this.store(context, request);
		return exportMemoryBundle(this.withConflictGroups(store.all().filter((record) => record.status !== "forgotten")));
	}
	async exportMarkdown(context, request) {
		const store = await this.store(context, request);
		return exportMemoryMarkdown(this.withConflictGroups(store.all().filter((record) => record.status !== "forgotten")));
	}
	async import(context, request, serialized) {
		return this.persistImported(context, request, importMemoryBundle(serialized));
	}
	async importMarkdown(context, request, markdown) {
		return this.persistImported(context, request, importMemoryMarkdown(markdown));
	}
	async persistImported(context, request, imported) {
		assertWritableRequest(request);
		const store = await this.store(context, request);
		const saved = [];
		for (const record of imported) saved.push(await store.upsert({
			scope: store.scope,
			scopeKey: store.scopeKey,
			type: record.type,
			title: record.title,
			content: record.content,
			tags: record.tags,
			provenance: {
				kind: "import",
				note: "v0.5 import"
			},
			createdAt: record.createdAt,
			updatedAt: Date.now(),
			status: record.status,
			governance: {
				...memoryGovernance(record),
				retention: memoryRetentionForScope(store.scope)
			}
		}));
		return saved;
	}
	async close(context, request) {
		const location = locationFor(context, request, this.dshHome);
		const store = this.stores.get(location.key);
		if (!store) return;
		this.stores.delete(location.key);
		await store.close();
	}
	async dispose() {
		const stores = [...this.stores.values()];
		this.stores.clear();
		await Promise.all(stores.map((store) => store.close()));
	}
	withConflictGroups(records) {
		const groups = /* @__PURE__ */ new Map();
		for (const record of records) {
			const key = `${record.type}:${record.title.trim().toLocaleLowerCase()}`;
			groups.set(key, [...groups.get(key) ?? [], record]);
		}
		return records.map((record) => {
			const key = `${record.type}:${record.title.trim().toLocaleLowerCase()}`;
			const group = groups.get(key) ?? [];
			if (new Set(group.map((candidate) => candidate.contentHash)).size < 2) return record;
			const governance = memoryGovernance(record);
			return Object.freeze({
				...record,
				governance: Object.freeze({
					...governance,
					conflictGroup: governance.conflictGroup ?? conflictGroupFor(record.title)
				})
			});
		});
	}
	async store(context, request) {
		const location = locationFor(context, request, this.dshHome);
		await this.open(context, request);
		return this.stores.get(location.key);
	}
};
//#endregion
//#region packages/plugin/src/domain/git.ts
const execFileAsync = promisify(execFile);
var GitError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "GitError";
		this.code = code;
	}
};
const GIT_MAX_DIFF_BYTES = 524288;
/** Operational Budget: commit list pagination cap (research #122). */
const GIT_HISTORY_MAX_COMMITS = 200;
/** Operational Budget: per-commit diff cap (half of GIT_MAX_DIFF_BYTES, research #122). */
const GIT_COMMIT_MAX_DIFF_BYTES = 262144;
const GIT_TIMEOUT_MS = 1e4;
function statusCode(status) {
	if (status.startsWith("?") || status === "??") return "untracked";
	if (status.startsWith("A")) return "added";
	if (status.startsWith("D")) return "deleted";
	if (status.startsWith("R")) return "renamed";
	if (status.startsWith("C")) return "copied";
	if (status.startsWith("U") || status.includes("U")) return "unmerged";
	if (status.startsWith("T")) return "typechange";
	return "modified";
}
function isGitError(error) {
	return error instanceof Error && error.code === "GIT_UNAVAILABLE";
}
/** Run git inside `root`, mapping process failures to typed GitError codes. */
async function runGit(root, args) {
	let output;
	try {
		const { stdout } = await execFileAsync("git", [...args], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: GIT_MAX_DIFF_BYTES,
			timeout: GIT_TIMEOUT_MS,
			windowsHide: true
		});
		output = stdout;
	} catch (error) {
		if (error instanceof Error && "killed" in error && error.killed) throw new GitError("GIT_TIMEOUT", "git did not respond in time");
		if (error instanceof Error && error.code === "ENOENT") throw new GitError("GIT_UNAVAILABLE", "git is not available");
		const message = error instanceof Error ? error.message : String(error);
		if (/not a git repository/i.test(message)) throw new GitError("NOT_A_GIT_REPOSITORY", "Workspace Root is not a git repository");
		if (/maximum buffer size/i.test(message)) throw new GitError("GIT_OUTPUT_TOO_LARGE", "git output exceeded the safe limit");
		throw new GitError("GIT_UNAVAILABLE", message);
	}
	return output;
}
/** Parse `git status --porcelain=v1 -z` output into typed, deduplicated changes. */
function parsePorcelain(output) {
	const changes = [];
	const fields = output.split("\0");
	for (let index = 0; index < fields.length; index += 1) {
		const field = fields[index];
		if (!field || field.length < 3) continue;
		const xy = field.slice(0, 2);
		let rawPath = field.slice(3);
		const indexStatus = xy[0];
		const worktreeStatus = xy[1];
		if (indexStatus === "R" || indexStatus === "C") {
			const destination = fields[index + 1];
			if (destination) {
				const previous = normalizeWorkspacePath(rawPath);
				const current = normalizeWorkspacePath(destination);
				changes.push({
					path: current,
					previousPath: previous,
					status: statusCode(xy),
					staged: true
				});
				index += 1;
				continue;
			}
		}
		const path = normalizeWorkspacePath(rawPath);
		if (!path) continue;
		changes.push({
			path,
			status: statusCode(xy),
			staged: indexStatus !== "?" && indexStatus !== " " && worktreeStatus === " "
		});
	}
	return changes;
}
/** Current repository status (working-tree + staged), bounded and read-only. */
async function gitStatus(root) {
	if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
	return parsePorcelain(await runGit(root, [
		"status",
		"--porcelain=v1",
		"-z"
	]));
}
function assertDiffPath(pathInput) {
	if (pathInput === void 0) return void 0;
	try {
		const path = normalizeWorkspacePath(pathInput);
		if (!path) throw new GitError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
		return path;
	} catch (error) {
		if (error instanceof GitError) throw error;
		throw new GitError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
	}
}
async function boundedDiff(root, args, maxBytes = GIT_MAX_DIFF_BYTES) {
	let output = await runGit(root, args);
	let truncated = false;
	if (Buffer.byteLength(output, "utf8") > maxBytes) {
		output = output.slice(0, maxBytes);
		truncated = true;
	}
	return {
		text: output,
		truncated
	};
}
/** Unified diff for one path (or the whole tree): staged (`--cached`) and unstaged. */
async function gitDiff(root, pathInput) {
	if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
	const path = assertDiffPath(pathInput);
	const pathArgs = path === void 0 ? [] : ["--", path];
	const [staged, unstaged] = await Promise.all([boundedDiff(root, [
		"diff",
		"--cached",
		...pathArgs
	]), boundedDiff(root, ["diff", ...pathArgs])]);
	return Object.freeze({
		...path === void 0 ? {} : { path },
		staged: staged.text,
		unstaged: unstaged.text,
		truncated: staged.truncated || unstaged.truncated
	});
}
/** Lazy repository check that fails closed with a typed error. */
async function isGitRepository(root) {
	try {
		await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
		return true;
	} catch (error) {
		if (isGitError(error) || error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY") return false;
		throw error;
	}
}
/** Record delimiter for git log --pretty output (research #122: no whitespace splitting). */
const GIT_LOG_RECORD = "";
/** Field delimiter inside one git log record. */
const GIT_LOG_FIELD = "";
/**
* Commit list newest-first with author / time / subject / parents / branch
* decoration. Delimiter-based (`%x1f` fields, `%x1e` records) so authors and
* subjects with spaces parse cleanly; `parents` (`%P`) is captured now so the
* data shape is forward-compatible with the v0.8 branch graph (research #122).
*/
async function gitHistory(root, options = {}) {
	if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
	const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 200), 200));
	const offset = Math.max(0, Math.trunc(options.offset ?? 0));
	const format = `%H${GIT_LOG_FIELD}%P${GIT_LOG_FIELD}%an${GIT_LOG_FIELD}%at${GIT_LOG_FIELD}%s${GIT_LOG_FIELD}%D${GIT_LOG_RECORD}`;
	const output = await runGit(root, [
		"log",
		...options.scope === "localBranches" ? ["--branches", "--topo-order"] : ["--topo-order"],
		"--max-count",
		String(limit),
		"--skip",
		String(offset),
		`--pretty=format:${format}`,
		"--decorate=short"
	]);
	const commits = [];
	for (const record of output.split(GIT_LOG_RECORD)) {
		const trimmed = record.trim();
		if (!trimmed) continue;
		const [sha, parents, author, time, subject, decorations] = trimmed.split(GIT_LOG_FIELD);
		if (!sha) continue;
		commits.push(Object.freeze({
			sha,
			parents: Object.freeze(parents ? parents.split(" ") : []),
			author: author ?? "",
			time: Number(time) || 0,
			subject: subject ?? "",
			decorations: decorations ?? ""
		}));
	}
	return Object.freeze(commits);
}
/**
* One commit: parsed metadata, `--numstat` file stats, and a bounded unified
* diff (`git show --format=`). The diff is sliced to GIT_COMMIT_MAX_DIFF_BYTES
* and flagged `diffTruncated` when the budget trips.
*/
async function gitCommit(root, sha) {
	if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
	if (typeof sha !== "string" || !sha.trim()) throw new GitError("GIT_UNAVAILABLE", "Commit is unavailable");
	const [full, parents, author, time, subject, decorations] = (await runGit(root, [
		"log",
		"-1",
		`--pretty=format:${`%H${GIT_LOG_FIELD}%P${GIT_LOG_FIELD}%an${GIT_LOG_FIELD}%at${GIT_LOG_FIELD}%s${GIT_LOG_FIELD}%D`}`,
		"--decorate=short",
		sha
	])).trim().split(GIT_LOG_FIELD);
	if (!full) throw new GitError("GIT_UNAVAILABLE", "Commit is unavailable");
	const files = [];
	const stats = await runGit(root, [
		"diff-tree",
		"--root",
		"--no-commit-id",
		"--numstat",
		"-r",
		sha
	]);
	for (const line of stats.split("\n")) {
		if (!line.trim()) continue;
		const [additions, deletions, ...rest] = line.split("	");
		const path = rest.join("	");
		if (!path) continue;
		const additionsCount = additions && additions !== "-" ? Number(additions) : 0;
		const deletionsCount = deletions && deletions !== "-" ? Number(deletions) : 0;
		files.push(Object.freeze({
			path,
			additions: Number.isFinite(additionsCount) ? additionsCount : 0,
			deletions: Number.isFinite(deletionsCount) ? deletionsCount : 0
		}));
	}
	const { text, truncated } = await boundedDiff(root, [
		"show",
		"--format=",
		sha
	], GIT_COMMIT_MAX_DIFF_BYTES);
	return Object.freeze({
		commit: Object.freeze({
			sha: full,
			parents: Object.freeze(parents ? parents.split(" ") : []),
			author: author ?? "",
			time: Number(time) || 0,
			subject: subject ?? "",
			decorations: decorations ?? ""
		}),
		files: Object.freeze(files),
		diff: text,
		diffTruncated: truncated
	});
}
/**
* HEAD + active branch + ahead/behind vs the upstream. Degrades to
* `{ isGit: false }` outside a repository (never throws for non-git); a
* missing upstream yields ahead=behind=0 rather than an error.
*/
async function gitRepoInfo(root) {
	if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
	let inTree;
	try {
		inTree = (await runGit(root, ["rev-parse", "--is-inside-work-tree"])).trim();
	} catch (error) {
		if (error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY") return Object.freeze({
			isGit: false,
			branch: "",
			head: "",
			ahead: 0,
			behind: 0
		});
		throw error;
	}
	if (inTree !== "true") return Object.freeze({
		isGit: false,
		branch: "",
		head: "",
		ahead: 0,
		behind: 0
	});
	let branch = "";
	try {
		branch = (await runGit(root, [
			"rev-parse",
			"--abbrev-ref",
			"HEAD"
		])).trim();
	} catch {
		branch = "";
	}
	let head = "";
	try {
		head = (await runGit(root, [
			"rev-parse",
			"--short",
			"HEAD"
		])).trim();
	} catch {
		head = "";
	}
	let ahead = 0;
	let behind = 0;
	try {
		const [left, right] = (await runGit(root, [
			"rev-list",
			"--left-right",
			"--count",
			"HEAD...@{u}"
		])).trim().split(/\s+/u);
		ahead = Number(left) || 0;
		behind = Number(right) || 0;
	} catch {
		ahead = 0;
		behind = 0;
	}
	return Object.freeze({
		isGit: true,
		branch,
		head,
		ahead,
		behind
	});
}
//#endregion
//#region packages/plugin/src/domain/activity.ts
var ActivityProjectionError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ActivityProjectionError";
	}
};
function sameIdentity$1(left, right) {
	return left.sessionId === right.sessionId && left.rootId === right.rootId;
}
function assertIdentity(expected, actual) {
	if (!sameIdentity$1(expected, actual)) throw new ActivityProjectionError("Workspace identity does not match");
}
function attributionStrength(value) {
	return {
		unknown: 0,
		"session-observed": 1,
		"pre-existing": 2,
		"agent-evidenced": 3
	}[value];
}
function initialProjection(identity) {
	return {
		identity,
		evidence: [],
		files: /* @__PURE__ */ new Map()
	};
}
function recordActivity(projection, observation) {
	const current = projection ?? initialProjection(observation.identity);
	assertIdentity(current.identity, observation.identity);
	if (typeof observation.id !== "string" || !observation.id.trim()) throw new ActivityProjectionError("Activity evidence requires an id");
	const path = normalizeWorkspacePath(observation.path);
	const evidence = {
		...observation,
		path
	};
	if (current.evidence.some((item) => item.id === evidence.id)) return current;
	const previous = current.files.get(path);
	const latest = previous === void 0 || evidence.observedAt >= previous.lastObservedAt;
	const attribution = previous && attributionStrength(previous.attribution) > attributionStrength(evidence.attribution) ? previous.attribution : evidence.attribution;
	const next = {
		path,
		firstObservedAt: previous ? Math.min(previous.firstObservedAt, evidence.observedAt) : evidence.observedAt,
		lastObservedAt: previous ? Math.max(previous.lastObservedAt, evidence.observedAt) : evidence.observedAt,
		observations: (previous?.observations ?? 0) + 1,
		current: latest ? evidence.kind === "DELETED" ? "deleted" : "present" : previous.current,
		lastKind: latest ? evidence.kind : previous.lastKind,
		attribution: latest ? attribution : previous.attribution,
		createdInSession: (previous?.createdInSession ?? false) || evidence.kind === "CREATED" && evidence.attribution !== "pre-existing" && evidence.attribution !== "unknown",
		previewable: (previous?.previewable ?? false) || evidence.previewable === true
	};
	const files = new Map(current.files);
	files.set(path, next);
	return {
		identity: current.identity,
		evidence: [...current.evidence, evidence],
		files
	};
}
function reduceActivity(identity, observations) {
	return observations.reduce((current, item) => recordActivity(current, item), initialProjection(identity));
}
function deriveArtifacts(projection) {
	return [...projection.files.values()].filter((file) => file.createdInSession && (file.current === "present" || file.current === "deleted") && (file.attribution === "agent-evidenced" || file.attribution === "session-observed")).map((file) => ({
		path: file.path,
		createdAt: Math.min(...projection.evidence.filter((item) => item.path === file.path && item.kind === "CREATED").map((item) => item.observedAt)),
		...file.current === "deleted" ? { deleted: true } : {}
	})).sort((left, right) => left.path.localeCompare(right.path));
}
//#endregion
//#region packages/plugin/src/domain/deliverable.ts
var WorkspaceDeliverableError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "WorkspaceDeliverableError";
	}
};
function assertText(value, label, max) {
	if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new WorkspaceDeliverableError(`${label} is invalid`);
}
function opaqueId(source, path) {
	return `workspace:${createHash("sha256").update(`${source.sessionId}:${source.workspaceId}:${path}`).digest("hex").slice(0, 32)}`;
}
function mediaExtension(mediaType) {
	return mediaType === "application/pdf" ? ".pdf" : mediaType === "application/octet-stream" ? ".bin" : "";
}
/** Return a single safe basename suitable for Content-Disposition. */
function safeDownloadName(pathInput, mediaType = "application/octet-stream") {
	let path;
	try {
		path = normalizeWorkspacePath(pathInput);
	} catch {
		throw new WorkspaceDeliverableError("Download name source path is invalid");
	}
	const name = basename(path).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, "_").trim().replace(/^[. ]+|[. ]+$/gu, "") || `workspace-download${mediaExtension(mediaType)}`;
	if (name === "." || name === "..") throw new WorkspaceDeliverableError("Download name is invalid");
	return name.slice(0, 180);
}
function previewState(descriptor) {
	if (descriptor.type === "error") {
		if (descriptor.code === "FILE_NOT_FOUND") return "deleted";
		if (descriptor.code === "FILE_TOO_LARGE") return "oversized";
		if (descriptor.code === "RESOURCE_STALE") return "stale";
		if (descriptor.code === "INVALID_JSON" || descriptor.code === "INVALID_CSV") return "parse-error";
		if (descriptor.code === "PERMISSION_DENIED" || descriptor.code === "PROVIDER_UNAVAILABLE") return "unavailable";
		return "unsupported";
	}
	if (descriptor.type === "unsupported") return descriptor.reason.includes("large") ? "oversized" : "unsupported";
	return "available";
}
function previewMediaType(descriptor, fallback) {
	if (descriptor.type === "binary" || descriptor.type === "unsupported") return descriptor.mediaType ?? "application/octet-stream";
	if (descriptor.type === "error") return fallback ?? "text/plain";
	if (descriptor.type === "markdown") return "text/markdown";
	if (descriptor.type === "json") return "application/json";
	if (descriptor.type === "csv") return "text/csv";
	return "text/plain";
}
/** Build bounded metadata without copying preview bytes into the envelope. */
function createWorkspaceDeliverable(descriptor, source, sizeBytes, options = {}) {
	if (!descriptor || typeof descriptor !== "object" || !source || typeof source !== "object" || !options || typeof options !== "object") throw new WorkspaceDeliverableError("Deliverable metadata is invalid");
	assertText(source.sessionId, "Source session", 256);
	assertText(source.workspaceId, "Source workspace", 256);
	if (source.kind !== "artifact" && source.kind !== "file") throw new WorkspaceDeliverableError("Source kind is invalid");
	if (options.name !== void 0) assertText(options.name, "Deliverable name", 256);
	if (options.mediaType !== void 0) assertText(options.mediaType, "Deliverable media type", 256);
	if (options.version !== void 0) assertText(options.version, "Deliverable version", 512);
	if (options.logicalPath !== void 0) {
		assertText(options.logicalPath, "Deliverable logical path", 4096);
		try {
			if (normalizeWorkspacePath(options.logicalPath) !== options.logicalPath) throw new Error();
		} catch {
			throw new WorkspaceDeliverableError("Deliverable logical path is invalid");
		}
	}
	if (options.mtimeMs !== void 0 && (typeof options.mtimeMs !== "number" || !Number.isFinite(options.mtimeMs) || options.mtimeMs < 0)) throw new WorkspaceDeliverableError("Deliverable mtime is invalid");
	let path;
	if ("path" in descriptor) {
		assertText(descriptor.path, "Descriptor path", 4096);
		try {
			path = normalizeWorkspacePath(descriptor.path);
		} catch {
			throw new WorkspaceDeliverableError("Descriptor path is invalid");
		}
	}
	const logicalPath = path ?? (options.logicalPath === void 0 ? void 0 : normalizeWorkspacePath(options.logicalPath));
	if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new WorkspaceDeliverableError("Deliverable size is invalid");
	const mediaType = previewMediaType(descriptor, options.mediaType);
	const resourceId = descriptor.type === "binary" ? descriptor.resourceId : void 0;
	const version = descriptor.type === "binary" ? descriptor.version : options.version;
	let name = logicalPath ? basename(logicalPath) || "workspace-file" : "workspace-file";
	if (!path && options.name) try {
		name = basename(normalizeWorkspacePath(options.name)) || "workspace-file";
	} catch {
		throw new WorkspaceDeliverableError("Deliverable name is invalid");
	}
	const id = resourceId ? `workspace:${resourceId}` : opaqueId(source, logicalPath ?? name);
	return Object.freeze({
		id,
		name,
		...logicalPath === void 0 ? {} : { logicalPath },
		mediaType,
		sizeBytes,
		...version === void 0 ? {} : { version },
		source: Object.freeze({ ...source }),
		preview: previewState(descriptor),
		...resourceId === void 0 ? {} : { resourceId },
		downloadName: safeDownloadName(path ?? name, mediaType),
		...mediaType.startsWith("image/") ? { altText: name } : {},
		...options.mtimeMs === void 0 ? {} : { mtimeMs: options.mtimeMs }
	});
}
function deliverableResourceId(descriptor) {
	return descriptor.type === "binary" ? descriptor.resourceId : void 0;
}
//#endregion
//#region packages/plugin/src/domain/preview.ts
const mib = 1048576;
const defaultResourceTtlMs = 6e4;
const defaultLimits = {
	maxTextBytes: 2 * mib,
	maxJsonBytes: 5 * mib,
	maxCsvBytes: 10 * mib,
	maxCsvRows: 1e3,
	maxImageBytes: 20 * mib,
	maxPdfBytes: 50 * mib
};
const hardLimits = {
	maxTextBytes: 8 * mib,
	maxJsonBytes: 16 * mib,
	maxCsvBytes: 32 * mib,
	maxCsvRows: 1e4,
	maxImageBytes: 64 * mib,
	maxPdfBytes: 128 * mib
};
const binaryExtensions = /* @__PURE__ */ new Set([
	".7z",
	".avi",
	".bin",
	".doc",
	".docx",
	".gz",
	".mp3",
	".mp4",
	".odt",
	".ppt",
	".pptx",
	".tar",
	".wav",
	".xls",
	".xlsx",
	".zip"
]);
const imageTypes = {
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp"
};
var PreviewPanelError = class extends Error {
	code;
	constructor(code, message = code) {
		super(message);
		this.name = "PreviewPanelError";
		this.code = code;
	}
};
function sameIdentity(left, right) {
	return left.sessionId === right.sessionId && left.rootId === right.rootId;
}
function safeError(error) {
	if (error instanceof PreviewPanelError) return error;
	const code = error?.code;
	if (code === "ENOENT") return new PreviewPanelError("FILE_NOT_FOUND", "File is unavailable");
	if (code === "EACCES" || code === "EPERM") return new PreviewPanelError("PERMISSION_DENIED", "File access is denied");
	return new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview provider is unavailable");
}
function descriptorError(error) {
	const safe = safeError(error);
	return {
		type: "error",
		code: safe.code,
		message: safe.message
	};
}
function languageFor(path) {
	return {
		".css": "css",
		".html": "html",
		".js": "javascript",
		".json": "json",
		".md": "markdown",
		".py": "python",
		".rs": "rust",
		".sh": "shell",
		".sql": "sql",
		".ts": "typescript",
		".tsx": "typescriptreact",
		".yaml": "yaml",
		".yml": "yaml"
	}[extname(path).toLowerCase()];
}
function mediaTypeFor(path) {
	const extension = extname(path).toLowerCase();
	if (imageTypes[extension]) return imageTypes[extension];
	if (extension === ".pdf") return "application/pdf";
	if (extension === ".svg") return "image/svg+xml";
	if (extension === ".json") return "application/json";
	if (extension === ".csv") return "text/csv";
	if (extension === ".md") return "text/markdown";
	if (binaryExtensions.has(extension)) return "application/octet-stream";
	return "text/plain";
}
function resourceName(path, mediaType) {
	const raw = basename(path).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, "_").replace(/[^\x20-\x7e]/gu, "_").trim().replace(/^[. ]+|[. ]+$/gu, "");
	if (raw) return raw.slice(0, 180);
	return mediaType === "application/pdf" ? "workspace-download.pdf" : "workspace-download.bin";
}
function versionFor(info) {
	return `${info.size}:${info.mtimeMs}:${info.ctimeMs}:${info.ino ?? 0}`;
}
function boundedLimit(value, fallback, ceiling) {
	return Number.isSafeInteger(value) && value > 0 ? Math.min(value, ceiling) : fallback;
}
function resolveLimits(overrides) {
	return {
		maxTextBytes: boundedLimit(overrides?.maxTextBytes, defaultLimits.maxTextBytes, hardLimits.maxTextBytes),
		maxJsonBytes: boundedLimit(overrides?.maxJsonBytes, defaultLimits.maxJsonBytes, hardLimits.maxJsonBytes),
		maxCsvBytes: boundedLimit(overrides?.maxCsvBytes, defaultLimits.maxCsvBytes, hardLimits.maxCsvBytes),
		maxCsvRows: boundedLimit(overrides?.maxCsvRows, defaultLimits.maxCsvRows, hardLimits.maxCsvRows),
		maxImageBytes: boundedLimit(overrides?.maxImageBytes, defaultLimits.maxImageBytes, hardLimits.maxImageBytes),
		maxPdfBytes: boundedLimit(overrides?.maxPdfBytes, defaultLimits.maxPdfBytes, hardLimits.maxPdfBytes)
	};
}
function resolveResourceTtl(value) {
	return Number.isSafeInteger(value) && value > 0 ? value : defaultResourceTtlMs;
}
function assertNotAborted(signal) {
	if (signal?.aborted) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource request was cancelled");
}
async function readHandle(handle, maxBytes, expectedVersion, signal) {
	assertNotAborted(signal);
	const info = await handle.stat();
	if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview target is not a file");
	const initialVersion = versionFor(info);
	if (expectedVersion !== void 0 && initialVersion !== expectedVersion) throw new PreviewPanelError("RESOURCE_STALE", "Resource is stale");
	const bytes = Buffer.alloc(Math.min(info.size, maxBytes + 1));
	let bytesRead = 0;
	while (bytesRead < bytes.length) {
		assertNotAborted(signal);
		const result = await handle.read(bytes, bytesRead, Math.min(1048576, bytes.length - bytesRead), bytesRead);
		bytesRead += result.bytesRead;
		if (result.bytesRead === 0) break;
	}
	assertNotAborted(signal);
	const after = await handle.stat();
	if (versionFor(after) !== initialVersion) throw new PreviewPanelError("RESOURCE_STALE", "Preview changed during read");
	return {
		bytes: bytes.subarray(0, bytesRead),
		size: after.size,
		version: initialVersion
	};
}
async function readBounded(path, maxBytes, expectedCanonicalPath, expectedVersion, signal) {
	let handle;
	try {
		assertNotAborted(signal);
		handle = await open(path, "r");
		if (await realpath(path) !== expectedCanonicalPath) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
		const read = await readHandle(handle, maxBytes, expectedVersion, signal);
		try {
			if (await realpath(path) !== expectedCanonicalPath) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
		} catch (error) {
			if (error instanceof PreviewPanelError) throw error;
			throw new PreviewPanelError("RESOURCE_STALE", "Workspace Path changed during read");
		}
		return read;
	} finally {
		await handle?.close();
	}
}
function textFrom(bytes) {
	return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
function inspectJson(value, depth = 0, state = { nodes: 0 }) {
	state.nodes += 1;
	if (depth > 64 || state.nodes > 1e4) throw new PreviewPanelError("INVALID_JSON", "JSON structure exceeds its safety limit");
	if (Array.isArray(value)) for (const item of value) inspectJson(item, depth + 1, state);
	else if (value !== null && typeof value === "object") for (const item of Object.values(value)) inspectJson(item, depth + 1, state);
}
function parseCsv(text, maxRows) {
	const rows = [];
	let row = [];
	let cell = "";
	let quoted = false;
	let closedQuote = false;
	let truncated = false;
	const pushRow = () => {
		if (row.length > 256 || cell.length > mib) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
		row.push(cell);
		cell = "";
		if (rows.length < maxRows + 1) rows.push(row);
		else truncated = true;
		row = [];
	};
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quoted) {
			if (character === "\"" && text[index + 1] === "\"") index += 1;
			else if (character === "\"") {
				quoted = false;
				closedQuote = true;
			} else cell += character;
		} else if (closedQuote) {
			if (character === ",") {
				if (row.length >= 256) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
				row.push(cell);
				cell = "";
				closedQuote = false;
			} else if (character === "\n") {
				pushRow();
				closedQuote = false;
			} else if (character === "\r" && text[index + 1] === "\n") continue;
			else if (character !== "\r") throw new PreviewPanelError("INVALID_CSV", "CSV contains trailing characters after a quote");
		} else if (character === "\"" && cell.length === 0) quoted = true;
		else if (character === "\"") throw new PreviewPanelError("INVALID_CSV", "CSV contains a quote inside an unquoted field");
		else if (character === ",") {
			if (row.length >= 256) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
			row.push(cell);
			cell = "";
		} else if (character === "\n") pushRow();
		else if (character !== "\r") cell += character;
		if (cell.length > mib) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
	}
	if (quoted) throw new PreviewPanelError("INVALID_CSV", "CSV contains an unclosed quote");
	if (cell.length > 0 || row.length > 0) pushRow();
	return {
		columns: rows.shift() ?? [],
		rows: rows.slice(0, maxRows),
		truncated: truncated || rows.length > maxRows
	};
}
var PreviewService = class {
	root;
	identity;
	limits;
	resourceTtlMs;
	now;
	resources = /* @__PURE__ */ new Map();
	disposed = false;
	constructor(root, identity, options = {}) {
		this.root = root;
		this.identity = identity;
		this.limits = resolveLimits(options.limits);
		this.resourceTtlMs = resolveResourceTtl(options.resourceTtlMs);
		this.now = options.now ?? Date.now;
	}
	async preview(pathInput) {
		try {
			const resolved = await this.resolve(pathInput);
			const extension = extname(resolved.path).toLowerCase();
			if (extension === ".svg") return {
				type: "unsupported",
				path: resolved.path,
				reason: "svg-sanitization-required",
				mediaType: "image/svg+xml"
			};
			if (imageTypes[extension] || extension === ".pdf") return await this.binary(resolved);
			if (binaryExtensions.has(extension)) {
				const info = await stat(resolved.canonicalPath);
				return {
					type: "unsupported",
					path: resolved.path,
					reason: "unsupported-binary",
					mediaType: "application/octet-stream",
					size: info.size
				};
			}
			if (extension === ".json") return await this.json(resolved);
			if (extension === ".csv") return await this.csv(resolved);
			const read = await readBounded(resolved.canonicalPath, this.limits.maxTextBytes, resolved.canonicalPath);
			return {
				type: extension === ".md" ? "markdown" : "text",
				path: resolved.path,
				renderer: "ui-primitives",
				...extension === ".md" ? {
					content: textFrom(read.bytes.subarray(0, this.limits.maxTextBytes)),
					truncated: read.size > this.limits.maxTextBytes,
					policy: {
						allowRawHtml: false,
						allowRemoteImages: false,
						allowedLinkSchemes: [
							"http",
							"https",
							"mailto"
						]
					}
				} : {
					language: languageFor(resolved.path),
					content: textFrom(read.bytes.subarray(0, this.limits.maxTextBytes)),
					truncated: read.size > this.limits.maxTextBytes
				}
			};
		} catch (error) {
			return descriptorError(error);
		}
	}
	/** Read one bounded text file with canonical containment and before/after version checks. */
	async readText(pathInput, maxBytes, signal) {
		if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
		if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new PreviewPanelError("FILE_TOO_LARGE", "Read limit is invalid");
		assertNotAborted(signal);
		const resolved = await this.resolve(pathInput);
		assertNotAborted(signal);
		const read = await readBounded(resolved.canonicalPath, maxBytes, resolved.canonicalPath, void 0, signal);
		assertNotAborted(signal);
		if (read.size > maxBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "Context item exceeds its safety limit");
		return {
			path: resolved.path,
			content: textFrom(read.bytes),
			bytes: read.size,
			version: read.version,
			loadedAt: this.now()
		};
	}
	/**
	* Resolve one markdown-relative image to an opaque resource URL. The image
	* path is resolved against the markdown file's workspace-relative path and
	* must stay inside the root (no `..` escape, no symlink escape). Returns the
	* opaque resource URL (same-origin `/workspace/resource?id=...&type=...`)
	* or undefined when the image cannot be served safely. Images share one
	* capability per (path, mediaType, version) via the binary() dedupe path.
	*/
	async markdownImageUrl(markdownPath, imageSrc) {
		if (this.disposed || typeof imageSrc !== "string" || !imageSrc.trim()) return void 0;
		try {
			const dir = markdownPath.includes("/") ? markdownPath.slice(0, markdownPath.lastIndexOf("/")) : "";
			const trimmed = imageSrc.trim();
			if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("#") || trimmed.startsWith("data:")) return void 0;
			const cut = Math.min(...["?", "#"].map((marker) => {
				const at = trimmed.indexOf(marker);
				return at === -1 ? trimmed.length : at;
			}));
			const rawPath = trimmed.slice(0, cut);
			const joined = rawPath.startsWith("/") ? rawPath.slice(1) : dir ? `${dir}/${rawPath}` : rawPath;
			const segments = [];
			for (const part of joined.split("/")) {
				if (part === "" || part === ".") continue;
				if (part === "..") {
					if (segments.length === 0) return void 0;
					segments.pop();
					continue;
				}
				segments.push(part);
			}
			if (segments.length === 0) return void 0;
			const imagePath = normalizeWorkspacePath(segments.join("/"));
			if (!imagePath) return void 0;
			const resolved = await this.resolve(imagePath);
			const mediaType = mediaTypeFor(resolved.path);
			if (!mediaType || !mediaType.startsWith("image/")) return void 0;
			const info = await stat(resolved.canonicalPath);
			if (!info.isFile() || info.size > this.limits.maxImageBytes) return void 0;
			const version = versionFor(info);
			for (const [resourceId, resource] of this.resources) {
				if (this.now() >= resource.expiresAt) {
					this.resources.delete(resourceId);
					continue;
				}
				if (sameIdentity(resource.identity, this.identity) && resource.path === resolved.path && resource.mediaType === mediaType && resource.version === version) return this.resourceUrl(resourceId, mediaType);
			}
			const resourceId = randomBytes(18).toString("base64url");
			const expiresAt = this.now() + this.resourceTtlMs;
			this.resources.set(resourceId, {
				identity: this.identity,
				path: resolved.path,
				mediaType,
				version,
				expiresAt,
				downloadName: resourceName(resolved.path, mediaType)
			});
			return this.resourceUrl(resourceId, mediaType);
		} catch {
			return;
		}
	}
	/** The same-origin opaque resource URL for one resource id + media type. */
	resourceUrl(resourceId, mediaType) {
		return `/workspace/resource?id=${encodeURIComponent(resourceId)}&type=${encodeURIComponent(mediaType)}`;
	}
	async openResource(resourceId, request) {
		assertNotAborted(request.signal);
		if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
		const resource = this.resources.get(resourceId);
		if (!resource) throw new PreviewPanelError("RESOURCE_INVALID", "Resource is invalid");
		if (!sameIdentity(resource.identity, request.identity)) throw new PreviewPanelError("RESOURCE_UNAUTHORIZED", "Resource is not authorized");
		if (this.now() >= resource.expiresAt) {
			this.resources.delete(resourceId);
			throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
		}
		if (request.mediaType !== void 0 && request.mediaType !== resource.mediaType) throw new PreviewPanelError("RESOURCE_UNAUTHORIZED", "Resource type is not authorized");
		try {
			const resolved = await this.resolve(resource.path);
			const info = await stat(resolved.canonicalPath);
			if (versionFor(info) !== resource.version) throw new PreviewPanelError("RESOURCE_STALE", "Resource is stale");
			if (mediaTypeFor(resolved.path) !== resource.mediaType) throw new PreviewPanelError("RESOURCE_STALE", "Resource type is stale");
			const limit = resource.mediaType === "application/pdf" ? this.limits.maxPdfBytes : this.limits.maxImageBytes;
			if (info.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
			const read = await readBounded(resolved.canonicalPath, limit, resolved.canonicalPath, resource.version, request.signal);
			assertNotAborted(request.signal);
			if (read.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
			if (this.disposed || this.resources.get(resourceId) !== resource || this.now() >= resource.expiresAt) {
				this.resources.delete(resourceId);
				throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
			}
			return {
				mediaType: resource.mediaType,
				version: resource.version,
				downloadName: resource.downloadName,
				bytes: read.bytes
			};
		} catch (error) {
			throw safeError(error);
		}
	}
	dispose() {
		this.disposed = true;
		this.resources.clear();
	}
	async resolve(pathInput) {
		let path;
		try {
			path = normalizeWorkspacePath(pathInput);
		} catch {
			throw new PreviewPanelError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
		}
		if (!path) throw new PreviewPanelError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
		const root = await realpath(this.root);
		const candidate = join(root, path);
		const canonicalPath = await realpath(candidate);
		const relativePath = relative(root, canonicalPath);
		if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
		return {
			path,
			canonicalPath
		};
	}
	async binary(resolved) {
		const info = await stat(resolved.canonicalPath);
		if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview target is not a file");
		const mediaType = mediaTypeFor(resolved.path);
		const limit = mediaType === "application/pdf" ? this.limits.maxPdfBytes : this.limits.maxImageBytes;
		if (info.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
		if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
		const version = versionFor(info);
		for (const [resourceId, resource] of this.resources) {
			if (this.now() >= resource.expiresAt) {
				this.resources.delete(resourceId);
				continue;
			}
			if (sameIdentity(resource.identity, this.identity) && resource.path === resolved.path && resource.mediaType === mediaType && resource.version === version) return {
				type: "binary",
				path: resolved.path,
				mediaType,
				resourceId,
				version,
				expiresAt: resource.expiresAt
			};
		}
		const resourceId = randomBytes(18).toString("base64url");
		const expiresAt = this.now() + this.resourceTtlMs;
		this.resources.set(resourceId, {
			identity: this.identity,
			path: resolved.path,
			mediaType,
			version,
			expiresAt,
			downloadName: resourceName(resolved.path, mediaType)
		});
		return {
			type: "binary",
			path: resolved.path,
			mediaType,
			resourceId,
			version,
			expiresAt
		};
	}
	async json(resolved) {
		if ((await stat(resolved.canonicalPath)).size > this.limits.maxJsonBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "JSON preview exceeds its safety limit");
		const read = await readBounded(resolved.canonicalPath, this.limits.maxJsonBytes, resolved.canonicalPath);
		try {
			const value = JSON.parse(textFrom(read.bytes));
			inspectJson(value);
			return {
				type: "json",
				path: resolved.path,
				renderer: "ui-primitives",
				value
			};
		} catch (error) {
			if (error instanceof PreviewPanelError) throw error;
			throw new PreviewPanelError("INVALID_JSON", "JSON content is invalid");
		}
	}
	async csv(resolved) {
		if ((await stat(resolved.canonicalPath)).size > this.limits.maxCsvBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "CSV preview exceeds its safety limit");
		const parsed = parseCsv(textFrom((await readBounded(resolved.canonicalPath, this.limits.maxCsvBytes, resolved.canonicalPath)).bytes), this.limits.maxCsvRows);
		return {
			type: "csv",
			path: resolved.path,
			renderer: "ui-primitives",
			...parsed
		};
	}
};
//#endregion
//#region packages/plugin/src/domain/observation.ts
const READ_TOOLS = /^(?:read|read[-_]file|read[-_]image|read[-_]binary|file[-_]read)$/i;
const WRITE_TOOLS = /^(?:write|write[-_]file|file[-_]write|create[-_]file)$/i;
const EDIT_TOOLS = /^(?:edit|edit[-_]file|file[-_]edit|apply[-_]patch|str[-_]replace)$/i;
const DELETE_TOOLS = /^(?:delete|delete[-_]file|remove[-_]file|file[-_]delete)$/i;
const EDITOR_TOOLS = /(?:editor|structured|document|patch)/i;
const SHELL_TOOLS = /(?:shell|bash|zsh|sh|powershell|terminal|exec|command|run|python|node|git)/i;
const NON_PREVIEWABLE_EXTENSIONS = /\.(?:7z|avi|bin|doc|docx|gz|mp3|mp4|odt|ppt|pptx|tar|wav|xls|xlsx|zip|svg)$/iu;
function asRecord(value) {
	return value !== null && typeof value === "object" ? value : void 0;
}
function resultValue(result) {
	const record = asRecord(result);
	return record && "value" in record ? record.value : result;
}
function isSuccessful(outcome) {
	if (outcome.ok === false) return false;
	const result = asRecord(outcome.result);
	return result?.ok !== false && result?.success !== false && result?.error === void 0;
}
function field(record, ...names) {
	for (const name of names) if (record && name in record) return record[name];
}
function pathInputs(outcome) {
	const args = asRecord(outcome.arguments);
	const value = asRecord(resultValue(outcome.result));
	const paths = [];
	for (const record of [args, value]) {
		paths.push(field(record, "path", "file", "filePath", "file_path", "filename", "target"));
		for (const collection of [field(record, "paths", "files", "locations", "diffs")]) if (Array.isArray(collection)) for (const item of collection) paths.push(typeof item === "string" ? item : field(asRecord(item), "path", "file", "filePath", "file_path", "filename", "target"));
	}
	return [...new Set(paths.filter((path) => typeof path === "string" && path.trim() !== ""))];
}
function editorAction(outcome) {
	const args = asRecord(outcome.arguments);
	const value = asRecord(resultValue(outcome.result));
	const action = field(args, "operation", "action", "command", "mode", "op") ?? field(value, "operation", "action", "command", "mode", "op");
	return typeof action === "string" ? action.toLowerCase() : void 0;
}
function writeKind(outcome) {
	const value = asRecord(resultValue(outcome.result));
	const action = editorAction(outcome);
	const diffs = field(value, "diffs");
	if (Array.isArray(diffs) && diffs.length > 0) return diffs.some((item) => asRecord(item)?.oldText === null) ? "CREATED" : "MODIFIED";
	if (value?.created === true || value?.created === "true" || value?.existsBefore === false || value?.status === "created" || value?.action === "create" || action === "create") return "CREATED";
	return "MODIFIED";
}
function directKind(outcome) {
	const name = outcome.tool.trim();
	const value = asRecord(resultValue(outcome.result));
	if (Array.isArray(field(value, "diffs"))) return writeKind(outcome);
	if (READ_TOOLS.test(name)) return "READ";
	if (WRITE_TOOLS.test(name)) return writeKind(outcome);
	if (DELETE_TOOLS.test(name)) return "DELETED";
	if (EDIT_TOOLS.test(name)) return "MODIFIED";
	if (SHELL_TOOLS.test(name) && pathInputs(outcome).length > 0 && (field(value, "operation") === "create" || editorAction(outcome) === "create")) return "CREATED";
	if (!EDITOR_TOOLS.test(name)) return void 0;
	switch (editorAction(outcome)) {
		case "view":
		case "read": return "READ";
		case "create": return "CREATED";
		case "delete":
		case "remove": return "DELETED";
		case "replace":
		case "insert":
		case "edit":
		case "update": return "MODIFIED";
		default: return;
	}
}
function potentiallyMutating(outcome, kind) {
	if (outcome.potentiallyMutating === true) return true;
	if (kind !== void 0) return !READ_TOOLS.test(outcome.tool);
	return SHELL_TOOLS.test(outcome.tool);
}
function observationId(outcome, path, index) {
	if (outcome.eventSeq !== void 0) return `durable:${outcome.identity.sessionId}:${outcome.eventSeq}:${index}:${path}`;
	const call = outcome.callId || outcome.rootCallId || "unknown-call";
	return `${outcome.source ?? "live-tool"}:${call}:${index}:${path}`;
}
function previewablePath(path) {
	return !NON_PREVIEWABLE_EXTENSIONS.test(path);
}
function classifyToolOutcome(outcome) {
	if (!isSuccessful(outcome) || outcome.background === true && outcome.settled !== true) return [];
	const kind = directKind(outcome);
	if (kind === void 0) return [];
	const source = outcome.source ?? "live-tool";
	return pathInputs(outcome).map((path, index) => ({
		id: observationId(outcome, path, index),
		identity: outcome.identity,
		path: normalizeWorkspacePath(path),
		kind,
		observedAt: outcome.observedAt,
		source,
		attribution: "agent-evidenced",
		previewable: previewablePath(path)
	}));
}
function reconciliationFor(outcome) {
	const kind = directKind(outcome);
	if (!potentiallyMutating(outcome, kind)) return void 0;
	if (outcome.background === true && outcome.settled !== true) return void 0;
	if (isSuccessful(outcome) && kind !== void 0 && !SHELL_TOOLS.test(outcome.tool)) return void 0;
	const callId = outcome.callId || outcome.rootCallId || "unknown-call";
	const reason = outcome.background === true && outcome.settled === true ? "background-settled" : isSuccessful(outcome) ? "potentially-mutating" : "failed-call";
	const debounceKey = `${outcome.identity.sessionId}:${outcome.identity.rootId}`;
	return {
		id: `reconcile:${callId}:${outcome.observedAt}`,
		debounceKey,
		identity: outcome.identity,
		callId,
		rootCallId: outcome.rootCallId,
		observedAt: outcome.observedAt,
		reason
	};
}
function observeLiveTool(outcome) {
	return {
		observations: classifyToolOutcome(outcome),
		reconciliation: reconciliationFor(outcome)
	};
}
function statusKind(entry) {
	if (entry.kind !== void 0) return entry.kind;
	if (entry.exists === false || /(?:^|\s)D(?:\s|$)|deleted|missing/i.test(entry.status ?? "")) return "DELETED";
	if (/^\?\?|(?:^|\s)A(?:\s|$)|added|created|untracked/i.test(entry.status ?? "")) return "CREATED";
	return "MODIFIED";
}
function baselinePathSet(baseline) {
	return new Set((baseline.gitStatus ?? []).map((item) => normalizeWorkspacePath(item.path)));
}
function reconciliationAttribution(source, path, baselinePaths) {
	if (baselinePaths.has(path)) return "pre-existing";
	return source === "git" ? "session-observed" : "unknown";
}
function reconcileSnapshot(identity, baseline, snapshot) {
	if (baseline.sessionId !== identity.sessionId || baseline.rootId !== identity.rootId) throw new ActivityProjectionError("Baseline identity does not match Workspace identity");
	const baselinePaths = baselinePathSet(baseline);
	const observations = [];
	for (const [index, entry] of snapshot.entries.entries()) {
		const kind = statusKind(entry);
		const path = normalizeWorkspacePath(entry.path);
		const attribution = reconciliationAttribution(snapshot.source, path, baselinePaths);
		const base = `reconcile:${snapshot.id}:${index}`;
		if (entry.previousPath !== void 0) {
			const previousPath = normalizeWorkspacePath(entry.previousPath);
			const previousAttribution = reconciliationAttribution(snapshot.source, previousPath, baselinePaths);
			observations.push({
				id: `${base}:delete:${previousPath}`,
				identity,
				path: previousPath,
				kind: "DELETED",
				observedAt: snapshot.observedAt,
				source: snapshot.source,
				attribution: previousAttribution
			});
			observations.push({
				id: `${base}:create:${path}`,
				identity,
				path,
				kind: "CREATED",
				observedAt: snapshot.observedAt,
				source: snapshot.source,
				attribution,
				previewable: entry.previewable
			});
			continue;
		}
		observations.push({
			id: `${base}:${kind}:${path}`,
			identity,
			path,
			kind,
			observedAt: snapshot.observedAt,
			source: snapshot.source,
			attribution,
			previewable: entry.previewable
		});
	}
	return observations;
}
var DebouncedReconciliationQueue = class {
	pendingByKey = /* @__PURE__ */ new Map();
	timer;
	delayMs;
	onFlush;
	constructor(delayMs = 150, onFlush = () => {}) {
		this.delayMs = delayMs;
		this.onFlush = onFlush;
	}
	request(request) {
		this.pendingByKey.set(request.debounceKey, request);
		if (this.timer !== void 0) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.flush();
		}, this.delayMs);
	}
	pending() {
		return [...this.pendingByKey.values()];
	}
	flush() {
		if (this.timer !== void 0) clearTimeout(this.timer);
		this.timer = void 0;
		const requests = this.pending();
		this.pendingByKey.clear();
		if (requests.length > 0) this.onFlush(requests);
		return requests;
	}
	dispose() {
		if (this.timer !== void 0) clearTimeout(this.timer);
		this.timer = void 0;
		this.pendingByKey.clear();
	}
};
function durableOutcome(identity, record) {
	const data = record.data ?? record;
	const type = String(record.type ?? data.type ?? "");
	if (!("result" in data || "value" in data || /tool[/:_-]?result|code[/:_-]?dispatch/i.test(type))) return void 0;
	const tool = field(data, "tool", "name", "toolName");
	if (typeof tool !== "string") return void 0;
	const callId = field(data, "callId", "call_id", "id");
	const rootCallId = field(data, "rootCallId", "root_call_id");
	const result = "result" in data ? data.result : data.value;
	return {
		identity,
		callId: typeof callId === "string" ? callId : `durable-${record.seq}`,
		rootCallId: typeof rootCallId === "string" ? rootCallId : void 0,
		tool,
		arguments: field(data, "arguments", "args", "input"),
		result,
		ok: typeof data.ok === "boolean" ? data.ok : typeof data.success === "boolean" ? data.success : void 0,
		observedAt: typeof record.time === "number" ? record.time : record.seq,
		eventSeq: record.seq,
		source: "durable-tool",
		potentiallyMutating: data.potentiallyMutating === true
	};
}
var SessionActivityObserver = class {
	projectionState;
	replayed = false;
	liveKeys = /* @__PURE__ */ new Set();
	durableCallKeys = /* @__PURE__ */ new Set();
	identity;
	baseline;
	reconciliations;
	constructor(identity, baseline, reconciliationQueue = new DebouncedReconciliationQueue()) {
		this.identity = identity;
		this.baseline = baseline;
		this.projectionState = reduceActivity(identity, []);
		this.reconciliations = reconciliationQueue;
	}
	get projection() {
		return this.projectionState;
	}
	resume(records) {
		if (this.replayed) return this.projectionState;
		this.replayed = true;
		for (const record of [...records].sort((left, right) => left.seq - right.seq)) {
			const outcome = durableOutcome(this.identity, record);
			if (outcome !== void 0) {
				if (outcome.background !== true || outcome.settled === true) this.durableCallKeys.add(outcome.callId || outcome.rootCallId || "");
				this.applyBatch(observeLiveTool(outcome));
			}
		}
		return this.projectionState;
	}
	consumeLive(outcome) {
		if (outcome.identity.sessionId !== this.identity.sessionId || outcome.identity.rootId !== this.identity.rootId) throw new ActivityProjectionError("Workspace identity does not match observer");
		const callIdentity = (typeof outcome.callId === "string" ? outcome.callId.trim() : "") || (typeof outcome.rootCallId === "string" ? outcome.rootCallId.trim() : "");
		if (!callIdentity) throw new ActivityProjectionError("Live outcome requires a call identity");
		if ((outcome.background !== true || outcome.settled === true) && this.durableCallKeys.has(callIdentity)) return { observations: [] };
		const key = `${callIdentity}:${outcome.background === true ? outcome.settled === true ? "settled" : "started" : "result"}`;
		if (this.liveKeys.has(key)) return { observations: [] };
		const batch = observeLiveTool(outcome);
		if (batch.observations.length > 0 || batch.reconciliation !== void 0) {
			this.liveKeys.add(key);
			this.applyBatch(batch);
		}
		return batch;
	}
	applyReconciliation(snapshot) {
		for (const observation of reconcileSnapshot(this.identity, this.baseline, snapshot)) this.projectionState = recordActivity(this.projectionState, observation);
		return this.projectionState;
	}
	dispose() {
		this.reconciliations.dispose();
	}
	applyBatch(batch) {
		for (const observation of batch.observations) this.projectionState = recordActivity(this.projectionState, observation);
		if (batch.reconciliation !== void 0) this.reconciliations.request(batch.reconciliation);
	}
};
//#endregion
//#region packages/plugin/src/host/workspace-artifacts.ts
function record(value) {
	return value !== null && typeof value === "object" ? value : void 0;
}
const PATH_FIELDS = [
	"path",
	"file",
	"filePath",
	"file_path",
	"filename",
	"target"
];
const PATH_COLLECTIONS = [
	"paths",
	"files",
	"locations",
	"diffs"
];
const SHELL_WRITE_TOOLS = /^(?:bash|sh|zsh|shell|terminal|exec|pwsh|powershell)$/i;
function workspaceRelativePath(value, root) {
	const input = value.trim();
	if (!input) return void 0;
	if (/[\u0000-\u001F\u007F]/u.test(input) || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(input)) return void 0;
	const normalizedInput = input.replaceAll("\\", "/");
	if (normalizedInput.split("/").includes("..")) return void 0;
	if (!isAbsolute(input) && win32.isAbsolute(input)) return void 0;
	if (!isAbsolute(input) && !/^[A-Za-z]:[\\/]/u.test(input)) return normalizedInput;
	if (!root) return void 0;
	const relativePath = relative(resolve(root), resolve(input));
	if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return void 0;
	return relativePath.split(sep).join("/");
}
function sanitizeToolPayload(value, root) {
	const source = record(value);
	if (!source) return value;
	const sanitized = { ...source };
	for (const field of PATH_FIELDS) {
		const path = sanitized[field];
		if (typeof path !== "string") continue;
		const relativePath = workspaceRelativePath(path, root);
		if (relativePath === void 0) delete sanitized[field];
		else sanitized[field] = relativePath;
	}
	for (const field of PATH_COLLECTIONS) {
		const collection = sanitized[field];
		if (!Array.isArray(collection)) continue;
		sanitized[field] = collection.flatMap((item) => {
			if (typeof item === "string") {
				const relativePath = workspaceRelativePath(item, root);
				return relativePath === void 0 ? [] : [relativePath];
			}
			return [sanitizeToolPayload(item, root)];
		});
	}
	return sanitized;
}
function shellWordAt(command, start) {
	let value = "";
	let quote;
	let index = start;
	while (index < command.length && /\s/u.test(command[index] ?? "")) index += 1;
	for (; index < command.length; index += 1) {
		const character = command[index];
		if (quote !== void 0) {
			if (character === quote) {
				quote = void 0;
				continue;
			}
			if (character === "\\" && quote === "\"" && index + 1 < command.length) {
				value += command[index + 1];
				index += 1;
				continue;
			}
			value += character;
			continue;
		}
		if (character === "'" || character === "\"") {
			quote = character;
			continue;
		}
		if (character === "\\" && index + 1 < command.length) {
			value += command[index + 1];
			index += 1;
			continue;
		}
		if (/\s|[;&|]/u.test(character)) break;
		value += character;
	}
	return value || void 0;
}
function shellTokenEnd(command, start) {
	let quote;
	let index = start;
	while (index < command.length && /\s/u.test(command[index] ?? "")) index += 1;
	for (; index < command.length; index += 1) {
		const character = command[index];
		if (quote !== void 0) {
			if (character === quote) quote = void 0;
			else if (character === "\\" && quote === "\"") index += 1;
			continue;
		}
		if (character === "'" || character === "\"") {
			quote = character;
			continue;
		}
		if (character === "\\" && index + 1 < command.length) {
			index += 1;
			continue;
		}
		if (/\s|[;&|]/u.test(character)) return index;
	}
	return command.length;
}
function shellHeredocEnd(command, start, delimiter) {
	let lineStart = command.indexOf("\n", start);
	if (lineStart < 0) return command.length;
	lineStart += 1;
	while (lineStart <= command.length) {
		const lineEnd = command.indexOf("\n", lineStart);
		const end = lineEnd < 0 ? command.length : lineEnd;
		if (command.slice(lineStart, end).replace(/\r$/u, "") === delimiter) return end;
		if (lineEnd < 0) return command.length;
		lineStart = lineEnd + 1;
	}
	return command.length;
}
function shellRedirectionPaths(command, add) {
	let quote;
	let segmentStart = 0;
	let conditional;
	let heredocSkipEnd;
	let segmentHeadChecked = false;
	for (let index = 0; index < command.length; index += 1) {
		const character = command[index];
		if (quote !== void 0) {
			if (character === quote) quote = void 0;
			else if (character === "\\" && quote === "\"") index += 1;
			continue;
		}
		if (character === "'" || character === "\"") {
			quote = character;
			continue;
		}
		if (character === "\\" && index + 1 < command.length) {
			index += 1;
			continue;
		}
		if (heredocSkipEnd !== void 0 && character === "\n") {
			index = heredocSkipEnd;
			heredocSkipEnd = void 0;
			continue;
		}
		if (character === "#" && (index === segmentStart || /\s/u.test(command[index - 1] ?? ""))) break;
		if (conditional === "[[" && character === "]" && command[index + 1] === "]") {
			conditional = void 0;
			index += 1;
			continue;
		}
		if (conditional === "((" && character === ")" && command[index + 1] === ")") {
			conditional = void 0;
			index += 1;
			continue;
		}
		if (conditional === void 0 && character === "[" && command[index + 1] === "[") {
			conditional = "[[";
			index += 1;
			continue;
		}
		if (conditional === void 0 && character === "(" && command[index + 1] === "(") {
			conditional = "((";
			index += 1;
			continue;
		}
		if (character === "<" && command[index + 1] === "<" && command[index + 2] !== "<") {
			const delimiter = shellWordAt(command, index + 2);
			const bodyStart = command.indexOf("\n", index + 2);
			if (delimiter !== void 0 && bodyStart >= 0) heredocSkipEnd = shellHeredocEnd(command, index + 2, delimiter);
			else index += 1;
			continue;
		}
		if (/[;&|]/u.test(character)) {
			segmentStart = index + 1;
			segmentHeadChecked = false;
			continue;
		}
		if (!segmentHeadChecked && !/\s/u.test(character)) {
			segmentHeadChecked = true;
			const head = shellWordAt(command, segmentStart);
			if (/^(?:tee|touch)$/i.test(head ?? "")) {
				let targetStart = shellTokenEnd(command, segmentStart);
				let target = shellWordAt(command, targetStart);
				while (target?.startsWith("-")) {
					targetStart = shellTokenEnd(command, targetStart);
					target = shellWordAt(command, targetStart);
				}
				add(target);
			}
		}
		if (character !== ">" || conditional !== void 0 || ["[[", "(("].includes(shellWordAt(command, segmentStart) ?? "")) continue;
		if (command[index + 1] === ">") index += 1;
		add(shellWordAt(command, index + 1));
	}
}
function shellWritePaths(tool, args) {
	if (tool === void 0 || !SHELL_WRITE_TOOLS.test(tool)) return [];
	const command = record(args)?.command;
	if (typeof command !== "string") return [];
	const paths = [];
	const add = (value) => {
		const path = value === void 0 ? void 0 : workspaceRelativePath(value);
		if (!path || /[$`*?{}&]/u.test(path)) return;
		if (!paths.includes(path)) paths.push(path);
	};
	shellRedirectionPaths(command, add);
	return paths;
}
function shellCreationPaths(tool, args) {
	return shellWritePaths(tool, args);
}
function operationFromResult(tool, args, content, shellPaths = shellWritePaths(tool, args)) {
	if (!(tool !== void 0 && /^(?:write|write[-_]file|file[-_]write|create[-_]file)$/i.test(tool)) && shellPaths.length === 0) return void 0;
	const textParts = [];
	const collectText = (items) => {
		for (const item of items) {
			const block = record(item);
			if (!block) continue;
			if (typeof block.text === "string") textParts.push(block.text);
			if (Array.isArray(block.content)) collectText(block.content);
		}
	};
	collectText(content);
	const text = textParts.join("\n");
	if (/\bCreated file\b/i.test(text)) return "create";
	if (/\bUpdated file\b/i.test(text)) return "update";
	if (shellPaths.length > 0) return "create";
}
function toSessionToolRecords(events, workspaceRoot) {
	const calls = /* @__PURE__ */ new Map();
	const records = [];
	for (const event of events) {
		const data = event.data ?? {};
		if (event.type === "tool/call") {
			const callId = data.callId;
			const name = data.name;
			if (typeof callId === "string" && typeof name === "string") {
				let args = {};
				if (typeof data.arguments === "string") try {
					args = sanitizeToolPayload(JSON.parse(data.arguments), workspaceRoot);
				} catch {
					args = {};
				}
				calls.set(callId, {
					name,
					arguments: args
				});
			}
			continue;
		}
		if (event.type !== "tool/result") continue;
		const message = record(data.message);
		const source = record(message?.source);
		const content = Array.isArray(message?.content) ? message.content : [];
		const block = record(content[0]);
		const callId = typeof source?.callId === "string" ? source.callId : typeof block?.toolCallId === "string" ? block.toolCallId : void 0;
		if (!callId) continue;
		const call = calls.get(callId);
		const meta = sanitizeToolPayload(record(data.meta) ?? { locations: [] }, workspaceRoot);
		const shellCreatedPaths = shellCreationPaths(call?.name, call?.arguments);
		const operation = operationFromResult(call?.name, call?.arguments, content, shellCreatedPaths);
		const shellTool = call?.name !== void 0 && SHELL_WRITE_TOOLS.test(call.name);
		records.push({
			seq: event.seq,
			time: event.time,
			type: event.type,
			data: {
				tool: call?.name ?? "tool",
				callId,
				arguments: shellTool ? {} : call?.arguments ?? {},
				result: operation === void 0 ? meta : {
					...meta,
					operation,
					...shellCreatedPaths.length > 0 ? { paths: shellCreatedPaths } : {}
				},
				ok: block?.isError !== true
			}
		});
	}
	return records;
}
function descriptorWithoutPath(descriptor) {
	switch (descriptor.type) {
		case "text": return {
			type: "text",
			renderer: descriptor.renderer,
			...descriptor.language === void 0 ? {} : { language: descriptor.language },
			content: descriptor.content,
			truncated: descriptor.truncated
		};
		case "markdown": return {
			type: "markdown",
			renderer: descriptor.renderer,
			content: descriptor.content,
			truncated: descriptor.truncated,
			policy: descriptor.policy
		};
		case "json": return {
			type: "json",
			renderer: descriptor.renderer,
			value: descriptor.value
		};
		case "csv": return {
			type: "csv",
			renderer: descriptor.renderer,
			columns: descriptor.columns,
			rows: descriptor.rows,
			truncated: descriptor.truncated
		};
		case "binary": return {
			type: "binary",
			mediaType: descriptor.mediaType,
			resourceId: descriptor.resourceId,
			version: descriptor.version,
			expiresAt: descriptor.expiresAt
		};
		case "unsupported": return {
			type: "unsupported",
			reason: descriptor.reason,
			...descriptor.mediaType === void 0 ? {} : { mediaType: descriptor.mediaType },
			...descriptor.size === void 0 ? {} : { size: descriptor.size }
		};
		case "error": return {
			type: "error",
			code: descriptor.code,
			message: descriptor.message
		};
	}
}
async function statArtifact(root, path) {
	const normalized = normalizeWorkspacePath(path);
	const canonicalRoot = await realpath(root);
	const canonicalPath = await realpath(join(canonicalRoot, normalized));
	const relativePath = relative(canonicalRoot, canonicalPath);
	if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
	const info = await stat(canonicalPath);
	if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Artifact is not a file");
	return {
		size: info.size,
		mtimeMs: info.mtimeMs
	};
}
function artifactDescriptorPath(descriptor, path) {
	return "path" in descriptor ? descriptor : {
		...descriptor,
		path
	};
}
/**
* Session-scoped artifact carrier. It derives each snapshot from durable tool
* records and keeps PreviewService as the only byte/resource authority.
*/
var WorkspaceArtifactCarrier = class {
	identity;
	preview;
	workspace;
	root;
	records;
	artifacts = /* @__PURE__ */ new Map();
	descriptorCache = /* @__PURE__ */ new Map();
	constructor(options) {
		if (!options?.workspace || !options.root || typeof options.records !== "function") throw new Error("Workspace artifact carrier options are invalid");
		this.workspace = options.workspace;
		this.identity = options.workspace.identity;
		this.root = options.root;
		this.records = options.records;
		this.preview = options.preview ?? new PreviewService(options.root, this.identity);
	}
	async metadata() {
		const projection = this.projection();
		const next = /* @__PURE__ */ new Map();
		for (const item of deriveArtifacts(projection)) {
			if (item.deleted) {
				const descriptor = {
					type: "error",
					code: "FILE_NOT_FOUND",
					message: "Artifact was deleted"
				};
				const artifact = createWorkspaceDeliverable(descriptor, {
					sessionId: this.identity.sessionId,
					workspaceId: this.identity.rootId,
					kind: "artifact"
				}, 0, {
					logicalPath: item.path,
					mediaType: "application/octet-stream",
					mtimeMs: item.createdAt
				});
				next.set(artifact.id, {
					path: item.path,
					artifact,
					descriptor
				});
				continue;
			}
			let info;
			try {
				info = await statArtifact(this.root, item.path);
				const cached = this.descriptorCache.get(item.path);
				let descriptor;
				if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) descriptor = cached.descriptor;
				else {
					descriptor = await this.preview.preview(item.path);
					this.descriptorCache.set(item.path, {
						size: info.size,
						mtimeMs: info.mtimeMs,
						descriptor
					});
				}
				const artifact = createWorkspaceDeliverable(descriptor, {
					sessionId: this.identity.sessionId,
					workspaceId: this.identity.rootId,
					kind: "artifact"
				}, info.size, {
					name: item.path,
					mtimeMs: info.mtimeMs
				});
				next.set(artifact.id, {
					path: item.path,
					artifact,
					descriptor
				});
			} catch (error) {
				const descriptor = {
					type: "error",
					code: error instanceof PreviewPanelError ? error.code : "PROVIDER_UNAVAILABLE",
					message: error instanceof Error ? error.message : "Artifact is unavailable"
				};
				const artifact = createWorkspaceDeliverable(descriptor, {
					sessionId: this.identity.sessionId,
					workspaceId: this.identity.rootId,
					kind: "artifact"
				}, info?.size ?? 0, {
					logicalPath: item.path,
					mediaType: "application/octet-stream",
					mtimeMs: info?.mtimeMs ?? item.createdAt
				});
				next.set(artifact.id, {
					path: item.path,
					artifact,
					descriptor
				});
			}
		}
		this.artifacts = next;
		return [...next.values()].map((entry) => entry.artifact);
	}
	async previewArtifact(id) {
		if (typeof id !== "string" || !id.trim()) return {
			type: "error",
			code: "RESOURCE_INVALID",
			message: "Artifact identity is invalid"
		};
		if (!this.artifacts.has(id)) await this.metadata();
		const entry = this.artifacts.get(id);
		if (!entry) return {
			type: "error",
			code: "RESOURCE_INVALID",
			message: "Artifact is unavailable"
		};
		const preview = descriptorWithoutPath(artifactDescriptorPath(entry.descriptor.type === "binary" ? entry.descriptor : await this.preview.preview(entry.path), entry.path));
		if (preview.type === "markdown") {
			const imageUrls = {};
			for (const match of preview.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gu)) {
				const src = match[1]?.trim();
				if (!src || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) continue;
				const url = await this.preview.markdownImageUrl(entry.path, src);
				if (url) imageUrls[src] = url;
			}
			return Object.keys(imageUrls).length > 0 ? {
				...preview,
				imageUrls
			} : preview;
		}
		return preview;
	}
	dispose() {
		this.preview.dispose();
		this.artifacts.clear();
		this.descriptorCache.clear();
	}
	projection() {
		const observer = new SessionActivityObserver(this.identity, this.workspace.baseline);
		observer.resume(this.records());
		return observer.projection;
	}
};
function sessionToolRecords(events, workspaceRoot) {
	return toSessionToolRecords(events, workspaceRoot);
}
//#endregion
//#region packages/plugin/src/host/workspace-memory-propose.ts
const MEMORY_PROPOSE_TOOL_NAME = "workspace_memory_propose";
const MEMORY_PROPOSE_SECTION = "dsh-workspace-memory";
function assertProposalArgs(args) {
	if (!args || typeof args !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory proposal arguments are invalid");
	if (args.scope !== void 0 && args.scope !== "project" && args.scope !== "session") throw new MemoryStoreError("INVALID_RECORD", "Memory proposal scope is invalid");
	if (!MEMORY_TYPES.includes(args.type)) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal type is invalid");
	if (typeof args.title !== "string" || !args.title.trim()) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal title is required");
	if (typeof args.content !== "string" || !args.content.trim()) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal content is required");
	if (args.tags !== void 0 && !Array.isArray(args.tags)) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal tags are invalid");
}
/**
* Persist one Agent proposal as a governed `model-suggested`, `unverified`
* record with session and tool-call source references. Proposals are never
* injected into Agent/model context; only the user's explicit Verify makes
* them eligible.
*/
async function proposeMemory(memoryDomain, agent, args, eventId) {
	assertProposalArgs(args);
	const { identity, root } = workspaceMemoryContextFor(agent);
	const request = { scope: args.scope === "session" ? "session" : "project" };
	const context = {
		identity,
		root
	};
	const state = await memoryDomain.open(context, request);
	const sourceRefs = [{
		kind: "session",
		id: agent.id
	}];
	if (typeof eventId === "string" && eventId.trim()) sourceRefs.push({
		kind: "event",
		id: eventId.trim()
	});
	const record = await memoryDomain.upsert(context, request, {
		scope: state.scope,
		scopeKey: state.scopeKey,
		type: args.type,
		title: args.title,
		content: args.content,
		tags: args.tags ?? [],
		provenance: {
			kind: "agent",
			sessionId: agent.id,
			note: "memory proposal"
		},
		governance: {
			origin: "model-suggested",
			sourceRefs,
			verification: "unverified",
			revision: 1,
			retention: memoryRetentionForScope(state.scope)
		}
	});
	return {
		id: record.id,
		title: record.title,
		scope: record.scope
	};
}
/** The Agent-facing tool definition; registered through the public tool registry. */
function createMemoryProposeTool(memoryDomain) {
	return defineTool({
		name: MEMORY_PROPOSE_TOOL_NAME,
		description: "Propose a durable project decision, preference, convention, or fact for the user to review and keep in local Workspace Memory. Proposals are stored unverified and are never injected into the model context automatically; the user must confirm them.",
		parameters: {
			scope: {
				type: "string",
				description: "Target scope: project (default) or session."
			},
			type: {
				type: "string",
				required: true,
				description: "Record type: decision, preference, convention, or fact."
			},
			title: {
				type: "string",
				required: true,
				description: "Short title (max 256 bytes)."
			},
			content: {
				type: "string",
				required: true,
				description: "Content (max 64 KiB)."
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Optional tags."
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			const agent = exec.agent;
			if (!agent) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory proposals require an active session");
			const saved = await proposeMemory(memoryDomain, agent, args, exec.callId);
			return `Saved memory proposal "${saved.title}" (${saved.scope} scope) for your review. It is not injected into context until the user verifies it.`;
		}
	});
}
const PROMPT_SECTION_TEXT = `## Workspace Memory proposals

This workspace keeps local Memory: durable project decisions, preferences, conventions, and facts the user should remember across sessions. When you establish or change such a fact — a stable decision, a user preference, a coding convention, or a durable project fact — propose it with the \`workspace_memory_propose\` tool. Proposals are stored unverified for the user to review and verify; they are never injected into context automatically. Do not propose transient details, secrets, credentials, or facts the user can trivially re-derive.`;
/**
* Register the propose tool and its system-prompt guidance against the
* shared Memory domain (the same instance the Host RPC service uses, so
* proposals are visible to the Web surface immediately). Returns a disposer.
*/
function registerMemoryPropose(ctx, memoryDomain) {
	const disposers = [];
	disposers.push(ctx.tools.register(createMemoryProposeTool(memoryDomain)));
	disposers.push(ctx.systemPrompt.section({
		name: MEMORY_PROPOSE_SECTION,
		order: 120,
		text: PROMPT_SECTION_TEXT
	}));
	return () => {
		for (const dispose of disposers.reverse()) dispose();
	};
}
/**
* Deterministic summary from durable session tool records — never assistant
* narration. `changes` counts present session files the agent created or
* modified (no git dependency); `artifacts` is the session artifact count.
*/
function workspaceSummaryFor(agent) {
	const cwd = agent.session?.header?.cwd;
	if (typeof agent.id !== "string" || !agent.id.trim() || !cwd) return void 0;
	let identity;
	let root;
	let baseline;
	try {
		const snapshot = startWorkspace({
			sessionId: agent.id,
			processCwd: cwd
		});
		identity = snapshot.identity;
		baseline = snapshot.baseline;
		root = resolveWorkspaceRoot(cwd, ".");
	} catch {
		return;
	}
	const observer = new SessionActivityObserver(identity, baseline);
	const records = sessionToolRecords(agent.session?.events ?? [], root);
	const folded = records.length > 2e4 ? records.slice(-2e4) : records;
	observer.resume(folded);
	const files = [...observer.projection.files.values()];
	const changes = files.filter((file) => file.current === "present" && (file.lastKind === "CREATED" || file.lastKind === "MODIFIED") && (file.attribution === "agent-evidenced" || file.attribution === "session-observed")).length;
	const filesCreated = files.filter((file) => file.lastKind === "CREATED").length;
	const filesModified = files.filter((file) => file.lastKind === "MODIFIED").length;
	const filesDeleted = files.filter((file) => file.lastKind === "DELETED").length;
	const observedAts = files.flatMap((file) => [file.firstObservedAt, file.lastObservedAt]);
	const firstObservedAt = observedAts.length ? Math.min(...observedAts) : 0;
	const lastObservedAt = observedAts.length ? Math.max(...observedAts) : 0;
	return Object.freeze({
		filesTouched: files.length,
		changes,
		artifacts: deriveArtifacts(observer.projection).length,
		workspaceName: basename(root),
		filesCreated,
		filesModified,
		filesDeleted,
		firstObservedAt,
		lastObservedAt,
		memoryCount: 0,
		decisionCount: 0
	});
}
/**
* Derive a summary augmented with active-scope (session) Memory and decision
* counts when a Memory domain is available. Pure wrapper over
* `workspaceSummaryFor`; never writes to the session log.
*/
async function workspaceSummaryWithMemory(agent, memoryDomain) {
	const base = workspaceSummaryFor(agent);
	if (!base) return void 0;
	const cwd = agent.session?.header?.cwd;
	if (!memoryDomain || !cwd) return base;
	try {
		const context = workspaceMemoryContextFor({
			id: agent.id,
			session: { header: { cwd } }
		});
		const records = await memoryDomain.list(context, { scope: "session" }, {
			limit: 100,
			status: "active"
		});
		return Object.freeze({
			...base,
			memoryCount: records.length,
			decisionCount: records.filter((record) => record.type === "decision").length
		});
	} catch {
		return base;
	}
}
/**
* Observe final tool outcomes through the public `tools/result` seam.
*
* v0.6 change: this emitter NO LONGER appends a durable `workspace/summary`
* event to the session log. Research (wayfinder #110) proved that DSH's cold
* persistence path rejects unknown non-ignorable event types, so any session
* whose log contains `workspace/summary` refuses to load after a restart
* (openState=error — missing chat card and empty tab data). The summary is now
* derived on demand from allow-listed `tool/call` + `tool/result` records via
* `workspaceSummaryFor` / `workspaceSummaryWithMemory`, exposed to the web
* client through the `workspaceSummary` remote. This disposer is retained for
* API compatibility and to keep the tools/result observation seam warm; it
* performs no log writes.
*/
function attachWorkspaceSummaryEmitter(_ctx, _memoryDomain) {
	return () => {};
}
//#endregion
//#region packages/plugin/src/host/workspace-memory-auto-write.ts
/** Debounce window for one session's auto-fact digest write. */
const AUTO_WRITE_DEBOUNCE_MS = 500;
/** Fixed title so the session surface groups auto facts as one stable digest family. */
const AUTO_FACT_TITLE = "Session workspace digest (auto)";
/** Tags attached to every auto-captured fact record. */
const AUTO_FACT_TAGS = ["auto", "workspace"];
function sha256Hex(value) {
	return createHash("sha256").update(value).digest("hex");
}
/** Deterministic digest key over the fact payload (paths by kind + artifacts). */
function digestKeyFor(created, modified, deleted, artifacts) {
	return sha256Hex(JSON.stringify({
		created,
		modified,
		deleted,
		artifacts
	})).slice(0, 24);
}
function latestEventSeq(records) {
	const seq = records.reduce((max, record) => Math.max(max, record.seq), 0);
	return seq > 0 ? seq : void 0;
}
/**
* Build a compact, human-readable fact digest from the durable session
* projection. Deliberately deterministic for a given digest key so repeated
* flushes of unchanged activity merge into the same record instead of piling
* up. Only relative Workspace paths are included — never absolute host paths.
*/
function buildAutoFactContent(touched, artifacts) {
	const created = touched.filter((file) => file.lastKind === "CREATED").map((file) => file.path);
	const modified = touched.filter((file) => file.lastKind === "MODIFIED").map((file) => file.path);
	const deleted = touched.filter((file) => file.lastKind === "DELETED").map((file) => file.path);
	const artifactPaths = artifacts.map((artifact) => artifact.path).sort((left, right) => left.localeCompare(right));
	const lines = [`Files touched: ${touched.length} (${created.length} created, ${modified.length} modified, ${deleted.length} deleted).`];
	if (created.length > 0) lines.push(`Created: ${created.join(", ")}`);
	if (modified.length > 0) lines.push(`Modified: ${modified.join(", ")}`);
	if (deleted.length > 0) lines.push(`Deleted: ${deleted.join(", ")}`);
	lines.push(`Artifacts: ${artifactPaths.length}${artifactPaths.length > 0 ? ` — ${artifactPaths.join(", ")}` : ""}.`);
	return lines.join("\n");
}
/**
* Derive one stable-id `session`-scope `fact` Memory record from the durable
* tool records of a session. The record is governed as `derived` /
* `unverified` (never injected into Agent/model context) and updated in place
* for repeated identical digests. Returns the written record id, or undefined
* when there is nothing useful to capture.
*/
async function writeAutoFact(memoryDomain, agent) {
	const cwd = agent.session?.header?.cwd;
	if (typeof agent.id !== "string" || !agent.id.trim() || !cwd) return void 0;
	const { identity, root, snapshot } = workspaceMemoryContextFor(agent);
	const request = { scope: "session" };
	const context = {
		identity,
		root
	};
	const records = sessionToolRecords(agent.session?.events ?? [], root);
	const observer = new SessionActivityObserver(identity, snapshot.baseline);
	observer.resume(records);
	const touched = [...observer.projection.files.values()].filter((file) => file.lastKind === "CREATED" || file.lastKind === "MODIFIED" || file.lastKind === "DELETED");
	const artifacts = deriveArtifacts(observer.projection);
	if (touched.length === 0 && artifacts.length === 0) return void 0;
	const created = touched.filter((file) => file.lastKind === "CREATED").map((file) => file.path);
	const modified = touched.filter((file) => file.lastKind === "MODIFIED").map((file) => file.path);
	const deleted = touched.filter((file) => file.lastKind === "DELETED").map((file) => file.path);
	const content = buildAutoFactContent(touched, artifacts);
	const scopeKey = `${identity.sessionId}|${identity.rootId}`;
	const digestKey = digestKeyFor(created, modified, deleted, artifacts.map((artifact) => artifact.path));
	const stableId = `memory:auto:fact:${sha256Hex(scopeKey).slice(0, 16)}:${digestKey}`;
	const state = await memoryDomain.open(context, request);
	const existing = state.records.some((record) => record.id === stableId);
	const eventSeq = latestEventSeq(records);
	const sourceRefs = [{
		kind: "session",
		id: agent.id
	}];
	if (eventSeq !== void 0) sourceRefs.push({
		kind: "event",
		id: String(eventSeq)
	});
	const draft = {
		scope: state.scope,
		scopeKey: state.scopeKey,
		type: "fact",
		title: AUTO_FACT_TITLE,
		content,
		tags: AUTO_FACT_TAGS,
		...existing ? {} : { id: stableId },
		provenance: {
			kind: "tool",
			sessionId: agent.id,
			...eventSeq === void 0 ? {} : { eventSeq },
			note: "workspace auto-writer"
		},
		governance: {
			origin: "derived",
			sourceRefs,
			verification: "unverified",
			revision: 1,
			retention: memoryRetentionForScope(state.scope)
		}
	};
	const written = await memoryDomain.upsert(context, request, draft);
	const autoPrefix = `memory:auto:fact:${sha256Hex(scopeKey).slice(0, 16)}:`;
	const stale = state.records.filter((record) => record.id.startsWith(autoPrefix) && record.status === "active").filter((record) => record.id !== written.id).sort((left, right) => right.updatedAt - left.updatedAt).slice(5);
	for (const record of stale) try {
		await memoryDomain.archive(context, request, record.id);
	} catch {}
	return written.id;
}
/**
* Host-side Memory auto-writer. Observes the existing `tools/result` seam,
* debounces per session, derives a structured session digest, and upserts a
* governed `unverified` `session`-scope `fact` record (stable id, updated in
* place) so Memory exports carry useful information. No Agent/model context is
* touched; the governance model is unchanged. Returns a disposer.
*/
function attachWorkspaceMemoryAutoWriter(ctx, memoryDomain) {
	const pending = /* @__PURE__ */ new Map();
	const timers = /* @__PURE__ */ new Map();
	const flush = async (agent) => {
		timers.delete(agent.id);
		if (!memoryDomain) return;
		try {
			await writeAutoFact(memoryDomain, agent);
		} catch {}
	};
	const onToolResult = (exec) => {
		if (!memoryDomain) return void 0;
		const agent = exec.agent;
		if (!agent?.session) return void 0;
		pending.set(agent.id, agent);
		const existing = timers.get(agent.id);
		if (existing !== void 0) clearTimeout(existing);
		timers.set(agent.id, setTimeout(() => {
			flush(pending.get(agent.id)).catch(() => {});
		}, AUTO_WRITE_DEBOUNCE_MS));
	};
	ctx.on("tools/result", onToolResult);
	return () => {
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
		pending.clear();
	};
}
//#endregion
//#region packages/plugin/src/host/workspace-resource.ts
const VENDOR_PATH = "/workspace/vendor/mermaid.js";
/**
* Register the mermaid vendor bundle route: a fixed same-origin static asset
* served with size+mtime ETag (dsh-web-ui serveVendorMermaid pattern). The
* bundle ships inside the plugin package (lib/assets/mermaid.min.js, copied at
* build time) so the browser never loads mermaid from a CDN — ADR 0011 keeps
* the surface zero-runtime-dependency and privacy-bounded.
*/
function registerWorkspaceVendorRoute(webServer, options = {}) {
	if (!webServer?.register) throw new Error("Workspace vendor route requires the public WebServer");
	const path = options.path ?? VENDOR_PATH;
	if (!/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) throw new Error("Workspace vendor route path is invalid");
	let cached;
	return webServer.register({
		kind: "exact",
		path,
		handler: async (_request, response) => {
			try {
				if (!cached) {
					const candidates = ["./assets/mermaid.min.js", "../../lib/assets/mermaid.min.js"];
					let assetPath;
					let info;
					for (const relative of candidates) try {
						const candidate = fileURLToPath(new URL(relative, import.meta.url));
						info = await stat(candidate);
						assetPath = candidate;
						break;
					} catch {}
					if (!assetPath || !info) throw new Error("mermaid vendor asset missing");
					const { readFile } = await import("node:fs/promises");
					const data = await readFile(assetPath);
					cached = {
						data,
						etag: `"${data.length}-${info.mtimeMs.toString(16)}"`
					};
				}
				response.writeHead(200, {
					"content-type": "application/javascript; charset=utf-8",
					"content-length": cached.data.length,
					"cache-control": "no-cache",
					etag: cached.etag,
					"x-content-type-options": "nosniff"
				});
				response.end(cached.data);
			} catch {
				response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
				response.end(JSON.stringify({ error: "mermaid vendor asset missing" }));
			}
		}
	});
}
/** Tie the vendor route to the owning Fiber. */
function installWorkspaceVendorRoute(ctx, webServer, options = {}) {
	if (!ctx?.effect) throw new Error("Workspace vendor route requires a Fiber effect registrar");
	ctx.effect(() => {
		return registerWorkspaceVendorRoute(webServer, options);
	}, "workspace vendor route");
}
function headerValue(value) {
	return Array.isArray(value) ? value.length === 1 ? value[0] : void 0 : value;
}
function statusFor(error) {
	if (!(error instanceof PreviewPanelError)) return 404;
	if (error.code === "RESOURCE_EXPIRED" || error.code === "RESOURCE_STALE") return 410;
	if (error.code === "FILE_TOO_LARGE") return 413;
	return 404;
}
function noStore(response, status) {
	response.writeHead(status, {
		"cache-control": "no-store",
		"content-length": "0"
	});
	response.end();
}
/** Strip the weak prefix and quotes so entity-tags compare by opaque value. */
function normalizeEtag(value) {
	return value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}
/** Whether an If-None-Match header matches the current etag (weak compare). */
function ifNoneMatchSaidFresh(header, etag) {
	if (header === void 0) return false;
	const current = normalizeEtag(etag);
	return header.split(",").some((candidate) => {
		const tag = candidate.trim();
		return tag === "*" || normalizeEtag(tag) === current;
	});
}
/**
* Parse a `Range: bytes=start-end` header against the total size. Returns
* `{start,end}` for a satisfiable single range, 'invalid' for a syntactically
* valid range that cannot be satisfied, or null when the header is absent or
* unsupported (RFC 7233: a server may ignore any Range it does not support).
*/
function parseByteRange(header, size) {
	if (header === void 0) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (match === null || match[1] === "" && match[2] === "") return null;
	if (match[1] === "") {
		const suffix = Number(match[2]);
		if (suffix <= 0 || size === 0) return "invalid";
		return {
			start: Math.max(0, size - suffix),
			end: size - 1
		};
	}
	const start = Number(match[1]);
	const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
	if (size === 0 || start > end || start >= size) return "invalid";
	return {
		start,
		end
	};
}
/** Register the opaque capability carrier; optional identity headers further bind a request when available. */
function registerWorkspaceResourceRoute(webServer, options) {
	if (!webServer?.register || !options?.preview) throw new Error("Workspace resource route requires the public WebServer and PreviewService");
	const path = options.path ?? "/workspace/resource";
	if (!/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) throw new Error("Workspace resource route path is invalid");
	return webServer.register({
		kind: "exact",
		path,
		handler: async (request, response) => {
			const url = new URL(request.url ?? "/", "http://workspace.local");
			const resourceId = url.searchParams.get("id");
			const mediaType = url.searchParams.get("type");
			const sessionId = headerValue(request.headers["x-dsh-session"]);
			const rootId = headerValue(request.headers["x-dsh-root"]);
			if (!resourceId || !mediaType || sessionId !== void 0 && sessionId !== options.preview.identity.sessionId || rootId !== void 0 && rootId !== options.preview.identity.rootId) {
				noStore(response, 404);
				return;
			}
			const controller = new AbortController();
			const abort = () => {
				if (!response.writableEnded) controller.abort();
			};
			if (typeof request.once === "function") request.once("aborted", abort);
			response.once?.("close", abort);
			try {
				const opened = await options.preview.openResource(resourceId, {
					identity: options.preview.identity,
					mediaType,
					signal: controller.signal
				});
				const etag = `"${opened.version}"`;
				const baseHeaders = {
					"cache-control": "no-cache",
					"content-type": opened.mediaType,
					"x-content-type-options": "nosniff",
					etag,
					"accept-ranges": "bytes"
				};
				if (ifNoneMatchSaidFresh(request.headers["if-none-match"], etag) && request.headers.range === void 0) {
					response.writeHead(304, baseHeaders);
					response.end();
					return;
				}
				const bytes = opened.bytes;
				const total = bytes.byteLength;
				const range = parseByteRange(request.headers.range, total);
				if (range === "invalid") {
					response.writeHead(416, {
						...baseHeaders,
						"content-range": `bytes */${total}`
					});
					response.end();
					return;
				}
				if (url.searchParams.get("download") === "1") baseHeaders["content-disposition"] = `attachment; filename="${opened.downloadName.replace(/["\\\r\n]/gu, "_")}"`;
				if (range === null) {
					baseHeaders["content-length"] = total;
					response.writeHead(200, baseHeaders);
					response.end(Buffer.from(bytes));
				} else {
					baseHeaders["content-range"] = `bytes ${range.start}-${range.end}/${total}`;
					baseHeaders["content-length"] = range.end - range.start + 1;
					response.writeHead(206, baseHeaders);
					response.end(Buffer.from(bytes.subarray(range.start, range.end + 1)));
				}
			} catch (error) {
				noStore(response, statusFor(error));
			} finally {
				request.off?.("aborted", abort);
				response.off?.("close", abort);
			}
		}
	});
}
/** Tie the route and its opaque resource table to the owning Fiber. */
function installWorkspaceResourceRoute(ctx, webServer, options) {
	if (!ctx?.effect) throw new Error("Workspace resource route requires a Fiber effect registrar");
	ctx.effect(() => {
		const disposeRoute = registerWorkspaceResourceRoute(webServer, options);
		return () => {
			disposeRoute();
			options.preview.dispose();
		};
	}, "workspace opaque resource route");
}
//#endregion
//#region packages/plugin/src/index.ts
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
let WorkspaceService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _summary_decorators;
	let _workspaceSummary_decorators;
	let _focus_decorators;
	let _artifactMetadata_decorators;
	let _previewArtifact_decorators;
	let _memoryOpen_decorators;
	let _memoryList_decorators;
	let _memoryUpsert_decorators;
	let _memoryArchive_decorators;
	let _memoryForget_decorators;
	let _memorySearch_decorators;
	let _memoryMarkUsed_decorators;
	let _memoryGovern_decorators;
	let _memoryExport_decorators;
	let _memoryImport_decorators;
	let _memoryExportMarkdown_decorators;
	let _memoryImportMarkdown_decorators;
	let _memoryClose_decorators;
	let _gitStatus_decorators;
	let _gitDiff_decorators;
	let _gitHistory_decorators;
	let _gitCommit_decorators;
	let _gitRepoInfo_decorators;
	return class WorkspaceService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_summary_decorators = [Remote];
			_workspaceSummary_decorators = [Remote("workspaceSummary")];
			_focus_decorators = [Remote("focus")];
			_artifactMetadata_decorators = [Remote("artifactMetadata")];
			_previewArtifact_decorators = [Remote("previewArtifact")];
			_memoryOpen_decorators = [Remote("memoryOpen")];
			_memoryList_decorators = [Remote("memoryList")];
			_memoryUpsert_decorators = [Remote("memoryUpsert")];
			_memoryArchive_decorators = [Remote("memoryArchive")];
			_memoryForget_decorators = [Remote("memoryForget")];
			_memorySearch_decorators = [Remote("memorySearch")];
			_memoryMarkUsed_decorators = [Remote("memoryMarkUsed")];
			_memoryGovern_decorators = [Remote("memoryGovern")];
			_memoryExport_decorators = [Remote("memoryExport")];
			_memoryImport_decorators = [Remote("memoryImport")];
			_memoryExportMarkdown_decorators = [Remote("memoryExportMarkdown")];
			_memoryImportMarkdown_decorators = [Remote("memoryImportMarkdown")];
			_memoryClose_decorators = [Remote("memoryClose")];
			_gitStatus_decorators = [Remote("gitStatus")];
			_gitDiff_decorators = [Remote("gitDiff")];
			_gitHistory_decorators = [Remote("gitHistory")];
			_gitCommit_decorators = [Remote("gitCommit")];
			_gitRepoInfo_decorators = [Remote("gitRepoInfo")];
			__esDecorate(this, null, _summary_decorators, {
				kind: "method",
				name: "summary",
				static: false,
				private: false,
				access: {
					has: (obj) => "summary" in obj,
					get: (obj) => obj.summary
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _workspaceSummary_decorators, {
				kind: "method",
				name: "workspaceSummary",
				static: false,
				private: false,
				access: {
					has: (obj) => "workspaceSummary" in obj,
					get: (obj) => obj.workspaceSummary
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _focus_decorators, {
				kind: "method",
				name: "focus",
				static: false,
				private: false,
				access: {
					has: (obj) => "focus" in obj,
					get: (obj) => obj.focus
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _artifactMetadata_decorators, {
				kind: "method",
				name: "artifactMetadata",
				static: false,
				private: false,
				access: {
					has: (obj) => "artifactMetadata" in obj,
					get: (obj) => obj.artifactMetadata
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _previewArtifact_decorators, {
				kind: "method",
				name: "previewArtifact",
				static: false,
				private: false,
				access: {
					has: (obj) => "previewArtifact" in obj,
					get: (obj) => obj.previewArtifact
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryOpen_decorators, {
				kind: "method",
				name: "memoryOpen",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryOpen" in obj,
					get: (obj) => obj.memoryOpen
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryList_decorators, {
				kind: "method",
				name: "memoryList",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryList" in obj,
					get: (obj) => obj.memoryList
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryUpsert_decorators, {
				kind: "method",
				name: "memoryUpsert",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryUpsert" in obj,
					get: (obj) => obj.memoryUpsert
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryArchive_decorators, {
				kind: "method",
				name: "memoryArchive",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryArchive" in obj,
					get: (obj) => obj.memoryArchive
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryForget_decorators, {
				kind: "method",
				name: "memoryForget",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryForget" in obj,
					get: (obj) => obj.memoryForget
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memorySearch_decorators, {
				kind: "method",
				name: "memorySearch",
				static: false,
				private: false,
				access: {
					has: (obj) => "memorySearch" in obj,
					get: (obj) => obj.memorySearch
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryMarkUsed_decorators, {
				kind: "method",
				name: "memoryMarkUsed",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryMarkUsed" in obj,
					get: (obj) => obj.memoryMarkUsed
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryGovern_decorators, {
				kind: "method",
				name: "memoryGovern",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryGovern" in obj,
					get: (obj) => obj.memoryGovern
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryExport_decorators, {
				kind: "method",
				name: "memoryExport",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryExport" in obj,
					get: (obj) => obj.memoryExport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryImport_decorators, {
				kind: "method",
				name: "memoryImport",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryImport" in obj,
					get: (obj) => obj.memoryImport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryExportMarkdown_decorators, {
				kind: "method",
				name: "memoryExportMarkdown",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryExportMarkdown" in obj,
					get: (obj) => obj.memoryExportMarkdown
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryImportMarkdown_decorators, {
				kind: "method",
				name: "memoryImportMarkdown",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryImportMarkdown" in obj,
					get: (obj) => obj.memoryImportMarkdown
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _memoryClose_decorators, {
				kind: "method",
				name: "memoryClose",
				static: false,
				private: false,
				access: {
					has: (obj) => "memoryClose" in obj,
					get: (obj) => obj.memoryClose
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _gitStatus_decorators, {
				kind: "method",
				name: "gitStatus",
				static: false,
				private: false,
				access: {
					has: (obj) => "gitStatus" in obj,
					get: (obj) => obj.gitStatus
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _gitDiff_decorators, {
				kind: "method",
				name: "gitDiff",
				static: false,
				private: false,
				access: {
					has: (obj) => "gitDiff" in obj,
					get: (obj) => obj.gitDiff
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _gitHistory_decorators, {
				kind: "method",
				name: "gitHistory",
				static: false,
				private: false,
				access: {
					has: (obj) => "gitHistory" in obj,
					get: (obj) => obj.gitHistory
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _gitCommit_decorators, {
				kind: "method",
				name: "gitCommit",
				static: false,
				private: false,
				access: {
					has: (obj) => "gitCommit" in obj,
					get: (obj) => obj.gitCommit
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _gitRepoInfo_decorators, {
				kind: "method",
				name: "gitRepoInfo",
				static: false,
				private: false,
				access: {
					has: (obj) => "gitRepoInfo" in obj,
					get: (obj) => obj.gitRepoInfo
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["agents"];
		memoryDomain = __runInitializers(this, _instanceExtraInitializers);
		memoryWorkspaceSnapshots = /* @__PURE__ */ new Map();
		artifactCarrier;
		artifactAgentId;
		artifactRouteDispose;
		constructor(ctx, config = {}) {
			super(ctx, "workspace");
			this.memoryDomain = config.memoryDomain ?? new WorkspaceMemoryDomain();
			ctx.effect(() => () => {
				this.memoryDomain.dispose();
				this.artifactRouteDispose?.();
				this.artifactRouteDispose = void 0;
				this.artifactCarrier?.dispose();
				this.artifactCarrier = void 0;
				this.artifactAgentId = void 0;
				this.memoryWorkspaceSnapshots.clear();
			}, "workspace artifact carrier");
		}
		summary(agent) {
			return {
				ready: true,
				agent
			};
		}
		/**
		* Derive the current session summary from allow-listed durable tool records
		* (tool/call + tool/result). Never writes a custom event to the session log:
		* persisting `workspace/summary` made the whole log unloadable after a
		* restart (cold-read rejects unknown non-ignorable event types).
		*/
		async workspaceSummary(agentId) {
			const agent = this.ctx.agents.get(agentId);
			if (!agent?.session) return void 0;
			return workspaceSummaryWithMemory({
				id: agentId,
				session: {
					header: { cwd: agent.session.header?.cwd },
					events: agent.session.events
				}
			}, this.memoryDomain);
		}
		focus(agentId) {
			return { focused: true };
		}
		async artifactMetadata(agentId) {
			const agent = this.ctx.agents.get(agentId);
			if (!agent) return [];
			return (await this.carrier(agent))?.metadata() ?? [];
		}
		async previewArtifact(agentId, id) {
			const agent = this.ctx.agents.get(agentId);
			if (!agent) return {
				type: "error",
				code: "PROVIDER_UNAVAILABLE",
				message: "Workspace artifact carrier is unavailable"
			};
			const carrier = await this.carrier(agent);
			return carrier ? carrier.previewArtifact(id) : {
				type: "error",
				code: "PROVIDER_UNAVAILABLE",
				message: "Workspace artifact carrier is unavailable"
			};
		}
		async memoryOpen(agentId, request) {
			return this.memoryDomain.open(this.memoryContext(this.agent(agentId), request), request);
		}
		async memoryList(agentId, request, options) {
			return this.memoryDomain.list(this.memoryContext(this.agent(agentId), request), request, options ?? {});
		}
		async memoryUpsert(agentId, request, draft) {
			return this.memoryDomain.upsert(this.memoryContext(this.agent(agentId), request), request, draft);
		}
		async memoryArchive(agentId, request, id, expectedRevision, expectedHash) {
			return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, "archive", expectedRevision, expectedHash);
		}
		async memoryForget(agentId, request, id, expectedRevision, expectedHash) {
			return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, "forget", expectedRevision, expectedHash);
		}
		async memorySearch(agentId, request, query, options) {
			return this.memoryDomain.search(this.memoryContext(this.agent(agentId), request), request, query, options ?? {});
		}
		async memoryMarkUsed(agentId, request, id) {
			return this.memoryDomain.markUsed(this.memoryContext(this.agent(agentId), request), request, id);
		}
		async memoryGovern(agentId, request, id, action, expectedRevision, expectedHash) {
			return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, action, expectedRevision, expectedHash);
		}
		async memoryExport(agentId, request) {
			return this.memoryDomain.export(this.memoryContext(this.agent(agentId), request), request);
		}
		async memoryImport(agentId, request, serialized) {
			return this.memoryDomain.import(this.memoryContext(this.agent(agentId), request), request, serialized);
		}
		async memoryExportMarkdown(agentId, request) {
			return this.memoryDomain.exportMarkdown(this.memoryContext(this.agent(agentId), request), request);
		}
		async memoryImportMarkdown(agentId, request, markdown) {
			return this.memoryDomain.importMarkdown(this.memoryContext(this.agent(agentId), request), request, markdown);
		}
		async memoryClose(agentId, request) {
			return this.memoryDomain.close(this.memoryContext(this.agent(agentId), request), request);
		}
		async gitStatus(agentId) {
			return gitStatus(this.rootFor(this.agent(agentId)));
		}
		async gitDiff(agentId, path) {
			return gitDiff(this.rootFor(this.agent(agentId)), path);
		}
		async gitHistory(agentId, options) {
			return gitHistory(this.rootFor(this.agent(agentId)), options);
		}
		async gitCommit(agentId, sha) {
			return gitCommit(this.rootFor(this.agent(agentId)), sha);
		}
		async gitRepoInfo(agentId) {
			return gitRepoInfo(this.rootFor(this.agent(agentId)));
		}
		rootFor(agent) {
			const cwd = agent.session?.header?.cwd;
			if (!cwd) throw new GitError("GIT_UNAVAILABLE", "Workspace Session is unavailable");
			return resolveWorkspaceRoot(cwd, ".");
		}
		agent(agentId) {
			const agent = this.ctx.agents.get(agentId);
			if (!agent) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
			return agent;
		}
		memoryContext(agent, request) {
			const cwd = agent.session?.header?.cwd;
			if (!cwd && request.scope === "user") return { identity: {
				sessionId: agent.id,
				rootId: "root:unavailable"
			} };
			if (!cwd) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
			try {
				const existingSnapshot = this.memoryWorkspaceSnapshots.get(agent.id);
				const snapshot = existingSnapshot ? resumeWorkspace({
					snapshot: existingSnapshot,
					sessionId: agent.id,
					processCwd: cwd
				}) : startWorkspace({
					sessionId: agent.id,
					processCwd: cwd
				});
				this.memoryWorkspaceSnapshots.set(agent.id, snapshot);
				return {
					identity: snapshot.identity,
					root: resolveWorkspaceRoot(cwd, ".")
				};
			} catch (error) {
				if (request.scope === "user") return { identity: {
					sessionId: agent.id,
					rootId: "root:unavailable"
				} };
				throw new MemoryStoreError("PROJECT_UNAVAILABLE", error instanceof Error ? error.message : "Workspace Root is unavailable");
			}
		}
		async carrier(agent) {
			const agentView = agent;
			const cwd = agentView.session?.header?.cwd;
			if (!cwd || typeof agent.id !== "string") return void 0;
			const carrierKey = `${agent.id}\u0000${cwd}`;
			if (this.artifactCarrier && this.artifactAgentId === carrierKey) return this.artifactCarrier;
			this.artifactRouteDispose?.();
			this.artifactRouteDispose = void 0;
			this.artifactCarrier?.dispose();
			try {
				const root = resolveWorkspaceRoot(cwd, ".");
				const workspace = startWorkspace({
					sessionId: agent.id,
					processCwd: cwd
				});
				this.artifactCarrier = new WorkspaceArtifactCarrier({
					workspace,
					root,
					records: () => sessionToolRecords(agentView.session?.events ?? [], root)
				});
				this.artifactAgentId = carrierKey;
				const webServer = this.ctx.get("webServer");
				if (webServer?.register) {
					const carrier = this.artifactCarrier;
					this.artifactRouteDispose = this.ctx.effect(() => {
						const disposeResource = registerWorkspaceResourceRoute(webServer, { preview: carrier.preview });
						const disposeVendor = registerWorkspaceVendorRoute(webServer);
						return () => {
							disposeVendor();
							disposeResource();
						};
					}, "workspace opaque artifact + vendor routes");
				}
				return this.artifactCarrier;
			} catch (error) {
				this.artifactRouteDispose?.();
				this.artifactRouteDispose = void 0;
				this.artifactCarrier?.dispose();
				this.artifactCarrier = void 0;
				this.artifactAgentId = void 0;
				throw error;
			}
		}
	};
})();
const name = "dsh-workspace-plugin";
const inject = ["tools", "systemPrompt"];
function apply(ctx) {
	const memoryDomain = new WorkspaceMemoryDomain();
	ctx.plugin(WorkspaceService, { memoryDomain });
	ctx.effect(() => registerMemoryPropose(ctx, memoryDomain), "dsh-workspace memory propose tool");
	ctx.effect(() => attachWorkspaceSummaryEmitter(ctx, memoryDomain), "dsh-workspace summary emitter");
	ctx.effect(() => attachWorkspaceMemoryAutoWriter(ctx, memoryDomain), "dsh-workspace memory auto-writer");
}
//#endregion
export { AUTO_FACT_TAGS, AUTO_FACT_TITLE, GIT_COMMIT_MAX_DIFF_BYTES, GIT_HISTORY_MAX_COMMITS, GIT_MAX_DIFF_BYTES, GitError, MEMORY_MAX_CONTENT_BYTES, MEMORY_MAX_FILE_BYTES, MEMORY_MAX_QUERY_BYTES, MEMORY_MAX_RESULTS, MEMORY_MAX_TAGS, MEMORY_MAX_TAG_BYTES, MEMORY_MAX_TITLE_BYTES, MEMORY_PROPOSE_SECTION, MEMORY_PROPOSE_TOOL_NAME, MEMORY_SCHEMA_VERSION, MEMORY_TYPES, MemoryGovernanceError, MemoryStore, MemoryStoreError, PreviewPanelError, PreviewService, WorkspaceArtifactCarrier, WorkspaceDeliverableError, WorkspaceMemoryDomain, WorkspaceService, apply, assertMemoryRevision, attachWorkspaceMemoryAutoWriter, attachWorkspaceSummaryEmitter, buildAutoFactContent, conflictGroupFor, createMemoryProposeTool, createWorkspaceDeliverable, deliverableResourceId, exportMemoryBundle, gitCommit, gitDiff, gitHistory, gitRepoInfo, gitStatus, importMemoryBundle, inject, installWorkspaceResourceRoute, installWorkspaceVendorRoute, isGitRepository, memoryGovernance, memoryGovernanceEligible, memoryLogicalLocation, memoryStorePath, name, parsePorcelain, proposeMemory, registerMemoryPropose, registerWorkspaceResourceRoute, registerWorkspaceVendorRoute, safeDownloadName, sessionToolRecords, sourceRef, transitionMemoryGovernance, workspaceMemoryContextFor, workspaceSummaryFor, workspaceSummaryWithMemory, writeAutoFact };
