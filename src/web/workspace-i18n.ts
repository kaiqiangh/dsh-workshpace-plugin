/**
 * Zero-dependency Workspace i18n: a plain dictionary plus a `t()` lookup.
 * Keeps ADR 0011's zero-dependency constraint (no i18n framework) while
 * giving every surface English and Chinese copy. The active locale follows
 * the browser language by default and can be overridden per surface via
 * `workspaceLocale()`.
 */

import { useSyncExternalStore } from "react";

export type WorkspaceLocale = "en" | "zh";

export type WorkspaceMessageKey =
  // Shared primitives / generic
  | "refresh"
  | "cancel"
  | "search"
  | "download"
  | "downloading"
  | "cancelDownload"
  | "downloadStarted"
  | "loading"
  | "copy"
  // Artifacts surface
  | "artifacts.title"
  | "artifacts.count"
  | "artifacts.countOne"
  | "artifacts.requireSession"
  | "artifacts.unavailable"
  | "artifacts.loading"
  | "artifacts.empty"
  | "artifacts.noMatch"
  | "artifacts.searchLabel"
  | "artifacts.searchPlaceholder"
  | "artifacts.hiddenSkipped"
  | "artifacts.selectHint"
  | "artifacts.loadingPreview"
  | "artifacts.previewUnavailable"
  | "artifacts.category.documents"
  | "artifacts.category.data"
  | "artifacts.category.images"
  | "artifacts.category.other"
  | "artifacts.provenance"
  | "artifacts.source"
  | "artifacts.downloadUnsupported"
  | "artifacts.previewUnsupported"
  | "artifacts.previewAvailable"
  | "artifacts.previewOversized"
  | "artifacts.previewStale"
  | "artifacts.copyPath"
  | "artifacts.copied"
  | "artifacts.copyUnsupported"
  | "artifacts.emptyExplainer"
  | "artifacts.time.justNow"
  | "artifacts.time.minutesAgo"
  | "artifacts.time.hoursAgo"
  | "artifacts.time.daysAgo"
  | "artifacts.time.weeksAgo"
  // Memory surface
  | "memory.title"
  | "memory.requireSession"
  | "memory.unavailable"
  | "memory.loading"
  | "memory.scope"
  | "memory.scope.project"
  | "memory.scope.session"
  | "memory.scope.user"
  | "memory.scope.sharedProject"
  | "memory.searchLabel"
  | "memory.typeFilter"
  | "memory.statusFilter"
  | "memory.allTypes"
  | "memory.export"
  | "memory.exportMarkdown"
  | "memory.exportMarkdownHint"
  | "memory.exportMarkdownUnsupported"
  | "memory.import"
  | "memory.records"
  | "memory.recordOne"
  | "memory.governance"
  | "memory.operationFailed"
  | "memory.newerSchema"
  | "memory.warnings"
  | "memory.locally"
  | "memory.empty"
  | "memory.create"
  | "memory.edit"
  | "memory.titleField"
  | "memory.typeField"
  | "memory.contentField"
  | "memory.save"
  | "memory.saveChanges"
  | "memory.archive"
  | "memory.forget"
  | "memory.restore"
  | "memory.verify"
  | "memory.reverify"
  | "memory.reject"
  | "memory.pin"
  | "memory.unpin"
  | "memory.saved"
  | "memory.origin"
  | "memory.verification"
  | "memory.retention"
  | "memory.revision"
  | "memory.sources"
  | "memory.conflictGroup"
  | "memory.expires"
  | "memory.none"
  | "memory.conflictHint"
  | "memory.conflictTitle"
  | "memory.keepVersion"
  | "memory.selected"
  | "memory.conflict"
  | "memory.review"
  | "memory.readOnly"
  | "memory.reviewOnly"
  | "memory.forgetTitle"
  | "memory.forgetDescription"
  | "memory.forgetRecord"
  | "memory.ackSharedWrite"
  | "memory.userProfile"
  | "memory.proposal"
  | "memory.archived"
  | "memory.forgotten"
  | "memory.verified"
  | "memory.reverified"
  | "memory.pinned"
  | "memory.unpinned"
  | "memory.restored"
  | "memory.rejected"
  | "memory.exportReady"
  | "memory.imported"
  | "memory.keptVersion"
  | "memory.conflictResolved"
  | "memory.sharedWriteAck"
  | "memory.importSizeLimit"
  | "memory.recordSummary.never"
  // Changes surface
  | "changes.title"
  | "changes.count"
  | "changes.countPlural"
  | "changes.requireSession"
  | "changes.unavailable"
  | "changes.loading"
  | "changes.empty"
  | "changes.filter"
  | "changes.filter.all"
  | "changes.filter.added"
  | "changes.filter.modified"
  | "changes.filter.deleted"
  | "changes.filter.untracked"
  | "changes.filter.staged"
  | "changes.noFiltered"
  | "changes.selectHint"
  | "changes.loadingDiff"
  | "changes.diffUnavailable"
  | "changes.copyDiff"
  | "changes.copyUnavailable"
  | "changes.noDiffText"
  | "changes.copyFailed"
  | "changes.copyCopied"
  | "changes.newChanges"
  | "changes.diffTruncated"
  | "changes.untrackedNotice"
  | "changes.diffCollapsed"
  | "changes.staged"
  | "changes.unstaged"
  | "changes.noDiffContent"
  | "changes.collapseDiff"
  | "changes.expandDiff"
  | "changes.previousFile"
  | "changes.nextFile"
  | "changes.diffMode"
  | "changes.unified"
  | "changes.split"
  | "changes.hiddenLines"
  | "changes.hiddenLine"
  | "changes.group.staged"
  | "changes.group.unstaged"
  | "changes.group.untracked"
  | "changes.status.index"
  | "changes.status.worktree"
  | "changes.status.untracked"
  // Git tab: repo status header
  | "git.notARepo"
  | "git.notARepoHint"
  | "git.branch"
  | "git.clean"
  | "git.dirty"
  | "git.ahead"
  | "git.behind"
  | "git.staged"
  | "git.unstaged"
  | "git.untracked"
  | "git.refresh"
  // Git tab: History surface
  | "history.title"
  | "history.author"
  | "history.parents"
  | "history.filesChanged"
  | "history.additions"
  | "history.deletions"
  | "history.loading"
  | "history.empty"
  | "history.selectCommit"
  | "history.commitDetail"
  | "history.decorations"
  // Preview adapters
  | "preview.status"
  | "preview.jsonLabel"
  | "preview.csvTitle"
  | "preview.csvTruncatedTitle"
  | "preview.truncatedNote"
  | "preview.downloadName"
  | "preview.imageAlt"
  | "preview.resourceUnavailable"
  | "preview.previewUnavailable"
  | "preview.downloadUnavailable"
  | "preview.downloadAction"
  // Conversation view
  | "view.artifacts"
  | "view.memory"
  | "view.changes"
  | "view.git"
  | "view.history"
  | "view.workspace"
  | "summary.workspaceName"
  | "summary.files"
  | "summary.artifacts"
  | "summary.memory"
  | "summary.active"
  | "summary.justNow"
  | "summary.unavailable"
  // Remote / error messages
  | "error.gitUnavailable"
  | "error.notGitRepository"
  | "error.gitTimeout"
  | "error.gitOutputTooLarge"
  | "error.pathOutsideWorkspace"
  | "error.providerUnavailable"
  | "error.projectUnavailable"
  | "error.resourceStale"
  | "error.resourceExpired"
  | "error.fileTooLarge"
  | "error.symlinkEscape"
  // Memory surface redesign (#128): scope / type / governance / action tips + labels
  | "memory.scope.projectHint"
  | "memory.scope.sessionHint"
  | "memory.scope.userHint"
  | "memory.scope.sharedHint"
  | "memory.type.factHint"
  | "memory.type.decisionHint"
  | "memory.type.preferenceHint"
  | "memory.type.conventionHint"
  | "memory.type.proposalHint"
  | "memory.originHint"
  | "memory.verifiedHint"
  | "memory.retentionHint"
  | "memory.revisionHint"
  | "memory.sourcesHint"
  | "memory.expiresHint"
  | "memory.editHint"
  | "memory.verifyHint"
  | "memory.reverifyHint"
  | "memory.archiveHint"
  | "memory.forgetHint"
  | "memory.pinHint"
  | "memory.unpinHint"
  | "memory.copyHint"
  | "memory.viewSourceHint"
  | "memory.exportHint"
  | "memory.importHint"
  | "memory.status.active"
  | "memory.status.archived"
  | "memory.status.forgotten"
  | "memory.unverified"
  | "memory.stale"
  | "memory.relative.justNow"
  | "memory.relative.minutes"
  | "memory.relative.hours"
  | "memory.relative.days"
  | "memory.copy"
  | "memory.copyCopied"
  | "memory.copyFailed"
  | "memory.copyUnavailable"
  | "memory.viewSource"
  | "memory.sourceInfo"
  | "memory.provenance.kind"
  | "memory.provenance.session"
  | "memory.provenance.eventSeq"
  | "memory.provenance.note"
  | "memory.contentHash"
  | "memory.saveDisabled"
  | "memory.searchPlaceholder"
  | "memory.updatedAt"
  | "memory.selectHint"
  | "memory.version"
  | "memory.rev"
  // v0.7 prototype alignment (#123/#124): git status pill, change sigs, history detail
  | "git.onBranchPrefix"
  | "git.onBranchSuffix"
  | "git.sigNew"
  | "git.modeUnified"
  | "history.time";

type MessageTable = Record<WorkspaceMessageKey, { readonly en: string; readonly zh: string }>;

const table: MessageTable = {
  refresh: { en: "Refresh", zh: "刷新" },
  cancel: { en: "Cancel", zh: "取消" },
  search: { en: "Search", zh: "搜索" },
  download: { en: "Download", zh: "下载" },
  downloading: { en: "Downloading…", zh: "下载中…" },
  cancelDownload: { en: "Cancel download", zh: "取消下载" },
  downloadStarted: { en: "Download started.", zh: "下载已开始。" },
  loading: { en: "Loading…", zh: "加载中…" },
  copy: { en: "Copy", zh: "复制" },

  "artifacts.title": { en: "Artifacts", zh: "产物" },
  "artifacts.count": { en: "artifacts", zh: "个产物" },
  "artifacts.countOne": { en: "artifact", zh: "个产物" },
  "artifacts.requireSession": { en: "Workspace artifacts require an active Harness session.", zh: "Workspace 产物需要处于活动状态的 Harness 会话。" },
  "artifacts.unavailable": { en: "Workspace artifacts are unavailable.", zh: "Workspace 产物当前不可用。" },
  "artifacts.loading": { en: "Loading Workspace artifacts…", zh: "正在加载 Workspace 产物…" },
  "artifacts.empty": { en: "No session artifacts yet — ask the agent to create a file and it appears here automatically.", zh: "还没有会话产物——让智能体创建一个文件，它会自动出现在这里。" },
  "artifacts.noMatch": { en: "No artifacts match your search.", zh: "没有匹配搜索条件的产物。" },
  "artifacts.searchLabel": { en: "Search artifacts", zh: "搜索产物" },
  "artifacts.searchPlaceholder": { en: "Filter by name…", zh: "按名称筛选…" },
  "artifacts.hiddenSkipped": { en: "hidden", zh: "已隐藏" },
  "artifacts.selectHint": { en: "Select an artifact to preview it.", zh: "选择一个产物以预览。" },
  "artifacts.loadingPreview": { en: "Loading artifact preview…", zh: "正在加载产物预览…" },
  "artifacts.previewUnavailable": { en: "Workspace artifact preview is unavailable.", zh: "Workspace 产物预览不可用。" },
  "artifacts.category.documents": { en: "Documents", zh: "文档" },
  "artifacts.category.data": { en: "Data", zh: "数据" },
  "artifacts.category.images": { en: "Images", zh: "图片" },
  "artifacts.category.other": { en: "Other", zh: "其他" },
  "artifacts.provenance": { en: "Artifact provenance", zh: "产物来源" },
  "artifacts.source": { en: "Source", zh: "来源" },
  "artifacts.downloadUnsupported": { en: "Download is unsupported in this browser.", zh: "当前浏览器不支持下载。" },
  "artifacts.previewUnsupported": { en: "Preview unavailable", zh: "预览不可用" },
  "artifacts.previewAvailable": { en: "Preview available", zh: "可预览" },
  "artifacts.previewOversized": { en: "Too large to preview", zh: "过大，无法预览" },
  "artifacts.previewStale": { en: "Preview outdated", zh: "预览已过期" },
  "artifacts.copyPath": { en: "Copy path", zh: "复制路径" },
  "artifacts.copied": { en: "Path copied", zh: "路径已复制" },
  "artifacts.copyUnsupported": { en: "Copy is unavailable in this browser; select the path manually.", zh: "当前浏览器不支持复制；请手动选择路径。" },
  "artifacts.emptyExplainer": { en: "Artifacts appear when the agent creates files during this session. Deleted or non-previewable files are not listed.", zh: "当智能体在此会话中创建文件时，产物会出现在这里。已删除或无法预览的文件不会列出。" },
  "artifacts.time.justNow": { en: "just now", zh: "刚刚" },
  "artifacts.time.minutesAgo": { en: "{count}m ago", zh: "{count} 分钟前" },
  "artifacts.time.hoursAgo": { en: "{count}h ago", zh: "{count} 小时前" },
  "artifacts.time.daysAgo": { en: "{count}d ago", zh: "{count} 天前" },
  "artifacts.time.weeksAgo": { en: "{count}w ago", zh: "{count} 周前" },

  "memory.title": { en: "Memory", zh: "记忆" },
  "memory.requireSession": { en: "Workspace Memory requires an active Harness session.", zh: "Workspace 记忆需要处于活动状态的 Harness 会话。" },
  "memory.unavailable": { en: "Workspace Memory is unavailable.", zh: "Workspace 记忆当前不可用。" },
  "memory.loading": { en: "Loading Workspace Memory…", zh: "正在加载 Workspace 记忆…" },
  "memory.scope": { en: "Memory scope", zh: "记忆范围" },
  "memory.scope.project": { en: "Project", zh: "项目" },
  "memory.scope.session": { en: "Session", zh: "会话" },
  "memory.scope.user": { en: "User", zh: "用户" },
  "memory.scope.sharedProject": { en: "Shared Project", zh: "共享项目" },
  "memory.searchLabel": { en: "Search Memory", zh: "搜索记忆" },
  "memory.typeFilter": { en: "Type filter", zh: "类型筛选" },
  "memory.statusFilter": { en: "Status filter", zh: "状态筛选" },
  "memory.allTypes": { en: "All types", zh: "全部类型" },
  "memory.export": { en: "Export Memory", zh: "导出记忆" },
  "memory.exportMarkdown": { en: "Export Markdown", zh: "导出 Markdown" },
  "memory.exportMarkdownHint": { en: "Download a human-readable Markdown file", zh: "下载人类可读的 Markdown 文件" },
  "memory.exportMarkdownUnsupported": { en: "Markdown export is not supported by this host.", zh: "当前主机不支持 Markdown 导出。" },
  "memory.import": { en: "Import Memory", zh: "导入记忆" },
  "memory.records": { en: "records", zh: "条记录" },
  "memory.recordOne": { en: "record", zh: "条记录" },
  "memory.governance": { en: "Memory governance", zh: "记忆治理" },
  "memory.operationFailed": { en: "Memory operation failed; records were not changed.", zh: "记忆操作失败；记录未更改。" },
  "memory.newerSchema": { en: "This Memory file uses a newer schema and is read-only.", zh: "此记忆文件使用更新的架构，为只读。" },
  "memory.warnings": { en: "local record warning(s).", zh: "条本地记录警告。" },
  "memory.locally": { en: "locally.", zh: "到本地。" },
  "memory.empty": { en: "No Memory records for this scope yet. Save a record or ask the agent to propose one.", zh: "此范围内还没有记忆记录。保存一条记录，或让智能体提议一条。" },
  "memory.create": { en: "Create Memory", zh: "新建记忆" },
  "memory.edit": { en: "Edit", zh: "编辑" },
  "memory.titleField": { en: "Title", zh: "标题" },
  "memory.typeField": { en: "Type", zh: "类型" },
  "memory.contentField": { en: "Content", zh: "内容" },
  "memory.save": { en: "Create Memory", zh: "新建记忆" },
  "memory.saveChanges": { en: "Save changes", zh: "保存修改" },
  "memory.archive": { en: "Archive", zh: "归档" },
  "memory.forget": { en: "Forget", zh: "遗忘" },
  "memory.restore": { en: "Restore", zh: "恢复" },
  "memory.verify": { en: "Verify", zh: "验证" },
  "memory.reverify": { en: "Re-verify", zh: "重新验证" },
  "memory.reject": { en: "Reject conflict", zh: "拒绝冲突" },
  "memory.pin": { en: "Pin", zh: "置顶" },
  "memory.unpin": { en: "Unpin", zh: "取消置顶" },
  "memory.saved": { en: "Memory saved locally.", zh: "记忆已保存到本地。" },
  "memory.origin": { en: "Origin", zh: "来源" },
  "memory.verification": { en: "Verification", zh: "验证状态" },
  "memory.retention": { en: "Retention", zh: "保留策略" },
  "memory.revision": { en: "Revision", zh: "修订号" },
  "memory.sources": { en: "Sources", zh: "来源引用" },
  "memory.conflictGroup": { en: "Conflict group", zh: "冲突分组" },
  "memory.expires": { en: "Expires", zh: "过期时间" },
  "memory.none": { en: "none", zh: "无" },
  "memory.conflictHint": { en: "Conflicting Memory uses the same title and type with different content. Verify one or reject this item.", zh: "存在同标题同类型但内容不同的冲突记忆。请验证一条，或拒绝此项。" },
  "memory.conflictTitle": { en: "Conflict comparison", zh: "冲突对比" },
  "memory.keepVersion": { en: "Keep this version", zh: "保留此版本" },
  "memory.selected": { en: "Selected", zh: "已选择" },
  "memory.conflict": { en: "Conflict", zh: "冲突" },
  "memory.review": { en: "Review", zh: "审阅" },
  "memory.readOnly": { en: "Read-only Memory", zh: "只读记忆" },
  "memory.reviewOnly": { en: "Review only: Memory never injects records into Agent context.", zh: "仅审阅：记忆绝不会向智能体上下文注入记录。" },
  "memory.forgetTitle": { en: "Forget Memory?", zh: "遗忘此记忆？" },
  "memory.forgetDescription": { en: "This will tombstone 1 record in {scope}. Existing exports or model turns cannot be recalled.", zh: "这将在{scope}中标记 1 条记录为已删除。已有的导出或模型轮次将无法找回。" },
  "memory.forgetRecord": { en: "Forget record", zh: "遗忘记录" },
  "memory.ackSharedWrite": { en: " I understand this writes to the shared Workspace Memory.", zh: " 我了解这会写入共享的 Workspace 记忆。" },
  "memory.userProfile": { en: "User profile", zh: "用户档案" },
  "memory.proposal": { en: "Proposal", zh: "提议" },
  "memory.archived": { en: "archived", zh: "已归档" },
  "memory.forgotten": { en: "forgotten", zh: "已遗忘" },
  "memory.verified": { en: "verified", zh: "已验证" },
  "memory.reverified": { en: "re-verified", zh: "已重新验证" },
  "memory.pinned": { en: "pinned", zh: "已置顶" },
  "memory.unpinned": { en: "unpinned", zh: "已取消置顶" },
  "memory.restored": { en: "restored", zh: "已恢复" },
  "memory.rejected": { en: "rejected", zh: "已拒绝" },
  "memory.exportReady": { en: "Memory export ready ({bytes} bytes).", zh: "记忆导出就绪（{bytes} 字节）。" },
  "memory.imported": { en: "{count} record(s) imported as unverified review items.", zh: "已导入 {count} 条记录，作为未验证的审阅项。" },
  "memory.keptVersion": { en: "Kept the selected Memory version and resolved conflicting records.", zh: "已保留所选记忆版本并解决冲突记录。" },
  "memory.conflictResolved": { en: "Memory conflict resolved.", zh: "记忆冲突已解决。" },
  "memory.sharedWriteAck": { en: "Acknowledge Shared Project writes before changing Memory.", zh: "修改记忆前，请先确认你了解共享项目的写入。" },
  "memory.importSizeLimit": { en: "Memory import exceeds the safe size limit.", zh: "记忆导入超过安全大小限制。" },
  "memory.recordSummary.never": { en: "never", zh: "从未" },

  "changes.title": { en: "Changes", zh: "变更" },
  "changes.count": { en: "{count} change", zh: "{count} 个变更" },
  "changes.countPlural": { en: "{count} changes", zh: "{count} 个变更" },
  "changes.requireSession": { en: "Git changes require an active Harness session.", zh: "Git 变更需要处于活动状态的 Harness 会话。" },
  "changes.unavailable": { en: "Git changes are unavailable.", zh: "Git 变更当前不可用。" },
  "changes.loading": { en: "Loading git changes…", zh: "正在加载 Git 变更…" },
  "changes.empty": { en: "No changes in the working tree.", zh: "工作区中没有变更。" },
  "changes.filter": { en: "Filter changes", zh: "筛选变更" },
  "changes.filter.all": { en: "All", zh: "全部" },
  "changes.filter.added": { en: "Added", zh: "新增" },
  "changes.filter.modified": { en: "Modified", zh: "修改" },
  "changes.filter.deleted": { en: "Deleted", zh: "删除" },
  "changes.filter.untracked": { en: "Untracked", zh: "未跟踪" },
  "changes.filter.staged": { en: "Staged", zh: "已暂存" },
  "changes.noFiltered": { en: "No {filter} changes in this view.", zh: "此视图中没有{filter}变更。" },
  "changes.selectHint": { en: "Select a file to preview its diff.", zh: "选择文件以预览其 diff。" },
  "changes.loadingDiff": { en: "Loading diff…", zh: "正在加载 diff…" },
  "changes.diffUnavailable": { en: "Diff is unavailable for this change.", zh: "此变更的 diff 不可用。" },
  "changes.copyDiff": { en: "Copy diff", zh: "复制 diff" },
  "changes.copyUnavailable": { en: "Copy is unavailable in this browser; select the diff text manually.", zh: "当前浏览器不支持复制；请手动选择 diff 文本。" },
  "changes.noDiffText": { en: "There is no diff text to copy.", zh: "没有可复制的 diff 文本。" },
  "changes.copyFailed": { en: "Copy failed; select the diff text manually.", zh: "复制失败；请手动选择 diff 文本。" },
  "changes.copyCopied": { en: "Diff copied to the clipboard.", zh: "diff 已复制到剪贴板。" },
  "changes.newChanges": { en: "New changes · Refresh", zh: "有新的变更 · 刷新" },
  "changes.diffTruncated": { en: "Diff truncated; additional content omitted.", zh: "diff 已截断；其余内容已省略。" },
  "changes.untrackedNotice": { en: "Untracked file — stage it to see a diff.", zh: "未跟踪文件——暂存后可查看 diff。" },
  "changes.diffCollapsed": { en: "Diff collapsed — expand to review.", zh: "diff 已折叠——展开以审阅。" },
  "changes.staged": { en: "Staged", zh: "已暂存" },
  "changes.unstaged": { en: "Unstaged", zh: "未暂存" },
  "changes.noDiffContent": { en: "No diff content for this change.", zh: "此变更没有 diff 内容。" },
  "changes.collapseDiff": { en: "Collapse file diff", zh: "折叠文件 diff" },
  "changes.expandDiff": { en: "Expand file diff", zh: "展开文件 diff" },
  "changes.previousFile": { en: "Previous file", zh: "上一个文件" },
  "changes.nextFile": { en: "Next file", zh: "下一个文件" },
  "changes.diffMode": { en: "Diff view mode", zh: "diff 视图模式" },
  "changes.unified": { en: "Unified", zh: "统一视图" },
  "changes.split": { en: "Split", zh: "分栏视图" },
  "changes.hiddenLines": { en: "Show {count} hidden lines", zh: "显示 {count} 行隐藏内容" },
  "changes.hiddenLine": { en: "Show {count} hidden line", zh: "显示 {count} 行隐藏内容" },
  "changes.group.staged": { en: "Staged", zh: "已暂存" },
  "changes.group.unstaged": { en: "Unstaged", zh: "未暂存" },
  "changes.group.untracked": { en: "Untracked", zh: "未跟踪" },
  "changes.status.index": { en: "Index", zh: "暂存区" },
  "changes.status.worktree": { en: "Worktree", zh: "工作区" },
  "changes.status.untracked": { en: "Untracked", zh: "未跟踪" },

  "git.notARepo": { en: "This workspace is not a Git repository.", zh: "此工作区不是 Git 仓库。" },
  "git.notARepoHint": { en: "Git changes and history are unavailable here. Initialize a repository to see them.", zh: "此处的 Git 变更与历史不可用。初始化一个仓库以查看。" },
  "git.branch": { en: "Branch", zh: "分支" },
  "git.clean": { en: "Clean", zh: "干净" },
  "git.dirty": { en: "Dirty", zh: "有变更" },
  "git.ahead": { en: "{count} ahead", zh: "领先 {count}" },
  "git.behind": { en: "{count} behind", zh: "落后 {count}" },
  "git.staged": { en: "{count} staged", zh: "{count} 已暂存" },
  "git.unstaged": { en: "{count} unstaged", zh: "{count} 未暂存" },
  "git.untracked": { en: "{count} untracked", zh: "{count} 未跟踪" },
  "git.refresh": { en: "Refresh", zh: "刷新" },

  "history.title": { en: "History", zh: "历史" },
  "history.author": { en: "Author", zh: "作者" },
  "history.parents": { en: "Parents", zh: "父提交" },
  "history.filesChanged": { en: "Files changed", zh: "变更文件" },
  "history.additions": { en: "{count} additions", zh: "{count} 处新增" },
  "history.deletions": { en: "{count} deletions", zh: "{count} 处删除" },
  "history.loading": { en: "Loading commit history…", zh: "正在加载提交历史…" },
  "history.empty": { en: "No commits in this repository yet.", zh: "此仓库中还没有提交。" },
  "history.selectCommit": { en: "Select a commit to view its summary and diff.", zh: "选择一个提交以查看其摘要与 diff。" },
  "history.commitDetail": { en: "Commit detail", zh: "提交详情" },
  "history.decorations": { en: "Refs", zh: "引用" },

  "preview.status": { en: "status", zh: "状态" },
  "preview.jsonLabel": { en: "Workspace JSON", zh: "Workspace JSON" },
  "preview.csvTitle": { en: "Workspace CSV preview", zh: "Workspace CSV 预览" },
  "preview.csvTruncatedTitle": { en: "Workspace CSV preview (additional rows omitted)", zh: "Workspace CSV 预览（其余行已省略）" },
  "preview.truncatedNote": { en: "Preview truncated; additional content omitted.", zh: "预览已截断；其余内容已省略。" },
  "preview.downloadName": { en: "workspace file", zh: "工作区文件" },
  "preview.imageAlt": { en: "Workspace image", zh: "工作区图片" },
  "preview.resourceUnavailable": { en: "Preview resource is unavailable", zh: "预览资源不可用" },
  "preview.previewUnavailable": { en: "Preview unavailable: {reason}. Download is unavailable for this file.", zh: "预览不可用：{reason}。此文件不支持下载。" },
  "preview.downloadUnavailable": { en: "Download is unavailable for this file.", zh: "此文件不支持下载。" },
  "preview.downloadAction": { en: "Download {name}", zh: "下载{name}" },

  "view.artifacts": { en: "Artifacts", zh: "产物" },
  "view.memory": { en: "Memory", zh: "记忆" },
  "view.changes": { en: "Changes", zh: "变更" },
  "view.git": { en: "Git", zh: "Git" },
  "view.history": { en: "History", zh: "历史" },
  "view.workspace": { en: "Workspace", zh: "工作区" },
  "summary.workspaceName": { en: "Workspace", zh: "工作区" },
  "summary.files": { en: "{count} files", zh: "{count} 个文件" },
  "summary.artifacts": { en: "{count} artifacts", zh: "{count} 个产物" },
  "summary.memory": { en: "{count} memory · {count2} decisions", zh: "{count} 条记忆 · {count2} 条决策" },
  "summary.active": { en: "active {span}", zh: "活跃 {span}" },
  "summary.justNow": { en: "just now", zh: "刚刚" },
  "summary.unavailable": { en: "Workspace summary is unavailable.", zh: "Workspace 摘要当前不可用。" },

  "error.gitUnavailable": { en: "Git is not available for this workspace.", zh: "此工作区不可用 Git。" },
  "error.notGitRepository": { en: "This workspace is not a git repository.", zh: "此工作区不是 Git 仓库。" },
  "error.gitTimeout": { en: "Git did not respond in time; try again.", zh: "Git 未及时响应；请重试。" },
  "error.gitOutputTooLarge": { en: "The change is too large to show fully.", zh: "变更内容过大，无法完整显示。" },
  "error.pathOutsideWorkspace": { en: "This change sits outside the Workspace and is blocked.", zh: "此变更位于 Workspace 之外，已被拦截。" },
  "error.providerUnavailable": { en: "The Workspace provider is unavailable right now.", zh: "Workspace 提供方当前不可用。" },
  "error.projectUnavailable": { en: "This session is not bound to a Workspace.", zh: "此会话未绑定到 Workspace。" },
  "error.resourceStale": { en: "This item changed or expired; refresh to see the latest.", zh: "此项已变更或过期；刷新以查看最新内容。" },
  "error.resourceExpired": { en: "This item expired; refresh to reload it.", zh: "此项已过期；刷新以重新加载。" },
  "error.fileTooLarge": { en: "This item is too large to preview.", zh: "此项过大，无法预览。" },
  "error.symlinkEscape": { en: "This item points outside the Workspace and is blocked.", zh: "此项指向 Workspace 之外，已被拦截。" },

  "memory.scope.projectHint": { en: "Project memory: persisted per workspace root, shared by every session.", zh: "项目记忆：按工作区根目录持久化，所有会话共享。" },
  "memory.scope.sessionHint": { en: "Session memory: scoped to the current Harness session only.", zh: "会话记忆：仅限当前 Harness 会话。" },
  "memory.scope.userHint": { en: "User memory: personal, crosses projects for this account.", zh: "用户记忆：个人记忆，跨项目，归属于此账号。" },
  "memory.scope.sharedHint": { en: "Shared Project: read-mostly, requires acknowledgement to edit.", zh: "共享项目：以只读为主，编辑需先确认。" },
  "memory.type.factHint": { en: "A statement believed true about the workspace.", zh: "关于工作区的事实陈述。" },
  "memory.type.decisionHint": { en: "A recorded decision (ADR-style) with rationale.", zh: "已记录的决策（ADR 风格）及理由。" },
  "memory.type.preferenceHint": { en: "A personal or team preference, e.g. reply style.", zh: "个人或团队的偏好，如回复风格。" },
  "memory.type.conventionHint": { en: "A standing convention to follow in this workspace.", zh: "此工作区应遵循的约定。" },
  "memory.type.proposalHint": { en: "Model-suggested item awaiting review.", zh: "模型建议、待审阅的条目。" },
  "memory.originHint": { en: "Where this record came from (agent-derived vs human-entered).", zh: "此记录的来源（智能体推导或人工录入）。" },
  "memory.verifiedHint": { en: "Whether a human has confirmed this record; unverified items are review-only until confirmed.", zh: "是否已有人工确认此记录；未验证项仅可审阅，确认后方可用。" },
  "memory.retentionHint": { en: "How long the record is kept and where it persists.", zh: "记录的保留时长与存放位置。" },
  "memory.revisionHint": { en: "Version of this record; edits and governance actions bump the revision.", zh: "此记录的版本；编辑与治理操作会递增修订号。" },
  "memory.sourcesHint": { en: "Provenance links that produced this record.", zh: "生成此记录的溯源链接。" },
  "memory.expiresHint": { en: "When verified records lapse to stale; none means no expiry.", zh: "已验证记录的过期时间；无则永不过期。" },
  "memory.editHint": { en: "Open the inline editor to change this record.", zh: "打开内联编辑器修改此记录。" },
  "memory.verifyHint": { en: "Confirm this record as correct.", zh: "确认此记录正确。" },
  "memory.reverifyHint": { en: "Refresh this stale record after checking the facts.", zh: "核验事实后刷新此过期记录。" },
  "memory.archiveHint": { en: "Remove from active memory (recoverable).", zh: "移出活跃记忆（可恢复）。" },
  "memory.forgetHint": { en: "Tombstone this record permanently.", zh: "永久删除此记录。" },
  "memory.pinHint": { en: "Keep this record pinned above the list.", zh: "将记录置顶显示。" },
  "memory.unpinHint": { en: "Release the pin on this record.", zh: "取消此记录的置顶。" },
  "memory.copyHint": { en: "Copy the full content to the clipboard.", zh: "复制完整内容到剪贴板。" },
  "memory.viewSourceHint": { en: "Show provenance and source references.", zh: "显示来源与溯源信息。" },
  "memory.exportHint": { en: "Download the current scope as JSON.", zh: "将当前范围导出为 JSON 下载。" },
  "memory.importHint": { en: "Import a JSON memory file into the current scope.", zh: "将 JSON 记忆文件导入当前范围。" },
  "memory.status.active": { en: "Active", zh: "活跃" },
  "memory.status.archived": { en: "Archived", zh: "已归档" },
  "memory.status.forgotten": { en: "Forgotten", zh: "已遗忘" },
  "memory.unverified": { en: "unverified", zh: "未验证" },
  "memory.stale": { en: "stale", zh: "已过期" },
  "memory.relative.justNow": { en: "just now", zh: "刚刚" },
  "memory.relative.minutes": { en: "{count}m ago", zh: "{count} 分钟前" },
  "memory.relative.hours": { en: "{count}h ago", zh: "{count} 小时前" },
  "memory.relative.days": { en: "{count}d ago", zh: "{count} 天前" },
  "memory.copy": { en: "Copy", zh: "复制" },
  "memory.copyCopied": { en: "Content copied to the clipboard.", zh: "内容已复制到剪贴板。" },
  "memory.copyFailed": { en: "Copy failed; select the content manually.", zh: "复制失败；请手动选择内容。" },
  "memory.copyUnavailable": { en: "Copy is unavailable in this browser.", zh: "当前浏览器不支持复制。" },
  "memory.viewSource": { en: "View source", zh: "查看来源" },
  "memory.sourceInfo": { en: "Source information", zh: "来源信息" },
  "memory.provenance.kind": { en: "Kind", zh: "类型" },
  "memory.provenance.session": { en: "Session", zh: "会话" },
  "memory.provenance.eventSeq": { en: "Event seq", zh: "事件序号" },
  "memory.provenance.note": { en: "Note", zh: "备注" },
  "memory.contentHash": { en: "Content hash", zh: "内容哈希" },
  "memory.saveDisabled": { en: "This Memory file is read-only; editing is disabled.", zh: "此记忆文件为只读；编辑已被禁用。" },
  "memory.searchPlaceholder": { en: "Search memory…", zh: "搜索记忆…" },
  "memory.updatedAt": { en: "updated {when}", zh: "更新于 {when}" },
  "memory.selectHint": { en: "Select a record to inspect its content and governance.", zh: "选择一条记录以查看其内容与治理信息。" },
  "memory.version": { en: "Version", zh: "版本" },
  "memory.rev": { en: "rev", zh: "修订" },

  "git.onBranchPrefix": { en: "On", zh: "在" },
  "git.onBranchSuffix": { en: "", zh: "上" },
  "git.sigNew": { en: "new", zh: "新增" },
  "git.modeUnified": { en: "unified", zh: "统一" },
  "history.time": { en: "Time", zh: "时间" },
};

let activeLocale: WorkspaceLocale = "en";

const localeListeners = new Set<() => void>();

/** Register a listener invoked whenever the active locale changes. Returns a disposer. */
export function subscribeWorkspaceLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => { localeListeners.delete(listener); };
}

// Stable reference for React's useSyncExternalStore (subscribe must be referentially stable).
const stableLocaleSubscribe = (listener: () => void): (() => void) => subscribeWorkspaceLocale(listener);

/**
 * React 18 external-store hook: re-renders the calling component whenever the
 * active locale changes, so a language switch in the host app propagates to
 * every Workspace surface without a manual refresh.
 */
export function useWorkspaceLocale(): WorkspaceLocale {
  return useSyncExternalStore(stableLocaleSubscribe, workspaceLocale, workspaceLocale);
}

function detectLocale(): WorkspaceLocale {
  // The host app sets <html lang="zh-CN"> / "en"; prefer it over the raw
  // browser language so the Workspace UI follows the app, not the OS.
  if (typeof document !== "undefined" && typeof document.documentElement?.getAttribute === "function") {
    const lang = document.documentElement.getAttribute("lang");
    if (lang && /^zh/i.test(lang)) return "zh";
  }
  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    return /^zh/i.test(navigator.language) ? "zh" : "en";
  }
  return "en";
}

/** The active locale (defaults to the browser/app language; override in tests/plugins). */
export function workspaceLocale(): WorkspaceLocale {
  return activeLocale;
}

export function setWorkspaceLocale(locale: WorkspaceLocale): void {
  const next = locale === "zh" ? "zh" : "en";
  if (next === activeLocale) return;
  activeLocale = next;
  // Notify subscribers (React components using useWorkspaceLocale) so they re-render.
  for (const listener of [...localeListeners]) {
    try {
      listener();
    } catch {
      // A faulty listener must never break locale propagation.
    }
  }
}

/** Look up one message with `{placeholder}` interpolation. */
export function t(key: WorkspaceMessageKey, vars?: Record<string, string | number>): string {
  const entry = table[key];
  if (!entry) return key;
  let message = activeLocale === "zh" ? entry.zh : entry.en;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}

/** Plural-aware file-count label (English plural; Chinese is invariant). */
export function tCount(key: WorkspaceMessageKey, count: number, vars?: Record<string, string | number>): string {
  return t(key, { ...vars, count });
}

// Auto-detect once at module load when running in a browser-like scope.
try {
  activeLocale = detectLocale();
} catch {
  activeLocale = "en";
}

/**
 * Begin following the host application locale at runtime.
 *
 * The DeepSeek Harness host does not (yet) expose a public locale event or
 * hook for plugins (wayfinder #118), so we follow the app language the same
 * way the host itself does: by observing the `<html lang>` attribute (which
 * the host sets on every language switch) and the browser `languagechange`
 * event. This is host-independent, zero-dependency, and reacts to in-app
 * language changes without a manual refresh.
 *
 * Returns a disposer that stops observing. Call once from the client
 * contribution lifecycle.
 */
export function startWorkspaceLocaleSync(): () => void {
  const sync = (): void => {
    if (typeof document === "undefined" || typeof document.documentElement?.getAttribute !== "function") return;
    const lang = document.documentElement.getAttribute("lang");
    if (lang) setWorkspaceLocale(/^zh/i.test(lang) ? "zh" : "en");
  };
  // Apply the current attribute immediately (covers the case where the host
  // already set lang before the contribution mounted).
  sync();
  let observer: MutationObserver | undefined;
  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  const onLanguageChange = (): void => sync();
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("languagechange", onLanguageChange);
  }
  return () => {
    observer?.disconnect();
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("languagechange", onLanguageChange);
    }
  };
}
