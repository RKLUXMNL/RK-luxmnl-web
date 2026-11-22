"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Pause,
  Play,
  X,
  ZoomIn,
  Video,
} from "lucide-react";
import type { Product, ProductMedia } from "@/lib/data";
import { Photo } from "./ui";
import { GalleryVideo } from "./gallery-video";
import { useMotionPreference } from "./use-motion-preference";
export const PRODUCT_PHOTO_DURATION = 5000;
const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const visibilitySnapshot = () => document.visibilityState === "visible";
export function ProductGallery({
  product,
  suspended = false,
}: {
  product: Product;
  suspended?: boolean;
}) {
  const items: ProductMedia[] = product.media?.length
    ? product.media
    : [
        ...product.images.map((url, index) => ({
          id: `image-${index}`,
          kind: "image" as const,
          provider: "object",
          url,
        })),
        ...product.videos.map((video) => ({
          ...video,
          kind: "video" as const,
        })),
      ];
  if (!items.length)
    items.push({
      id: "missing",
      kind: "image",
      provider: "object",
      url: "/image-unavailable.svg",
    });
  const reduce = useMotionPreference();
  const tabVisible = useSyncExternalStore(
    subscribeVisibility,
    visibilitySnapshot,
    () => true,
  );
  const [selected, setSelected] = useState(0),
    [paused, setPaused] = useState<boolean | null>(null),
    [visible, setVisible] = useState(false),
    [full, setFull] = useState(false),
    [zoom, setZoom] = useState(false),
    [failed, setFailed] = useState<string | null>(null);
  const gallery = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    touch = useRef(0);
  const wanted = paused === null ? !reduce : !paused;
  const playing = Boolean(
    wanted && visible && tabVisible && !full && !suspended,
  );
  const index = Math.min(selected, items.length - 1),
    current = items[index];
  const move = useCallback(
    (delta: number) => {
      setSelected((value) => (value + delta + items.length) % items.length);
      setZoom(false);
      setFailed(null);
    },
    [items.length],
  );
  function choose(value: number) {
    setSelected(value);
    setZoom(false);
    if (value !== index) setFailed(null);
  }
  useEffect(() => {
    const element = gallery.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.25),
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || items.length < 2) return;
    if (current.kind === "video" && failed !== current.id) return;
    const timer = setTimeout(
      () => move(1),
      failed === current.id ? 2000 : PRODUCT_PHOTO_DURATION,
    );
    return () => clearTimeout(timer);
  }, [playing, index, current.id, current.kind, failed, items.length, move]);
  useEffect(() => {
    if (full) dialog.current?.showModal();
    else dialog.current?.close();
  }, [full]);
  function keydown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest("video,iframe,input")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPaused(true);
      move(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPaused(true);
      move(-1);
    }
  }
  function frameContent(expanded = false) {
    if (current.kind === "video")
      return (
        <GalleryVideo
          key={`${current.id}-${expanded ? "full" : "main"}`}
          media={current}
          autoPlay={!expanded && playing}
          onEnded={() => {
            if (!expanded && playing && items.length > 1) move(1);
          }}
          onPlay={() => {
            if (!expanded) setPaused(false);
          }}
          onPause={() => setPaused(true)}
          onUnavailable={() => setFailed(current.id)}
        />
      );
    return (
      <Photo
        src={current.url}
        alt={`${product.name}, image ${items.slice(0, index + 1).filter((item) => item.kind === "image").length}`}
        priority
        sizes={expanded ? "100vw" : "(max-width:560px) 88vw,50vw"}
      />
    );
  }
  return (
    <div
      ref={gallery}
      className="product-gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label={`${product.name} photos and videos`}
      onKeyDown={keydown}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.matches(":focus-visible") &&
          !target.closest("[data-gallery-playback-toggle]")
        )
          setPaused(true);
      }}
    >
      <div
        className="gallery-main"
        data-media-id={current.id}
        data-media-kind={current.kind}
        onTouchStart={(event) => {
          if ((event.target as HTMLElement).closest("video,iframe")) return;
          touch.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if ((event.target as HTMLElement).closest("video,iframe")) return;
          const delta = event.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
        }}
      >
        {current.kind === "image" ? (
          <button
            className="gallery-open"
            aria-label="Enlarge product image"
            onClick={() => setFull(true)}
          >
            {frameContent()}
            <Expand size={20} />
          </button>
        ) : !full ? (
          frameContent()
        ) : (
          <div className="gallery-video-message">
            Video open in fullscreen viewer
          </div>
        )}
        {current.kind === "video" && (
          <button
            className="gallery-video-expand"
            aria-label="Open video in fullscreen viewer"
            onClick={() => setFull(true)}
          >
            <Expand size={18} />
          </button>
        )}
        {items.length > 1 && (
          <>
            <button
              className="gallery-arrow previous"
              aria-label="Previous image or video"
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              className="gallery-arrow next"
              aria-label="Next image or video"
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      <div className="gallery-playback-controls">
        <span aria-live={playing ? "off" : "polite"}>
          {current.kind === "video" ? "Video" : "Photo"} {index + 1} of{" "}
          {items.length}
        </span>
        {items.length > 1 && (
          <button
            type="button"
            data-gallery-playback-toggle
            className="text-link"
            aria-label={wanted ? "Pause slideshow" : "Resume slideshow"}
            onClick={() => setPaused(wanted)}
          >
            {wanted ? <Pause size={15} /> : <Play size={15} />}{" "}
            {wanted ? "Pause slideshow" : "Play slideshow"}
          </button>
        )}
      </div>
      <div className="thumbnails" aria-label="Product media thumbnails">
        {items.map((item, i) => {
          const imageIndex = items
              .slice(0, i + 1)
              .filter((entry) => entry.kind === "image").length,
            videoIndex = items
              .slice(0, i + 1)
              .filter((entry) => entry.kind === "video").length;
          return (
            <button
              key={item.id}
              aria-label={
                item.kind === "image"
                  ? `View photo ${imageIndex}`
                  : `View video ${videoIndex}`
              }
              aria-pressed={i === index}
              onClick={() => choose(i)}
            >
              {item.kind === "image" ? (
                <Photo
                  src={item.url}
                  alt={`${product.name}, thumbnail ${imageIndex}`}
                />
              ) : (
                <span className="video-thumbnail">
                  <Video size={22} />
                  <span>Video {videoIndex}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="small gallery-help">
        {items.length > 1
          ? "Photos change every 5 seconds; videos advance when finished. Automatic videos start muted. Use the controls to pause or enable sound."
          : current.kind === "image"
            ? "Select the image to view fullscreen and inspect its details."
            : "Use the video controls to play, pause or enable sound."}
      </p>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`${product.name} fullscreen gallery`}
        onCancel={() => {
          setFull(false);
          setZoom(false);
        }}
      >
        <div className="gallery-tools">
          {current.kind === "image" ? (
            <button
              aria-label="Toggle image zoom"
              aria-pressed={zoom}
              onClick={() => setZoom(!zoom)}
            >
              <ZoomIn />
              {zoom ? "Fit image" : "Zoom"}
            </button>
          ) : (
            <span>Product video</span>
          )}
          <button
            aria-label="Close fullscreen gallery"
            onClick={() => {
              setFull(false);
              setZoom(false);
            }}
          >
            <X />
          </button>
        </div>
        <div
          className={
            "zoom-surface " + (zoom && current.kind === "image" ? "zoomed" : "")
          }
        >
          {full && frameContent(true)}
        </div>
        {items.length > 1 && (
          <div className="button-row">
            <button className="btn outline" onClick={() => move(-1)}>
              <ChevronLeft />
              Previous
            </button>
            <span>
              {index + 1} / {items.length}
            </span>
            <button className="btn outline" onClick={() => move(1)}>
              Next
              <ChevronRight />
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
