"use client";
import { useState } from "react";
import { Camera } from "lucide-react";
import { DateCalendar } from "./pages";
import { FacebookIcon } from "./facebook-icon";
import { useStore } from "./store";
import { Heading, Photo } from "./ui";
import { ProductCard } from "./storefront";
import { MediaPlayer } from "./video";
import { Product } from "@/lib/data";
import { manilaDate, manilaLabel } from "@/lib/manila";
export type LiveSession = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  status: string;
  instagramUrl: string;
  facebookUrl: string;
  replay: { id: string; provider: string } | null;
  thumbnail: { id: string } | null;
  trailer: { id: string; provider: string } | null;
  products: { product: Product; timestamp: number | null }[];
};
export type PublicReel = {
  id: string;
  title: string;
  description: string;
  instagramUrl: string;
  downloadsEnabled: boolean;
  asset: { id: string; provider: string } | null;
  products: Product[];
};
function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function WatchLink({
  platform,
  href,
  live,
}: {
  platform: "Instagram" | "Facebook";
  href: string;
  live: boolean;
}) {
  const label = live
    ? `Watch Live on ${platform}`
    : platform === "Instagram"
      ? "Visit Instagram"
      : "Visit Facebook";
  return (
    <a className="btn" href={href} target="_blank" rel="noreferrer">
      {platform === "Instagram" ? (
        <Camera size={17} />
      ) : (
        <FacebookIcon size={17} />
      )}
      {label} ↗
    </a>
  );
}
function SessionPanel({ session }: { session: LiveSession }) {
  const { settings } = useStore();
  const [timestamp, setTimestamp] = useState(0);
  const usesSessionLink = Boolean(session.instagramUrl || session.facebookUrl);
  const instagramHref = usesSessionLink
    ? session.instagramUrl
    : settings.instagram;
  const facebookHref = usesSessionLink
    ? session.facebookUrl
    : settings.facebook;
  const livePlatforms = [
    ...(session.instagramUrl ? ["Instagram"] : []),
    ...(session.facebookUrl ? ["Facebook"] : []),
  ];
  return (
    <article className="live-session">
      <div className="button-row">
        <span
          className={
            "badge " + (session.status === "Live Now" ? "live-badge" : "")
          }
        >
          {session.status === "Live Now" ? "LIVE NOW" : session.status}
        </span>
        <span className="small">
          {manilaLabel(session.startsAt)} · Asia/Manila
        </span>
      </div>
      <h2>{session.title}</h2>
      {(session.trailer || session.thumbnail) && (
        <div className="live-preview">
          {session.trailer ? (
            <MediaPlayer
              assetId={session.trailer.id}
              provider={session.trailer.provider}
              poster={
                session.thumbnail ? `/api/media/${session.thumbnail.id}?w=720` : undefined
              }
            />
          ) : session.thumbnail ? (
            <Photo
              className="live-preview-image"
              src={`/api/media/${session.thumbnail.id}?w=720`}
              alt={`${session.title} preview`}
              sizes="(max-width:800px) 100vw, 720px"
            />
          ) : null}
        </div>
      )}
      {session.description && (
        <p className="preserve-lines">{session.description}</p>
      )}
      {session.status === "Live Now" && (
        <div className="button-row">
          {instagramHref && (
            <WatchLink
              platform="Instagram"
              href={instagramHref}
              live={usesSessionLink}
            />
          )}
          {facebookHref && (
            <WatchLink
              platform="Facebook"
              href={facebookHref}
              live={usesSessionLink}
            />
          )}
        </div>
      )}
      {session.status === "Scheduled" && (
        <p>
          {livePlatforms.length
            ? `Join us on ${livePlatforms.join(" or ")} at the scheduled time.`
            : "Join us at the scheduled time; live links are added when available."}
        </p>
      )}
      {session.status === "Cancelled" && (
        <p>This session has been cancelled.</p>
      )}
      {session.status === "Completed" && (
        <>
          {session.replay ? (
            <MediaPlayer
              assetId={session.replay.id}
              provider={session.replay.provider}
              timestamp={timestamp}
            />
          ) : (
            <p className="notice">Replay not available yet.</p>
          )}
          {session.products.length > 0 && (
            <>
              <h3 className="live-products-heading">
                Jewelry Featured During This Live
              </h3>
              <div className="product-grid">
                {session.products.map(({ product, timestamp: featuredAt }) => (
                  <div key={product.id}>
                    <ProductCard product={product} />
                    {session.replay && featuredAt !== null && (
                      <button
                        className="text-link"
                        onClick={() => setTimestamp(featuredAt)}
                      >
                        Featured at {timeLabel(featuredAt)} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
export function LiveSelling({
  sessions,
  liveProducts,
}: {
  sessions: LiveSession[];
  liveProducts: Product[];
}) {
  const { settings } = useStore();
  const initial =
    sessions.find((s) => s.status === "Live Now") ||
    [...sessions]
      .filter((s) => manilaDate(s.startsAt) >= manilaDate())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ||
    sessions[0];
  const [date, setDate] = useState(
    initial ? manilaDate(initial.startsAt) : manilaDate(),
  );
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">DISCOVER, TOGETHER</span>
        <h1>
          Live moments.
          <br />
          <em>Lasting brilliance.</em>
        </h1>
        <p>
          Join RK Luxmnl on Instagram or Facebook and revisit jewelry featured
          in our recorded sessions.
        </p>
      </section>
      {liveProducts.length > 0 && (
        <section className="section">
          <Heading
            eyebrow="AVAILABLE IN LIVE SELLING"
            title="Live products"
            text="Explore jewelry selected for our live selling sessions."
          />
          <div className="product-grid">
            {liveProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
      <section className="section live-layout">
        <aside>
          <h2>Live Selling Calendar</h2>
          <DateCalendar
            value={date}
            onChange={setDate}
            marked={Object.fromEntries(
              sessions.map((s) => [manilaDate(s.startsAt), s.status]),
            )}
          />
          <p className="small">
            Marked dates have published sessions. Select a date to view its
            details.
          </p>
          {settings.instagram && (
            <a
              className="text-link"
              href={settings.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Follow RK Luxmnl on Instagram ↗
            </a>
          )}
        </aside>
        <div>
          {sessions
            .filter((s) => manilaDate(s.startsAt) === date)
            .map((session) => (
              <SessionPanel key={session.id} session={session} />
            ))}
          {!sessions.some((s) => manilaDate(s.startsAt) === date) && (
            <div className="empty">
              <h3>No sessions listed for this date.</h3>
              <p>
                Choose a marked date or visit our Instagram or Facebook profile
                for updates.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
export function Reels({ reels }: { reels: PublicReel[] }) {
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">LITTLE MOMENTS OF BRILLIANCE</span>
        <h1>
          The jewelry <em>edit.</em>
        </h1>
        <p>Explore our published Reels and the jewelry behind each story.</p>
      </section>
      <section className="section">
        {reels.length ? (
          <div className="reels-grid">
            {reels.map((reel) => (
              <article className="reel-card" key={reel.id}>
                {reel.asset && (
                  <div className="reel-video">
                    <MediaPlayer
                      assetId={reel.asset.id}
                      provider={reel.asset.provider}
                    />
                  </div>
                )}
                <h2>{reel.title}</h2>
                <p className="preserve-lines">{reel.description}</p>
                <div className="button-row">
                  {reel.instagramUrl && (
                    <a
                      className="btn outline"
                      href={reel.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Instagram Reel ↗
                    </a>
                  )}
                  {reel.downloadsEnabled && reel.asset && (
                    <a
                      className="btn outline"
                      href={`/api/reels/${reel.id}/download`}
                    >
                      Download Video
                    </a>
                  )}
                </div>
                {reel.products.length > 0 && (
                  <>
                    <h3>Featured jewelry</h3>
                    <div className="reel-products">
                      {reel.products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Discover our world on Instagram.</h2>
            <p>
              Visit our social profiles to explore the latest jewelry stories.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
