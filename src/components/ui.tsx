"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useMotionPreference } from "./use-motion-preference";
import { X, Check, Camera, Copy, ArrowUpRight, Share2 } from "lucide-react";
import type { Product } from "@/lib/data";
import { useStore } from "./store";
import { SpamField, useSubmit } from "./forms";
import { FacebookIcon } from "./facebook-icon";
export function Photo({
  src,
  alt,
  className = "",
  priority = false,
  sizes = "(max-width:560px) 44vw, (max-width:800px) 45vw,23vw",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const source = failed || !src ? "/image-unavailable.svg" : src;
  const product =
    source.startsWith("/images/products/") && !source.endsWith("-detail.webp");
  const hero = source === "/images/hero/hero-gold-diamond-ring.webp";
  const srcSet = product
    ? `${source.replace(".webp", "-360.webp")} 360w, ${source} 720w`
    : hero
      ? `${source.replace(".webp", "-768.webp")} 768w,${source} 1536w`
      : source.startsWith("/api/media/")
        ? `${source}?w=480 480w,${source} 1600w`
        : undefined;
  return (
    <img
      key={source}
      src={source}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useMotionPreference();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 1, y: reduce ? 0 : 12 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduce ? 0 : 0.6 }}
    >
      {children}
    </motion.div>
  );
}
export function Heading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      <span className="ornament">◇</span>
    </div>
  );
}
export function ContactFields({
  defaults = {},
}: {
  defaults?: Record<string, string>;
}) {
  return (
    <>
      <label>
        Customer name
        <input
          name="name"
          required
          minLength={2}
          maxLength={200}
          defaultValue={defaults.name}
          autoComplete="name"
          placeholder="Your full name"
        />
      </label>
      <div className="form-row">
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            defaultValue={defaults.email}
            autoComplete="email"
          />
        </label>
        <label>
          Contact number
          <input
            name="mobile"
            type="tel"
            required
            minLength={7}
            maxLength={30}
            defaultValue={defaults.mobile}
            autoComplete="tel"
            placeholder="+63"
          />
        </label>
      </div>
    </>
  );
}
async function productImagePng(image?: string) {
  if (!image) return null;
  const response = await fetch(image);
  const blob = await response.blob();
  const source = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")?.drawImage(source, 0, 0);
  source.close();
  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
}
export function Inquiry({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { settings } = useStore();
  const { submit, busy, error, success } = useSubmit("inquiry");
  const [message, setMessage] = useState(""),
    [copiedMessage, setCopiedMessage] = useState(false),
    [copiedPhoto, setCopiedPhoto] = useState(false),
    [copyError, setCopyError] = useState(""),
    [shareMode, setShareMode] = useState<"photo" | "text" | null>(null),
    [shareError, setShareError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const shareFile = useRef<File | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  useEffect(() => {
    if (
      !success ||
      typeof navigator === "undefined" ||
      !navigator.share ||
      !navigator.canShare
    )
      return;
    let active = true;
    void (async () => {
      try {
        const png = await productImagePng(product?.images[0]);
        if (!active) return;
        const file = png
          ? new File([png], `${product?.slug || "product"}.png`, {
              type: "image/png",
            })
          : null;
        const title = `${product?.name || "Jewelry"} inquiry`;
        if (file && navigator.canShare({ files: [file], text: message, title })) {
          shareFile.current = file;
          setShareMode("photo");
          return;
        }
        if (navigator.canShare({ text: message, title })) {
          shareFile.current = null;
          setShareMode("text");
        }
      } catch {
        if (active) setShareMode(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [success, message, product]);
  function shareInquiry() {
    if (!shareMode) return;
    setShareError("");
    const title = `${product?.name || "Jewelry"} inquiry`;
    const data: ShareData =
      shareMode === "photo" && shareFile.current
        ? { files: [shareFile.current], text: message, title }
        : { text: message, title };
    try {
      if (!navigator.canShare(data)) {
        setShareError("Sharing is unavailable here. Copy the message and photo instead.");
        return;
      }
      void navigator.share(data).catch((e: unknown) => {
        if ((e as DOMException).name !== "AbortError")
          setShareError("Sharing was cancelled or unavailable. Copy the message and photo instead.");
      });
    } catch {
      setShareError("Sharing is unavailable here. Copy the message and photo instead.");
    }
  }
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage(true);
      setCopyError("");
    } catch {
      setCopyError("Please select and copy the message above.");
    }
  }
  async function copyPhoto() {
    try {
      const png = await productImagePng(product?.images[0]);
      if (!png) throw new Error("No product photo.");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      setCopiedPhoto(true);
      setCopyError("");
    } catch {
      setCopyError("Photo copy is unavailable here. Save the photo to share it.");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label="Jewelry inquiry"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button className="close" aria-label="Close inquiry" onClick={onClose}>
          <X />
        </button>
        {success ? (
          <>
            <div className="success-icon">
              <Check />
            </div>
            <h2>Your inquiry has been received.</h2>
            <p>
              Your request is saved with RK Luxmnl. On supported phones, share
              the message and product photo together, or copy them and paste
              both into a direct message. No social-media DM has been sent
              automatically.
            </p>
            <pre className="message-preview">{message}</pre>
            {shareMode && (
              <button className="btn full" onClick={shareInquiry}>
                <Share2 size={16} />
                {shareMode === "photo"
                  ? "Share message + photo"
                  : "Share message"}
              </button>
            )}
            <div className="button-row">
              <button className="btn" onClick={() => void copyMessage()}>
                <Copy size={16} />
                {copiedMessage ? "Message copied" : "Copy message"}
              </button>
              <button className="btn outline" onClick={() => void copyPhoto()}>
                <Camera size={16} />
                {copiedPhoto ? "Photo copied" : "Copy photo"}
              </button>
              {settings.instagram && (
                <a
                  className="btn outline"
                  href={settings.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Instagram <ArrowUpRight size={16} />
                </a>
              )}
              {settings.facebook && (
                <a
                  className="btn outline"
                  href={settings.facebook}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FacebookIcon size={16} /> Open Facebook
                </a>
              )}
            </div>
            {(copyError || shareError) && (
              <p role="status">{copyError || shareError}</p>
            )}
          </>
        ) : (
          <>
            <span className="eyebrow">LET’S TALK ABOUT YOUR PIECE</span>
            <h2>A personal inquiry</h2>
            {product && (
              <div className="inquiry-product">
                <Photo src={product.images[0]} alt={product.name} />
                <strong>{product.name}</strong>
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                if (await submit({ ...data, productId: product?.id || null }))
                  setMessage(
                    `Hello RK Luxmnl! I'm ${data.name}. I'd like to inquire about ${product?.name || "your jewelry collection"}. ${data.message}\nContact: ${data.email} / ${data.mobile}`,
                  );
              }}
            >
              <SpamField />
              <ContactFields />
              <label>
                Selected product
                <input
                  readOnly
                  value={product?.name || "General jewelry inquiry"}
                />
              </label>
              <label>
                Preferred contact platform
                <select name="platform">
                  <option>Instagram</option>
                  {settings.facebook && <option>Facebook</option>}
                  {settings.email && <option>Email</option>}
                </select>
              </label>
              <label>
                Message / questions
                <textarea
                  name="message"
                  required
                  minLength={1}
                  maxLength={12000}
                  rows={4}
                  placeholder="Short questions are welcome, e.g. How much is this?"
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="btn full" disabled={busy}>
                {busy ? "Sending…" : "Send inquiry →"}
              </button>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
