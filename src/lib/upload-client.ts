export type UploadAuthorization = {
  assetId: string;
  url: string;
  token?: string;
  provider: string;
};

export async function inspectVideo(
  file: File,
  provider: "object" | "stream",
  signal?: AbortSignal,
): Promise<number | undefined> {
  if (!file.type.startsWith("video/")) return undefined;
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const video = document.createElement("video"),
      url = URL.createObjectURL(file);
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : undefined;
      cleanup();
      if (error) reject(error);
      else resolve(duration);
    };
    const abort = () =>
      finish(new DOMException("Upload cancelled.", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          provider === "stream"
            ? undefined
            : Error(
                "Could not inspect this video. Choose a supported playable file.",
              ),
        ),
      10000,
    );
    video.preload = "metadata";
    video.onloadedmetadata = () => finish();
    video.onerror = () =>
      finish(
        provider === "stream"
          ? undefined
          : Error("Choose a supported, playable video."),
      );
    signal?.addEventListener("abort", abort, { once: true });
    video.src = url;
  });
}

export function putUpload(
  file: File,
  url: string,
  {
    onProgress,
    signal,
    onRequest,
  }: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
    onRequest?: (request: XMLHttpRequest) => void;
  } = {},
): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    onRequest?.(request);
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) resolve();
      else
        reject(
          Error("Upload failed. Check storage connection/CORS and retry."),
        );
    };
    request.onerror = () => {
      cleanup();
      reject(Error("Connection interrupted. Please retry."));
    };
    request.onabort = () => {
      cleanup();
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    request.send(file);
  });
}
