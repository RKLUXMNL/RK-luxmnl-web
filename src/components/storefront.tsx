"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { useEffect, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import {
  Diamond,
  Sparkles,
  PenTool,
  MapPin,
  Heart,
  ArrowRight,
  Camera,
  SlidersHorizontal,
} from "lucide-react";
import {
  Product,
  photos,
  categoryPhoto,
  money,
  isSaleProduct,
  hasStrikePrice,
  categories as preferredCategories,
} from "@/lib/data";
import { useStore } from "./store";
import { Photo, Reveal, Heading, Inquiry } from "./ui";
import { FacebookIcon } from "./facebook-icon";
export function ProductCard({ product: p }: { product: Product }) {
  const { wishlist, toggleWish } = useStore();
  const [inquiry, setInquiry] = useState(false);
  const sale = isSaleProduct(p);
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link href={`/products/${p.slug}`}>
          <Photo src={p.images[0]} alt={p.name} />
        </Link>
        {(p.placement === "LIVE" || sale || p.isDemo) && (
          <div className="product-card-badges">
            {p.placement === "LIVE" && (
              <span className="card-tag live-card-tag">LIVE</span>
            )}
            {sale && <span className="card-tag sale-card-tag">ON SALE</span>}
            {p.isDemo && <span className="card-tag">DEMO PRODUCT</span>}
          </div>
        )}
        <button
          className={"wish " + (wishlist.includes(p.id) ? "selected" : "")}
          onClick={() => toggleWish(p.id)}
          aria-label={`${wishlist.includes(p.id) ? "Remove" : "Save"} ${p.name}`}
        >
          <Heart
            size={18}
            fill={wishlist.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="product-info">
        <span className="eyebrow">{p.category}</span>
        <Link href={`/products/${p.slug}`}>
          <h3>{p.name}</h3>
        </Link>
        <p>{p.description}</p>
        <div className="product-price">
          {hasStrikePrice(p) && <s>{money(p.originalPrice)}</s>}
          {money(p.price)}
        </div>
        <span className="small">{p.status}</span>
        <div className="card-actions">
          <Link href={`/products/${p.slug}`}>
            View details <ArrowRight size={13} />
          </Link>
          <button onClick={() => setInquiry(true)}>Inquire now</button>
        </div>
      </div>
      {inquiry && <Inquiry product={p} onClose={() => setInquiry(false)} />}
    </article>
  );
}
export function Home() {
  const { products, categories, settings } = useStore();
  const showroomProducts = products.filter(
    (p) => p.placement === "SHOWROOM",
  );
  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <Reveal className="hero-copy">
          <span className="eyebrow">NATURAL DIAMONDS & GEMS</span>
          <h1>
            Timeless Jewelry
            <br />
            for Life’s
            <br />
            <em>Special Moments</em>
          </h1>
          <div className="fine-line" />
          <p>
            Discover natural diamonds, exquisite gemstones, and beautifully
            customized jewelry made to celebrate your most meaningful moments.
          </p>
          <div className="button-row">
            <Link href="/showroom" className="btn">
              Explore Collection <ArrowRight size={16} />
            </Link>
            <Link href="/book-a-viewing" className="btn outline">
              Book a Viewing
            </Link>
          </div>
          <span className="hero-note">
            <Diamond size={13} /> Thoughtfully selected. Personally yours.
          </span>
        </Reveal>
        <div className="hero-visual">
          <Photo
            src={photos.hero}
            alt="Diamond ring design on a warm champagne background"
            priority
            sizes="100vw"
          />
        </div>
        <span className="hero-index">01 — A TIMELESS BEGINNING</span>
      </section>
      <div className="trust-strip">
        {[
          [Diamond, "Natural Diamonds & Gems"],
          [Sparkles, "Personal Jewelry Selection"],
          [PenTool, "Customization Available"],
          [MapPin, "Private Viewings in Metro Manila"],
        ].map(([Icon, label]) => {
          const I = Icon as typeof Diamond;
          return (
            <div key={String(label)}>
              <I size={23} />
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <section className="section categories-section">
        <Heading
          eyebrow="FIND YOUR SIGNATURE"
          title="Explore by Category"
          text="Little luxuries. Meaningful milestones. Find the piece that speaks to you."
        />
        <div className="category-grid">
          {[...categories]
            .sort(
              (a, b) =>
                (preferredCategories.includes(a)
                  ? preferredCategories.indexOf(a)
                  : 99) -
                (preferredCategories.includes(b)
                  ? preferredCategories.indexOf(b)
                  : 99),
            )
            .slice(0, 5)
            .map((name) => (
              <Link
                key={name}
                className="category-card"
                href={`/showroom?category=${encodeURIComponent(name)}`}
              >
                <Photo
                  src={categoryPhoto(name)}
                  alt={`${name} design inspiration`}
                />
                <div>
                  <h3>{name}</h3>
                  <span>
                    Discover <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
        </div>
      </section>
      <section className="section featured">
        <Heading
          eyebrow="THE CONSIDERED COLLECTION"
          title="Featured Collection"
          text="Discover our published selection, thoughtfully chosen for your meaningful moments."
        />
        {showroomProducts.length ? (
          <div className="product-grid">
            {showroomProducts.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Diamond />
            <h3>Your next piece starts with a conversation.</h3>
            <p>
              Contact us to explore our current jewelry selection and
              personalized designs.
            </p>
            <Link className="btn" href="/contact">
              Request a personal selection
            </Link>
          </div>
        )}
        <div className="center">
          <Link className="btn outline" href="/showroom">
            Discover the Collection <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="bespoke">
        <div className="bespoke-image">
          <Photo
            src={photos.custom}
            alt="Ring design sketches and a jewelry design workspace"
            sizes="(max-width:560px) 100vw,50vw"
          />
        </div>
        <Reveal className="bespoke-copy">
          <span className="eyebrow">BESPOKE, BY YOU</span>
          <h2>
            Create Something
            <br />
            <em>Uniquely Yours</em>
          </h2>
          <div className="fine-line" />
          <p>
            From engagement rings to personalized jewelry, let us help bring
            your dream design to life.
          </p>
          <p className="small">
            Your inspiration. Your story. A design that is entirely your own.
          </p>
          <Link className="btn" href="/customization">
            Start a Custom Design <ArrowRight size={16} />
          </Link>
        </Reveal>
      </section>
      <section className="viewing-section section">
        <figure className="viewing-concept">
          <Photo
            src={photos.showroom}
            alt="Loose diamonds as jewelry design inspiration"
            sizes="(max-width:560px) 88vw,45vw"
          />
        </figure>
        <Reveal>
          <span className="eyebrow">A MOMENT, JUST FOR YOU</span>
          <h2>
            Experience Elegance <em>in Person</em>
          </h2>
          <p>
            Discover the details. Feel the brilliance. Request a private jewelry
            viewing at {settings.location}, or ask about a Metro Manila meetup.
          </p>
          <Link className="btn outline" href="/book-a-viewing">
            Schedule a Viewing <ArrowRight size={16} />
          </Link>
          <div className="location-note">
            <MapPin size={15} /> By appointment · Subject to confirmation
          </div>
        </Reveal>
        <Diamond className="viewing-diamond" strokeWidth={0.4} />
      </section>
      <section className="brand-story section">
        <div>
          <span className="eyebrow">THE RK LUXMNL EXPERIENCE</span>
          <h2>
            Beautiful jewelry.
            <br />
            <em>Genuine connection.</em>
          </h2>
        </div>
        <div>
          <p>
            At RK Luxmnl Diamond Jewelry, choosing jewelry should feel as
            special as wearing it. Explore natural diamonds and gemstones,
            personal consultations, and designs made personal.
          </p>
          <div className="trust-details">
            <span>
              <PenTool size={18} /> Personalized design consultations
            </span>
          </div>
          <Link href="/about" className="text-link">
            Discover our world <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <ContactCTA />
    </>
  );
}
export function ContactCTA() {
  const { settings } = useStore();
  return (
    <section className="contact-cta">
      <div className="contact-cta-image">
        <Photo
          src={photos.custom}
          alt="A personal jewelry design taking shape"
          sizes="(max-width:560px) 88vw,40vw"
        />
      </div>
      <div className="contact-cta-copy">
        <span className="eyebrow">
          EVERY BEAUTIFUL STORY STARTS WITH A CONVERSATION
        </span>
        <h2>
          Let’s Create Something <em>Timeless</em>
        </h2>
        <p>
          Tell us what you’re dreaming of. We’ll help you find your sparkle.
        </p>
        <div className="button-row">
          {settings.instagram && (
            <a
              className="btn"
              href={settings.instagram}
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={17} /> Message on Instagram
            </a>
          )}
          {settings.facebook && (
            <a
              className="btn outline"
              href={settings.facebook}
              target="_blank"
              rel="noreferrer"
            >
              <FacebookIcon size={17} /> Message on Facebook
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
function productSearchText(p: Product) {
  return [
    p.name,
    p.slug,
    p.category,
    p.categories.join(" "),
    p.description,
    p.status,
    p.placement === "LIVE" ? "live live selling" : "showroom",
    isSaleProduct(p) ? "sale on sale" : "",
    p.price,
    p.originalPrice,
    money(p.price),
    money(p.originalPrice),
    ...Object.entries(p.specifications).flat(),
    ...Object.entries(p.policies).flat(),
    p.authenticityText,
    p.certificateType,
    p.certificateNumber,
    p.certificateIssuer,
  ]
    .join(" ")
    .toLowerCase();
}
export function Catalog({ wishlistOnly = false }: { wishlistOnly?: boolean }) {
  const { products, categories, wishlist } = useStore();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [sort, setSort] = useState("name"),
    [priceMode, setPriceMode] = useState("all"),
    [range, setRange] = useState<number[] | null>(null),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCategory(params.get("category") || "All");
    if (params.has("search"))
      document.getElementById("product-search")?.focus();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [search, category, sort, priceMode, range]);
  const terms = search
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const scopedProducts = terms.length
    ? products
    : products.filter((p) => p.placement === "SHOWROOM");
  const prices = scopedProducts
    .filter((p) => p.price !== null)
    .map((p) => p.price!);
  const min = prices.length ? Math.min(...prices) : 0,
    max = prices.length ? Math.max(...prices) : 0;
  const values = range
    ? [
        Math.max(min, Math.min(range[0], max)),
        Math.min(max, Math.max(range[1], min)),
      ]
    : [min, max];
  const filtered = scopedProducts
    .filter(
      (p) =>
        (!wishlistOnly || wishlist.includes(p.id)) &&
        (category === "All" || p.categories.includes(category)) &&
        terms.every((term) => productSearchText(p).includes(term)) &&
        (priceMode === "inquiry"
          ? p.price === null
          : priceMode === "priced"
            ? p.price !== null && p.price >= values[0] && p.price <= values[1]
            : true),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "price-low"
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === "price-high"
            ? (b.price ?? -Infinity) - (a.price ?? -Infinity)
            : 0,
    );
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function reset() {
    setSearch("");
    setCategory("All");
    setSort("name");
    setRange(null);
    setPriceMode("all");
    setPage(1);
  }
  return (
    <section className="section catalog">
      <Heading
        eyebrow={
          wishlistOnly ? "YOUR PERSONAL EDIT" : "THE RK LUXMNL COLLECTION"
        }
        title={
          wishlistOnly
            ? "Pieces close to your heart"
            : "Find your kind of brilliance"
        }
        text="Discover jewelry selected for meaningful moments."
      />
      <div className="catalog-toolbar">
        <input
          type="search"
          id="product-search"
          aria-label="Search products"
          placeholder="Search by name, detail, price, or weight…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <button
          className="btn outline filter-toggle"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Alphabetical (A–Z)</option>
          <option value="featured">Featured selection</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
      <div className={"filters " + (filters ? "expanded" : "")}>
        <div className="filter-chips">
          {["All", ...categories].map((name) => (
            <button
              key={name}
              className={category === name ? "selected" : ""}
              onClick={() => {
                setCategory(name);
                setPage(1);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="price-filter">
          <label>
            Pricing
            <select
              value={priceMode}
              aria-label="Pricing"
              onChange={(e) => setPriceMode(e.target.value)}
            >
              <option value="all">All jewelry</option>
              <option value="priced">Published prices only</option>
              <option value="inquiry">Price Upon Inquiry only</option>
            </select>
          </label>
          {prices.length > 0 && (
            <>
              <div className="range-values">
                {money(values[0])} — {money(values[1])}
              </div>
              <Slider.Root
                className="dual-slider"
                aria-label="Product price range"
                min={min}
                max={max === min ? min + 1 : max}
                step={0.01}
                disabled={max === min}
                value={values}
                onValueChange={(value) => {
                  setRange(value);
                  setPriceMode("priced");
                  setPage(1);
                }}
              >
                <Slider.Track className="slider-track">
                  <Slider.Range className="slider-range" />
                </Slider.Track>
                <Slider.Thumb
                  className="slider-thumb"
                  aria-label="Minimum price"
                />
                <Slider.Thumb
                  className="slider-thumb"
                  aria-label="Maximum price"
                />
              </Slider.Root>
              <div className="form-row">
                <label>
                  Minimum price
                  <input
                    type="number"
                    min={min}
                    max={values[1]}
                    value={values[0]}
                    onChange={(e) => {
                      setRange([
                        Math.min(
                          values[1],
                          Math.max(min, Number(e.target.value)),
                        ),
                        values[1],
                      ]);
                      setPriceMode("priced");
                    }}
                  />
                </label>
                <label>
                  Maximum price
                  <input
                    type="number"
                    min={values[0]}
                    max={max}
                    value={values[1]}
                    onChange={(e) => {
                      setRange([
                        values[0],
                        Math.max(
                          values[0],
                          Math.min(max, Number(e.target.value)),
                        ),
                      ]);
                      setPriceMode("priced");
                    }}
                  />
                </label>
              </div>
            </>
          )}
          <button className="text-link" onClick={reset}>
            Reset Filters
          </button>
        </div>
      </div>
      <p className="small">
        {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
      </p>
      {filtered.length ? (
        <div className="product-grid">
          {pageProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Heart />
          <h3>
            {wishlistOnly ? "Your personal edit awaits." : "No pieces found"}
          </h3>
          <p>
            {scopedProducts.length
              ? "Try another search or reset your filters."
              : "Contact us for a personal selection from our current jewelry offerings."}
          </p>
          <Link className="btn outline" href="/contact">
            Contact RK Luxmnl
          </Link>
        </div>
      )}
      {pageCount > 1 && (
        <nav className="pagination" aria-label="Product pages">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (number) => (
              <button
                key={number}
                className={number === currentPage ? "current" : ""}
                aria-label={`Page ${number}`}
                aria-current={number === currentPage ? "page" : undefined}
                onClick={() => {
                  setPage(number);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {number}
              </button>
            ),
          )}
        </nav>
      )}
    </section>
  );
}
