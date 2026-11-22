"use client";
import { useState, ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useMotionPreference } from "./use-motion-preference";
import { ArrowRight, ChevronDown, Heart, ShieldCheck } from "lucide-react";
import { Product, money } from "@/lib/data";
import { useStore } from "./store";
import { Inquiry } from "./ui";
import { ProductCard } from "./storefront";
import { SpamField, useSubmit } from "./forms";
import { ProductGallery } from "./product-gallery";
import { FacebookIcon } from "./facebook-icon";
function Accordion({
  title,
  children,
  lazy = false,
}: {
  title: string;
  children: ReactNode;
  lazy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useMotionPreference();
  const key = title.toLowerCase().replace(/\W/g, "-");
  return (
    <section className="product-accordion">
      <h3>
        <button
          aria-expanded={open}
          aria-controls={key}
          onClick={() => setOpen(!open)}
        >
          {title}
          <ChevronDown
            size={18}
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </button>
      </h3>
      <motion.div
        id={key}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        aria-hidden={!open}
        inert={!open}
        transition={{ duration: reduce ? 0 : 0.2 }}
      >
        <div className="accordion-content">
          {!lazy || open ? children : null}
        </div>
      </motion.div>
    </section>
  );
}
function InlineInquiry({ product }: { product: Product }) {
  const { busy, error, success, submit } = useSubmit("inquiry");
  return success ? (
    <p role="status">Thank you. Your inquiry has been received.</p>
  ) : (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(
          new FormData(e.currentTarget),
        ) as Record<string, string>;
        await submit({
          name: data.name,
          message: data.message,
          website: data.website,
          email: data.contact.includes("@") ? data.contact : "",
          mobile: data.contact.includes("@") ? "" : data.contact,
          platform: "Instagram",
          productId: product.id,
        });
      }}
    >
      <SpamField />
      <label>
        Full name
        <input
          name="name"
          required
          minLength={2}
          maxLength={200}
          autoComplete="name"
        />
      </label>
      <label>
        Email or contact number
        <input name="contact" required maxLength={200} />
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={12000}
          rows={3}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? "Sending…" : "Send product inquiry"}
      </button>
    </form>
  );
}
function LayawayCalculator({ price }: { price: number | null }) {
  const [downPaymentRate, setDownPaymentRate] = useState(30);
  const [months, setMonths] = useState(6);
  if (price === null)
    return (
      <p className="small">
        Layaway computation is available once this item’s price is confirmed.
      </p>
    );
  const rate = Math.min(100, Math.max(0, Number(downPaymentRate) || 0));
  const downPayment = (price * rate) / 100;
  const balance = price - downPayment;
  const monthly = balance / months;
  return (
    <div className="layaway-calculator">
      <p className="small layaway-note">
        The listed price stays the same. This is a sample of how payments can be
        split; final terms are confirmed when you inquire.
      </p>
      <div className="layaway-controls">
        <label>
          Down payment (%)
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={downPaymentRate}
            onChange={(event) => setDownPaymentRate(Number(event.target.value))}
          />
        </label>
        <label>
          Payment term
          <select
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
          >
            {[3, 6, 12].map((option) => (
              <option key={option} value={option}>
                {option} months
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="layaway-result">
        <div>
          <span>Item price</span>
          <strong>{money(price)}</strong>
        </div>
        <div>
          <span>Down payment ({rate}%)</span>
          <strong>{money(downPayment)}</strong>
        </div>
        <div>
          <span>Remaining balance</span>
          <strong>{money(balance)}</strong>
        </div>
        <div className="layaway-monthly">
          <span>Monthly payment for {months} months</span>
          <strong>{money(monthly)}</strong>
        </div>
      </div>
      <p className="small layaway-formula">
        Computation: monthly payment = (item price − down payment) ÷ number of
        months.
      </p>
    </div>
  );
}
const labels: Record<string, string> = {
  brand: "Brand",
  color: "Color",
  condition: "Condition",
  inclusions: "Inclusions",
  otherDetails: "Other Details",
  metal: "Metal Type",
  purity: "Metal Purity",
  gemstone: "Gemstone Type",
  carat: "Diamond Carat Weight",
  size: "Ring Size",
  weight: "Jewelry Weight",
  customization: "Customization Availability",
};
export function ProductDetails({
  product: p,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { settings, wishlist, toggleWish } = useStore();
  const [inquiry, setInquiry] = useState(false);
  const policies = {
    ...settings.policies,
    ...Object.fromEntries(
      Object.entries(p.policies).filter(([, value]) => Boolean(value.trim())),
    ),
  };
  return (
    <>
      <div className="breadcrumb">
        <Link href="/shop">The collection</Link> /{" "}
        <Link href={`/shop?category=${encodeURIComponent(p.category)}`}>
          {p.category}
        </Link>{" "}
        / {p.name}
      </div>
      <section className="product-detail section">
        <div>
          <ProductGallery product={p} suspended={inquiry} />
          {((p.authenticityEnabled && p.authenticityText) ||
            p.certificateType ||
            p.certificateNumber ||
            p.certificateIssuer ||
            p.certificateUrl) && (
            <div className="authenticity">
              <ShieldCheck />
              <div>
                <h3>
                  {p.authenticityEnabled
                    ? "Authenticity information"
                    : "Certificate information"}
                </h3>
                {p.authenticityEnabled && p.authenticityText && (
                  <p>{p.authenticityText}</p>
                )}
                {[p.certificateType, p.certificateNumber, p.certificateIssuer]
                  .filter(Boolean)
                  .map((text, i) => (
                    <p key={i}>{text}</p>
                  ))}
                {p.certificateUrl && (
                  <a
                    className="text-link"
                    href={p.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View certificate ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="detail-copy">
          {p.isDemo && (
            <p className="notice">
              Demo product for testing. Images, prices, specifications and
              availability are illustrative, not actual RK Luxmnl inventory.
            </p>
          )}
          <span className="eyebrow">{p.category}</span>
          <h1>{p.name}</h1>
          <div className="detail-price">{money(p.price)}</div>
          {p.status && (
            <p className="availability">
              <span className="badge">{p.status}</span>
            </p>
          )}
          <dl className="product-specs">
            <div>
              <dt>Category</dt>
              <dd>{p.category}</dd>
            </div>
            {Object.entries(p.specifications)
              .filter(([, value]) => Boolean(value?.trim()))
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key] || key}</dt>
                  <dd className="preserve-lines">{value}</dd>
                </div>
              ))}
          </dl>
          <button className="btn full" onClick={() => setInquiry(true)}>
            INQUIRE ON THIS ITEM <ArrowRight size={16} />
          </button>
          <Link
            className="btn outline full"
            href={`/book-a-viewing?product=${encodeURIComponent(p.id)}`}
          >
            Request a Viewing
          </Link>
          <div className="button-row">
            <button className="text-link" onClick={() => toggleWish(p.id)}>
              <Heart
                size={16}
                fill={wishlist.includes(p.id) ? "currentColor" : "none"}
              />
              {wishlist.includes(p.id)
                ? "Saved to wishlist"
                : "Save to wishlist"}
            </button>
            {settings.instagram && (
              <a
                className="text-link"
                href={settings.instagram}
                target="_blank"
                rel="noreferrer"
              >
                Contact on Instagram ↗
              </a>
            )}
            {settings.facebook && (
              <a
                className="text-link"
                href={settings.facebook}
                target="_blank"
                rel="noreferrer"
              >
                <FacebookIcon size={16} /> Contact on Facebook ↗
              </a>
            )}
          </div>
          <div className="product-information">
            {policies.viewing && (
              <Accordion title="Viewing & Pickup Information">
                <p className="preserve-lines">{policies.viewing}</p>
                <Link
                  href={`/book-a-viewing?product=${p.id}`}
                  className="text-link"
                >
                  Request an appointment →
                </Link>
              </Accordion>
            )}
            {p.description && (
              <Accordion title="Product Description">
                <p className="preserve-lines">{p.description}</p>
              </Accordion>
            )}
            {policies.payment && (
              <Accordion title="Payment Options">
                <p className="preserve-lines">{policies.payment}</p>
              </Accordion>
            )}
            {policies.returns && (
              <Accordion title="Return & Exchange Policy">
                <p className="preserve-lines">{policies.returns}</p>
              </Accordion>
            )}
            <Accordion title="Ask About This Item" lazy>
              <InlineInquiry product={p} />
            </Accordion>
            <Accordion title="Layaway Computation">
              {policies.installment && (
                <p className="preserve-lines">{policies.installment}</p>
              )}
              <LayawayCalculator price={p.price} />
            </Accordion>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">YOUR PERSONAL EDIT</span>
            <h2>You May Also Like</h2>
          </div>
          <div className="product-grid">
            {related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
      {inquiry && <Inquiry product={p} onClose={() => setInquiry(false)} />}
    </>
  );
}
