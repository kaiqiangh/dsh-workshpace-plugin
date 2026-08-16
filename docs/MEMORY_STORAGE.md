# Workspace Memory Storage

本文件回答两个问题：**Memory 数据存在哪里**，以及**以什么数据结构/形式存储**。涵盖手动创建、Agent 提案与自动派生三类来源（自动派生即 v0.2 的「Memory 自动写入」机制）。

## 1. 数据存储位置（按作用域）

所有记录以 **JSONL**（每行一条 JSON 记录）落盘。根目录由 `DSH_HOME` 决定，默认 `~/.dsh`。

| 作用域 scope     | 存储路径                                                    | 说明                                                                               |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `session`        | `~/.dsh/workspace-memory/sessions/<sha256(scopeKey)>.jsonl` | scopeKey = `${sessionId}\|${rootId}`；随会话生命周期，默认 `retention=session-end` |
| `project`        | `<workspaceRoot>/.dsh/workspace-memory/records.jsonl`       | 项目级，随项目删除                                                                 |
| `shared-project` | `<workspaceRoot>/.dsh/workspace-memory/shared.jsonl`        | 共享项目，写需显式确认                                                             |
| `user`           | `~/.dsh/workspace-memory/user.jsonl`                        | 按 userId 分档（同一文件可含多档，互不污染）                                       |

安全加固：目录 `0700`、文件 `0600`；写操作使用 `<file>.lock` 锁；损坏行隔离到 `<file>.corrupt`；压缩时先写 `<file>.bak` 备份再原子替换。

## 2. 数据结构（一条 MemoryRecord）

JSON 字段如下（`schemaVersion = 1`）：

```jsonc
{
  "schemaVersion": 1,
  "id": "memory:auto:fact:1a2b3c4d5e6f7a8b:9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b",
  "scope": "session",
  "scopeKey": "session-abc|root-xyz",
  "type": "fact",                        // decision | preference | convention | fact
  "title": "Session workspace digest (auto)",
  "content": "Files touched: 3 (2 created, 1 modified, 0 deleted)\nCreated: out/report.md, out/data.json\nModified: src/util.ts\nArtifacts: 2 — out/report.md, out/data.json",
  "tags": [],
  "provenance": { "kind": "tool", "sessionId": "session-abc", "eventSeq": 42, "note": "workspace auto-writer" },
  "createdAt": 1760000000000,
  "updatedAt": 1760000000000,
  "useCount": 0,
  "contentHash": "sha256:9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8",
  "status": "active",                    // active | archived | forgotten
  "governance": {
    "origin": "derived",                 // user-authored | imported | derived | model-suggested
    "sourceRefs": [
      { "kind": "session", "id": "session-abc" },
      { "kind": "event", "id": "42" }
    ],
    "verification": "unverified",        // unverified | verified | rejected | stale
    "revision": 1,
    "retention": "session-end"           // session-end | project-delete | user-managed
  }
}
```

约束要点（`MemoryStore.validateRecord` 强制）：
- `contentHash` 必须为 `sha256:<64 hex>` 且等于对 `content` 的哈希；
- 非 `user-authored` 记录必须有至少一个 `sourceRefs`；
- `verified` 必须带 `verifiedAt`；`revision >= 1`；时间戳 `updatedAt >= createdAt`；
- 单文件安全上限 8 MiB，超限只读（`STORE_TOO_LARGE`）。

## 3. 三类来源的差异

| 来源                                              | provenance.kind | governance.origin | verification                            | retention                       | 说明                                       |
| ------------------------------------------------- | --------------- | ----------------- | --------------------------------------- | ------------------------------- | ------------------------------------------ |
| **手动创建**（Memory 页签「Create Memory」）      | `user`          | `user-authored`   | `unverified`（点 Verify 后 `verified`） | 按 scope                        | 编辑已有记录会保留 id、递增 revision       |
| **Agent 提案**（`workspace_memory_propose` 工具） | `agent`         | `model-suggested` | `unverified`                            | 按 scope                        | UI 显示为 "Proposal"，须人工 Verify/Reject |
| **自动派生**（v0.2 auto-writer）                  | `tool`          | `derived`         | `unverified`                            | `session-end`（session 作用域） | 见下节                                     |

## 4. Memory 自动写入（v0.2）

`src/host/workspace-memory-auto-write.ts` 的 `attachWorkspaceMemoryAutoWriter(ctx, memoryDomain)`：

1. 监听宿主 `tools/result`，按 session 防抖 **500ms**；
2. 复用 `SessionActivityObserver` / `sessionToolRecords` / `deriveArtifacts` 从 durable tool 记录推导本次会话的**有效信息**（非原始 JSON）：
   - 文件数聚合 `Files touched: N (X created, Y modified, Z deleted)`
   - 新建/修改/删除的相对路径清单
   - 构件清单 `Artifacts: M — …`
3. 写入一条 **session 作用域** `fact` 记录（见上示例）：
   - **稳定 id** `memory:auto:fact:<scopeKeyHash16>:<digestKey24>`，digestKey = sha256(created/modified/deleted/artifacts 计数)；
   - 相同 digest 再次触发 → 走 `(type + contentHash)` 幂等合并，**不新增行**、id 稳定；
   - digest 变化 → 追加新记录；**每 session 最多保留 6 条**，超出自动 archive 最旧（防堆积）；
   - 异常（无 memoryDomain、坏 cwd、store 只读/损坏）**静默跳过**，不打断会话。

效果：只要 Agent 触碰过文件，Memory 页签与「Export Memory」就会自动携带「本次会话触碰了哪些文件/构件」的派生事实 —— 解决「每次 export 的 JSON 缺乏有用信息」的问题。

## 5. 导出 / 导入

- **Export Memory**：输出 JSON bundle `{ schemaVersion: 1, exportedAt, records: [...] }`，剔除 `forgotten`，每条记录补齐 governance。
- **Import Memory**：校验 bundle 后作为 `unverified` 审查项恢复（`origin=imported`）。

## 6. 说明

- Session 作用域记录随会话生命周期（`session-end`），不跨会话自动注入 Agent 上下文 —— 全部为**只读审查**语义。
