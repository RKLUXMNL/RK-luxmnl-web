"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Check, RotateCcw, X, Video } from "lucide-react";
import { api } from "@/lib/client";
import {
  inspectVideo,
  putUpload,
  UploadAuthorization,
} from "@/lib/upload-client";
import { Photo } from "./ui";
type State =
  "pending" | "uploading" | "processing" | "ready" | "failed" | "cancelled";
type Job = {
  id: string;
  batch: number;
  file: File;
  preview: string;
  state: State;
  progress: number;
  error: string;
  assetId?: string;
};
export function ProductMediaUpload({
  selectedIds,
  onComplete,
  onRemove,
  onBusyChange,
  onPendingChange,
}: {
  selectedIds: string[];
  onComplete: (id: string, orderedIds?: string[]) => void | Promise<void>;
  onRemove: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const active = useRef(false),
    batchNumber = useRef(0),
    order = useRef<{ id: string; batch: number }[]>([]),
    ready = useRef(new Map<string, string>()),
    stopped = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    urls = useRef(new Set<string>()),
    authorizations = useRef(
      new Map<string, UploadAuthorization & { expires: number }>(),
    );
  useEffect(() => {
    mounted.current = true;
    const previews = urls.current;
    return () => {
      mounted.current = false;
      stopped.current = true;
      controller.current?.abort();
      previews.forEach((url) => URL.revokeObjectURL(url));
      previews.clear();
    };
  }, []);
  const update = (id: string, patch: Partial<Job>) => {
    if (mounted.current)
      setJobs((current) =>
        current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      );
  };
  const pending = jobs.filter((job) => job.state !== "ready").length;
  useEffect(() => {
    onPendingChange(pending > 0);
  }, [pending, onPendingChange]);
  const remaining = Math.max(0, 30 - selectedIds.length - pending);
  function select(files: FileList | null) {
    if (!files) return;
    setError("");
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
    const chosen = Array.from(files);
    if (chosen.some((file) => !allowed.includes(file.type) || !file.size)) {
      setError("Choose non-empty JPEG, PNG, WebP, MP4 or WebM files.");
      return;
    }
    if (chosen.length > remaining) {
      setError(
        `You can add ${remaining} more file${remaining === 1 ? "" : "s"} (30 media items per product).`,
      );
      return;
    }
    const batch = pending ? batchNumber.current : ++batchNumber.current;
    const next = chosen.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return {
        id: crypto.randomUUID(),
        batch,
        file,
        preview,
        state: "pending" as State,
        progress: 0,
        error: "",
      };
    });
    order.current.push(
      ...next.map((job) => ({ id: job.id, batch: job.batch })),
    );
    setJobs((current) => [...current, ...next]);
  }
  async function uploadOne(job: Job) {
    const abort = new AbortController();
    controller.current = abort;
    update(job.id, { state: "uploading", progress: 0, error: "" });
    try {
      const duration = await inspectVideo(job.file, "object", abort.signal);
      let auth = authorizations.current.get(job.id);
      if (!auth || auth.expires < Date.now()) {
        const result = await api<UploadAuthorization>("/api/uploads", {
          action: "authorize",
          purpose: "product",
          provider: "object",
          filename: job.file.name,
          mime: job.file.type,
          bytes: job.file.size,
          duration,
        });
        auth = { ...result, expires: Date.now() + 14 * 60000 };
        authorizations.current.set(job.id, auth);
      }
      abort.signal.throwIfAborted();
      await putUpload(job.file, auth.url, {
        signal: abort.signal,
        onProgress: (progress) => update(job.id, { progress }),
      });
      abort.signal.throwIfAborted();
      update(job.id, { state: "processing", progress: 100 });
      await api("/api/uploads", {
        action: "finish",
        id: auth.assetId,
        token: auth.token,
      });
      abort.signal.throwIfAborted();
      update(job.id, { state: "ready", assetId: auth.assetId, progress: 100 });
      authorizations.current.delete(job.id);
      ready.current.set(job.id, auth.assetId);
      const ids = order.current
        .filter((item) => item.batch === job.batch)
        .map((item) => ready.current.get(item.id))
        .filter((id): id is string => Boolean(id));
      if (mounted.current) await onComplete(auth.assetId, ids);
    } catch (cause) {
      const cancelled = abort.signal.aborted;
      update(job.id, {
        state: cancelled ? "cancelled" : "failed",
        error: cancelled ? "" : (cause as Error).message,
      });
    }
  }
  async function start(list: Job[]) {
    if (active.current || !list.length) return;
    active.current = true;
    stopped.current = false;
    setRunning(true);
    onBusyChange(true);
    try {
      for (const job of list) {
        if (stopped.current || !mounted.current) break;
        await uploadOne(job);
      }
    } finally {
      active.current = false;
      controller.current = null;
      if (mounted.current) {
        setRunning(false);
        onBusyChange(false);
      }
    }
  }
  function remove(job: Job) {
    if (job.assetId && selectedIds.includes(job.assetId)) onRemove(job.assetId);
    URL.revokeObjectURL(job.preview);
    urls.current.delete(job.preview);
    authorizations.current.delete(job.id);
    ready.current.delete(job.id);
    order.current = order.current.filter((item) => item.id !== job.id);
    setJobs((current) => current.filter((item) => item.id !== job.id));
  }
  return (
    <section
      className="upload-box product-batch-upload"
      aria-label="Multiple product photos and videos"
    >
      <label>
        Add photos and videos
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          disabled={running || remaining === 0}
          onChange={(e) => {
            select(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="small">
        Select multiple files together, or add another selection. Files upload
        one at a time in selection order. Reorder the gallery below before
        saving. {remaining} more media item{remaining === 1 ? "" : "s"} can be
        selected.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="btn outline"
          disabled={running || !pending}
          onClick={() =>
            void start(jobs.filter((job) => job.state !== "ready"))
          }
        >
          <Upload size={16} />
          {running
            ? "Uploading files…"
            : `Upload ${pending || "selected"} file${pending === 1 ? "" : "s"}`}
        </button>
        {running && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              stopped.current = true;
              controller.current?.abort();
            }}
          >
            Cancel remaining uploads
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="upload-queue">
        {jobs.map((job, index) => (
          <article
            key={job.id}
            className="upload-queue-item"
            data-upload-state={job.state}
          >
            {job.file.type.startsWith("video/") ? (
              <video
                src={job.preview}
                controls
                muted
                playsInline
                preload="metadata"
                aria-label={`${job.file.name} preview`}
              />
            ) : (
              <Photo src={job.preview} alt={`${job.file.name} preview`} />
            )}
            <div>
              <strong>
                {index + 1}. {job.file.name}
              </strong>
              <p className="small">
                {job.file.type.startsWith("video/") ? (
                  <Video size={12} />
                ) : null}{" "}
                {(job.file.size / 1048576).toFixed(1)} MB
              </p>
              <p role="status">
                {job.state === "ready" ? (
                  <>
                    <Check size={14} />{" "}
                    {job.assetId && selectedIds.includes(job.assetId)
                      ? "Ready — added to product"
                      : "Uploaded — not selected"}
                  </>
                ) : job.state === "uploading" ? (
                  `Uploading ${job.progress}%`
                ) : job.state === "processing" ? (
                  "Verifying file…"
                ) : job.state === "failed" ? (
                  "Upload failed"
                ) : job.state === "cancelled" ? (
                  "Cancelled — ready to retry"
                ) : (
                  "Waiting to upload"
                )}
              </p>
              {job.state === "uploading" && (
                <progress max="100" value={job.progress} />
              )}{" "}
              {job.error && (
                <p role="alert" className="form-error">
                  {job.error}
                </p>
              )}
              <div className="button-row">
                {["failed", "cancelled"].includes(job.state) && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={running}
                    onClick={() => void start([job])}
                  >
                    <RotateCcw size={13} /> Retry file
                  </button>
                )}
                {job.state === "ready" &&
                  job.assetId &&
                  !selectedIds.includes(job.assetId) && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={running || selectedIds.length >= 30}
                      onClick={() => void onComplete(job.assetId!)}
                    >
                      Add to product
                    </button>
                  )}
                <button
                  type="button"
                  className="text-link"
                  disabled={running}
                  aria-label={`Remove selected file ${index + 1}`}
                  onClick={() => remove(job)}
                >
                  <X size={13} /> Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {jobs.some((job) => job.state === "ready") && (
        <p className="small">
          Ready files are stored securely. Save the product to apply its
          selected media and order.
        </p>
      )}
    </section>
  );
}
