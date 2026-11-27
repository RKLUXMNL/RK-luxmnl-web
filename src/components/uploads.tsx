"use client";
import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { api } from "@/lib/client";
import { Photo } from "./ui";
import { inspectVideo, putUpload } from "@/lib/upload-client";
type UploadResult = {
  assetId: string;
  token?: string;
  url: string;
  provider: string;
};
export function UploadControl({
  purpose,
  provider = "object",
  label,
  accept,
  onComplete,
}: {
  purpose: "product" | "custom" | "certificate" | "reel" | "live" | "branding";
  provider?: "object" | "stream";
  label?: string;
  accept?: string;
  onComplete: (id: string, token?: string) => void;
}) {
  const [progress, setProgress] = useState(0),
    [state, setState] = useState(""),
    [error, setError] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [authorized, setAuthorized] = useState(false),
    [preview, setPreview] = useState("");
  const upload = useRef<tus.Upload | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const authorization = useRef<UploadResult | null>(null);
  const stopped = useRef(false);
  const storageKey = useRef("");
  const previewUrl = useRef("");
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      stopped.current = true;
      void upload.current?.abort();
      xhr.current?.abort();
      if (poll.current) clearTimeout(poll.current);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  async function monitor(id: string) {
    if (stopped.current) return;
    try {
      const result = await api<{ state: string; error?: string }>(
        "/api/uploads",
        { action: "status", id },
      );
      setState(result.state);
      if (result.state === "ready") {
        if (storageKey.current) sessionStorage.removeItem(storageKey.current);
        onComplete(id);
        return;
      }
      if (result.state === "failed")
        throw Error(
          result.error || "Processing failed. Select a replacement file.",
        );
      poll.current = setTimeout(() => {
        void monitor(id);
      }, 8000);
    } catch (e) {
      setError((e as Error).message);
      setState("failed");
    }
  }
  async function start() {
    if (!file) return;
    setError("");
    stopped.current = false;
    setState("authorizing");
    try {
      let auth = authorization.current;
      if (!auth) {
        const duration = await inspectVideo(file, provider);
        if (stopped.current) return;
        auth = await api<UploadResult>("/api/uploads", {
          action: "authorize",
          purpose,
          provider,
          filename: file.name,
          mime: file.type,
          bytes: file.size,
          duration,
          authorized,
        });
        authorization.current = auth;
        if (provider === "stream" && storageKey.current) {
          try {
            sessionStorage.setItem(
              storageKey.current,
              JSON.stringify({ ...auth, expires: Date.now() + 47 * 3600000 }),
            );
          } catch {
            /* Upload still works without browser resume metadata. */
          }
        }
      }
      setState("uploading");
      if (provider === "stream") {
        const current = auth;
        const task = new tus.Upload(file, {
          uploadUrl: auth.url,
          chunkSize: 52428800,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          onProgress: (sent, total) =>
            setProgress(Math.round((sent / total) * 100)),
          onError: (e) => {
            setError(e.message);
            setState("paused");
          },
          onSuccess: () => {
            setState("processing");
            void monitor(current.assetId);
          },
        });
        upload.current = task;
        task.start();
      } else {
        const current = auth;
        await putUpload(file, current.url, {
          onProgress: setProgress,
          onRequest: (request) => {
            xhr.current = request;
          },
        });
        await api("/api/uploads", {
          action: "finish",
          id: current.assetId,
          token: current.token,
        });
        setState("ready");
        onComplete(current.assetId, current.token);
      }
    } catch (e) {
      setError((e as Error).message);
      setState("failed");
    }
  }
  const active = ["authorizing", "uploading", "processing"].includes(state);
  return (
    <div className="upload-box">
      <label>
        {label ||
          (provider === "stream"
            ? "Upload recording (resumable)"
            : "Upload file")}
        <input
          type="file"
          disabled={active}
          accept={
            accept ||
            (provider === "stream" || purpose === "reel"
              ? "video/mp4,video/webm"
              : purpose === "custom" || purpose === "branding"
                ? "image/jpeg,image/png,image/webp"
                : purpose === "certificate"
                  ? "image/jpeg,image/png,image/webp,application/pdf"
                  : "image/jpeg,image/png,image/webp,video/mp4,video/webm")
          }
          onChange={(e) => {
            const selected = e.target.files?.[0] || null;
            setFile(selected);
            authorization.current = null;
            if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
            previewUrl.current =
              selected &&
              (selected.type.startsWith("image/") ||
                selected.type.startsWith("video/"))
                ? URL.createObjectURL(selected)
                : "";
            setPreview(previewUrl.current);
            storageKey.current = selected
              ? `rk-upload:${purpose}:${selected.name}:${selected.size}:${selected.lastModified}`
              : "";
            if (provider === "stream" && storageKey.current) {
              try {
                const saved = JSON.parse(
                  sessionStorage.getItem(storageKey.current) || "null",
                );
                if (saved?.expires > Date.now()) authorization.current = saved;
              } catch {
                /* A new authorization will be requested. */
              }
            }
            setState("");
            setProgress(0);
            setError("");
          }}
        />
      </label>
      {preview && !file?.type.startsWith("video/") && (
        <Photo
          src={preview}
          alt="Selected upload preview"
          className="upload-preview"
        />
      )}
      {preview && file?.type.startsWith("video/") && (
        <video
          src={preview}
          controls
          playsInline
          preload="metadata"
          aria-label="Selected video preview"
        />
      )}
      {purpose === "reel" && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
          />{" "}
          I own or have permission to provide this original file for
          downloading.
        </label>
      )}
      <div className="button-row">
        <button
          type="button"
          className="btn outline"
          disabled={!file || active || state === "ready"}
          onClick={() => void start()}
        >
          {state === "paused" || state === "failed"
            ? "Retry / resume upload"
            : "Upload selected file"}
        </button>
        {!active && authorization.current && state !== "ready" && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              authorization.current = null;
              if (storageKey.current)
                sessionStorage.removeItem(storageKey.current);
              setState("");
              setError("");
            }}
          >
            Start a new upload authorization
          </button>
        )}
        {state === "uploading" && provider === "stream" && (
          <button
            type="button"
            className="btn outline"
            onClick={() => {
              void upload.current?.abort();
              setState("paused");
            }}
          >
            Pause
          </button>
        )}
        {state === "failed" &&
          authorization.current &&
          provider === "stream" && (
            <button
              type="button"
              className="text-link"
              onClick={() => void monitor(authorization.current!.assetId)}
            >
              Check processing again
            </button>
          )}
      </div>
      {state && (
        <p role="status">
          {state === "uploading"
            ? `Uploading ${progress}%`
            : state === "ready"
              ? "File ready"
              : state}
          {state === "uploading" && <progress max="100" value={progress} />}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {provider === "stream" && (
        <p className="small">
          Uploads go directly to the video provider. Pause and resume here, or
          reselect the same file in this browser tab after a reload to recover
          an unexpired upload. Processing must finish before publication.
        </p>
      )}
    </div>
  );
}
