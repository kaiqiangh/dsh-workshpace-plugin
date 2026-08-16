import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import type { PreviewDescriptor, PreviewErrorCode } from "../domain/preview.ts";
import type { WorkspacePath } from "../domain/path.ts";
import {
  buildWorkspaceResourceUrl,
  createWorkspaceArtifactDetail,
  createWorkspaceDownloadController,
  normalizeWorkspaceArtifacts,
  type WorkspaceDownloadRuntime,
} from "./workspace-deliverables.ts";
import { createWorkspacePreviewRenderer, type WorkspacePrimitiveSet } from "./workspace-preview-adapters.ts";
import type { WorkspaceArtifactPreview, WorkspaceJsonValue } from "../host/workspace-artifacts.ts";

export const WORKSPACE_ARTIFACT_OVERLAY_SLOT = "shell.overlay" as const;
export const WORKSPACE_ARTIFACT_SLOT_NAME = "shell.overlay" as const;
export const WORKSPACE_ARTIFACT_ENTRY_KEY = "dsh-workspace-artifacts" as const;

export interface WorkspaceArtifactRemote {
  readonly artifactMetadata: () => Promise<RemoteResult<readonly WorkspaceDeliverable[]>>;
  readonly previewArtifact: (id: string) => Promise<RemoteResult<WorkspaceArtifactPreview>>;
}

export interface WorkspaceArtifactSurfaceOptions {
  readonly runtime?: WorkspaceDownloadRuntime;
  readonly resourcePath?: string;
}

function remoteValue<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value;
  throw new Error("Workspace artifact capability is unavailable");
}

function descriptorFor(artifact: WorkspaceDeliverable, preview: WorkspaceArtifactPreview): PreviewDescriptor {
  const path = artifact.name as WorkspacePath;
  switch (preview.type) {
    case "text": return { type: "text", path, renderer: preview.renderer, ...(preview.language === undefined ? {} : { language: preview.language }), content: preview.content, truncated: preview.truncated };
    case "markdown": return { type: "markdown", path, renderer: preview.renderer, content: preview.content, truncated: preview.truncated, policy: preview.policy };
    case "json": return { type: "json", path, renderer: preview.renderer, value: preview.value as WorkspaceJsonValue };
    case "csv": return { type: "csv", path, renderer: preview.renderer, columns: preview.columns, rows: preview.rows, truncated: preview.truncated };
    case "binary": return { type: "binary", path, mediaType: preview.mediaType, resourceId: preview.resourceId, version: preview.version, expiresAt: preview.expiresAt };
    case "unsupported": return { type: "unsupported", path, reason: preview.reason, ...(preview.mediaType === undefined ? {} : { mediaType: preview.mediaType }), ...(preview.size === undefined ? {} : { size: preview.size }) };
    case "error": return { type: "error", code: preview.code as PreviewErrorCode, message: preview.message };
  }
}

function defaultRuntime(): WorkspaceDownloadRuntime | undefined {
  if (typeof globalThis.fetch !== "function" || typeof globalThis.URL?.createObjectURL !== "function") return undefined;
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    createObjectURL: (blob) => globalThis.URL.createObjectURL(blob),
    revokeObjectURL: (url) => globalThis.URL.revokeObjectURL(url),
  };
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  return `${Math.round(sizeBytes / (102.4 * 1024)) / 10} MB`;
}

/** Convert a path-free Host preview into the existing bounded renderer contract. */
export function workspaceArtifactPreviewDescriptor(artifact: WorkspaceDeliverable, preview: WorkspaceArtifactPreview): PreviewDescriptor {
  return descriptorFor(artifact, preview);
}

/** Build one additive, keyboard-operable artifact list/detail surface. */
export function createWorkspaceArtifactSurfaceComponent(
  remote: WorkspaceArtifactRemote | undefined,
  primitives: WorkspacePrimitiveSet,
  options: WorkspaceArtifactSurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceArtifactSurface(): ReactNode {
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [artifacts, setArtifacts] = useState<readonly WorkspaceDeliverable[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [detail, setDetail] = useState<PreviewDescriptor | undefined>();
    const [detailStatus, setDetailStatus] = useState("idle");
    const [message, setMessage] = useState<string | undefined>();
    const [download, setDownload] = useState<{ readonly url?: string; readonly name?: string; readonly status?: string }>({});
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const downloadController = useRef<ReturnType<typeof createWorkspaceDownloadController> | undefined>();
    const request = useRef(0);
    const runtime = options.runtime ?? defaultRuntime();

    useEffect(() => {
      let active = true;
      if (!remote) {
        setStatus("degraded");
        setMessage("Workspace artifacts are unavailable in this Web scope.");
        return () => { active = false; };
      }
      remote.artifactMetadata().then((result) => {
        if (!active) return;
        const items = normalizeWorkspaceArtifacts(remoteValue(result));
        setArtifacts(items);
        setSelectedId(items[0]?.id);
        setStatus("ready");
      }).catch(() => {
        if (!active) return;
        setStatus("degraded");
        setMessage("Workspace artifacts are unavailable in this Web scope.");
      });
      return () => { active = false; };
    }, [remote]);

    useEffect(() => {
      if (selectedId) selectedButton.current?.focus();
    }, [selectedId]);

    useEffect(() => () => {
      downloadController.current?.cancel();
      if (download.url) downloadController.current?.release(download.url);
    }, [download.url]);

    const selected = artifacts.find((artifact) => artifact.id === selectedId);
    const select = (artifact: WorkspaceDeliverable): void => {
      setSelectedId(artifact.id);
      setDetail(undefined);
      setDetailStatus("loading");
      const token = ++request.current;
      remote?.previewArtifact(artifact.id).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) {
          setDetailStatus("error");
          setMessage("Workspace artifact preview is unavailable.");
          return;
        }
        const descriptor = descriptorFor(artifact, result.value);
        const detailValue = createWorkspaceArtifactDetail(artifact, descriptor);
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
      if (status === "ready" && selected && detail === undefined && detailStatus === "idle") select(selected);
    }, [status, selectedId, artifacts, detail, detailStatus]);

    const downloadArtifact = async (): Promise<void> => {
      if (!selected || !runtime) {
        setDownload({ status: "unsupported" });
        return;
      }
      downloadController.current ??= createWorkspaceDownloadController(runtime, options.resourcePath);
      setDownload({ status: "loading" });
      const result = await downloadController.current.start(selected);
      setDownload({ status: result.status, url: result.url, name: result.downloadName });
    };

    const body = status === "loading"
      ? createElement("p", { role: "status" }, "Loading Workspace artifacts…")
      : status === "degraded"
        ? createElement("p", { role: "status" }, message ?? "Workspace artifacts are unavailable.")
        : createElement(
          "div",
          { "data-dsh-workspace": "artifact-surface" },
          createElement("ul", { "aria-label": "Workspace artifacts" }, artifacts.map((artifact) => createElement(
            "li",
            { key: artifact.id },
            createElement(
              "button",
              {
                ref: artifact.id === selectedId ? selectedButton : undefined,
                type: "button",
                "aria-pressed": artifact.id === selectedId,
                onClick: () => select(artifact),
              },
              artifact.name,
            ),
            createElement("span", { "aria-label": `${artifact.mediaType}, ${formatSize(artifact.sizeBytes)}, ${artifact.preview}` }, ` ${artifact.mediaType} · ${formatSize(artifact.sizeBytes)} · ${artifact.preview}`),
          ))),
          selected && detail && createElement(
            "article",
            { "aria-label": `${selected.name} preview`, "data-dsh-workspace": "artifact-detail" },
            createElement("h3", null, selected.name),
            createWorkspacePreviewRenderer(primitives, detail, { resourcePath: options.resourcePath, downloadName: selected.downloadName, altText: selected.altText }) as ReactNode,
            selected.resourceId && createElement("button", { type: "button", onClick: downloadArtifact }, download.status === "loading" ? "Downloading…" : "Download"),
            download.status === "loading" && createElement("button", { type: "button", onClick: () => downloadController.current?.cancel() }, "Cancel download"),
            download.url && createElement("a", { href: download.url, download: download.name ?? selected.downloadName }, "Save download"),
            message && createElement("p", { role: "status" }, message),
          ),
          selected && !detail && detailStatus === "loading" && createElement("p", { role: "status" }, "Loading artifact preview…"),
          selected && !detail && detailStatus !== "loading" && artifacts.length === 0 && createElement("p", { role: "status" }, "No session artifacts yet."),
        );
    return createElement("section", { "data-dsh-workspace": "artifacts", role: "region", "aria-label": "Workspace artifacts" }, createElement("h2", null, "Workspace artifacts"), body);
  };
}

export function workspaceArtifactResourceUrl(artifact: WorkspaceDeliverable): string | undefined {
  return buildWorkspaceResourceUrl(artifact);
}
