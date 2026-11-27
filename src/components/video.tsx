"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
export function MediaPlayer({
  assetId,
  provider,
  timestamp = 0,
  poster,
}: {
  assetId: string;
  provider: string;
  timestamp?: number;
  poster?: string;
}) {
  const [player, setPlayer] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (provider === "stream" && loaded)
      api<{ player: string }>(`/api/media/${assetId}`)
        .then((result) => {
          setPlayer(result.player);
          setError("");
        })
        .catch((e) => setError(e.message));
  }, [assetId, provider, loaded]);
  if (error)
    return (
      <p className="notice" role="status">
        This recording is temporarily unavailable. Please try again later.
      </p>
    );
  if (provider === "stream")
    return (
      <div className="stream-player">
        {!loaded ? (
          <button className="btn" onClick={() => setLoaded(true)}>
            Play recording
          </button>
        ) : player ? (
          <iframe
            key={timestamp}
            src={`${player}?startTime=${timestamp}s`}
            title="Jewelry video recording"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <p role="status">Loading secure playback…</p>
        )}
      </div>
    );
  return (
    <video
      key={`${assetId}:${timestamp}`}
      src={`/api/media/${assetId}${timestamp ? `#t=${timestamp}` : ""}`}
      poster={poster}
      controls
      playsInline
      preload="none"
      onError={() => setError("Playback unavailable")}
      controlsList="nodownload"
    />
  );
}
