"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { ProductMedia } from "@/lib/data";
type StreamController = {
  muted: boolean;
  controls: boolean;
  loop: boolean;
  ended: boolean;
  primaryColor: string;
  letterboxColor: string;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
};
type StreamFactory = (element: HTMLIFrameElement) => StreamController;
let sdk: Promise<StreamFactory> | null = null;
function streamSdk() {
  const existing = (window as unknown as { Stream?: StreamFactory }).Stream;
  if (existing) return Promise.resolve(existing);
  if (!sdk)
    sdk = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      script.async = true;
      script.onload = () => {
        const factory = (window as unknown as { Stream?: StreamFactory })
          .Stream;
        if (factory) resolve(factory);
        else {
          sdk = null;
          script.remove();
          reject(Error("Player controls are unavailable."));
        }
      };
      script.onerror = () => {
        sdk = null;
        script.remove();
        reject(Error("Player controls could not load."));
      };
      document.head.appendChild(script);
    });
  return sdk;
}
export function GalleryVideo({
  media,
  autoPlay,
  onEnded,
  onPlay,
  onPause,
  onUnavailable,
}: {
  media: ProductMedia;
  autoPlay: boolean;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onUnavailable?: () => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false),
    [blocked, setBlocked] = useState(false),
    [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    frame = useRef<HTMLIFrameElement>(null),
    stream = useRef<StreamController | null>(null),
    alive = useRef(true),
    played = useRef(false);
  const latest = useRef({ autoPlay, onEnded, onPlay, onPause, onUnavailable });
  useEffect(() => {
    latest.current = { autoPlay, onEnded, onPlay, onPause, onUnavailable };
  });
  const fail = useCallback(() => {
    if (!alive.current) return;
    setError(true);
    latest.current.onUnavailable?.();
  }, []);
  useEffect(() => {
    alive.current = true;
    const native = video.current;
    if (native && !native.getAttribute("src")) native.src = media.url;
    return () => {
      alive.current = false;
      native?.pause();
      native?.removeAttribute("src");
      native?.load();
    };
  }, [media.url]);
  useEffect(() => {
    if (media.provider !== "stream") return;
    let disposed = false;
    api<{ player: string }>(`/api/media/${media.id}`)
      .then((result) => {
        if (!disposed) setUrl(result.player);
      })
      .catch(() => {
        if (!disposed) fail();
      });
    return () => {
      disposed = true;
    };
  }, [media.id, media.provider, fail]);
  useEffect(() => {
    if (!url || !frame.current) return;
    let disposed = false;
    const element = frame.current;
    let controller: StreamController | null = null;
    const listeners: Record<string, () => void> = {
      ended: () => {
        if (!disposed) latest.current.onEnded?.();
      },
      play: () => {
        if (!disposed) {
          played.current = true;
          setBlocked(false);
          latest.current.onPlay?.();
        }
      },
      pause: () => {
        if (
          !disposed &&
          played.current &&
          latest.current.autoPlay &&
          !controller?.ended
        )
          latest.current.onPause?.();
      },
      error: () => {
        if (!disposed) fail();
      },
    };
    streamSdk()
      .then((factory) => {
        if (disposed) return;
        controller = factory(element);
        stream.current = controller;
        controller.muted = true;
        controller.controls = true;
        controller.loop = false;
        controller.primaryColor = "#c9973b";
        controller.letterboxColor = "#f8ebdd";
        Object.entries(listeners).forEach(([event, listener]) =>
          controller!.addEventListener(event, listener),
        );
        setReady(true);
      })
      .catch(() => {
        if (!disposed) fail();
      });
    return () => {
      disposed = true;
      if (controller) {
        Object.entries(listeners).forEach(([event, listener]) =>
          controller!.removeEventListener?.(event, listener),
        );
        controller.pause();
      }
      stream.current = null;
    };
  }, [url, fail]);
  useEffect(() => {
    let cancelled = false;
    const controller =
      media.provider === "stream" ? stream.current : video.current;
    if (!controller || error) return;
    if (!autoPlay) {
      controller.pause();
      return;
    }
    async function play() {
      try {
        await controller!.play();
        if (!cancelled && alive.current) setBlocked(false);
      } catch {
        if (cancelled || !alive.current) return;
        controller!.muted = true;
        try {
          await controller!.play();
          if (!cancelled && alive.current) setBlocked(false);
        } catch {
          if (!cancelled && alive.current) setBlocked(true);
        }
      }
    }
    void play();
    return () => {
      cancelled = true;
    };
  }, [autoPlay, ready, error, media.provider]);
  if (error)
    return (
      <div className="gallery-video-message" role="status">
        This video is temporarily unavailable. You can continue to the next
        photo or video.
      </div>
    );
  return (
    <div className="gallery-video">
      {media.provider === "stream" ? (
        url ? (
          <iframe
            ref={frame}
            src={`${url}?muted=true&controls=true`}
            title="Product video"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
        ) : (
          <p role="status">Loading product video…</p>
        )
      ) : (
        <video
          ref={video}
          src={media.url}
          aria-label="Product video"
          autoPlay={autoPlay}
          muted
          playsInline
          controls
          preload="metadata"
          controlsList="nodownload"
          onEnded={() => {
            if (alive.current) latest.current.onEnded?.();
          }}
          onPlay={() => {
            if (!alive.current) return;
            played.current = true;
            setBlocked(false);
            latest.current.onPlay?.();
          }}
          onPause={(event) => {
            if (
              alive.current &&
              played.current &&
              latest.current.autoPlay &&
              !event.currentTarget.ended
            )
              latest.current.onPause?.();
          }}
          onError={fail}
        />
      )}{" "}
      {blocked && (
        <p className="gallery-playback-hint" role="status">
          Autoplay was blocked by your browser. Press Play in the video
          controls.
        </p>
      )}
    </div>
  );
}
