"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Diamond,
  Search,
  Heart,
  Menu,
  X,
  Camera as Instagram,
  ArrowUpRight,
} from "lucide-react";
import { Photo } from "./ui";
import { FacebookIcon } from "./facebook-icon";
import { useStore } from "./store";
const links = [
  ["Home", "/"],
  ["Shop", "/shop"],
  ["Customization", "/customization"],
  ["Book a Viewing", "/book-a-viewing"],
  ["Live Selling", "/live-selling"],
  ["Reels", "/reels"],
  ["About", "/about"],
  ["Contact", "/contact"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { wishlist, error, settings } = useStore();
  const { instagram, facebook } = settings;
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        NATURAL BEAUTY. EXCEPTIONAL MOMENTS.{" "}
        <span>Private viewings in Metro Manila</span>
      </div>
      <header className="header">
        <Link href="/" className="brand" aria-label="RK Luxmnl home">
          {settings.logo ? (
            <Photo
              className="business-logo"
              src={settings.logo}
              alt={settings.businessName}
            />
          ) : (
            <Diamond size={25} />
          )}
        </Link>
        <nav className={open ? "nav open" : "nav"} aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              className={path === href ? "active" : ""}
              href={href}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-icons">
          <Link href="/shop?search=true" aria-label="Search jewelry">
            <Search size={19} />
          </Link>
          <Link
            href="/wishlist"
            aria-label={`Wishlist, ${wishlist.length} pieces`}
          >
            <Heart size={19} />
            {wishlist.length > 0 && <sup>{wishlist.length}</sup>}
          </Link>
          <button
            className="mobile-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <main id="main">{children}</main>
      <footer>
        <div className="footer-grid">
          <div>
            <Link
              className="brand footer-brand"
              href="/"
              aria-label={`${settings.businessName} home`}
            >
              {settings.logo ? (
                <Photo
                  className="business-logo footer-logo"
                  src={settings.logo}
                  alt={settings.businessName}
                />
              ) : (
                <Diamond size={25} />
              )}
            </Link>
            <p>
              Fine jewelry. Personal stories.
              <br />A little brilliance for every chapter.
            </p>
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={20} />
            </a>
            {facebook && (
              <a
                href={facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <FacebookIcon size={20} />
              </a>
            )}
          </div>
          <div>
            <h4>Explore</h4>
            <Link href="/shop">The collection</Link>
            <Link href="/customization">Bespoke jewelry</Link>
            <Link href="/wishlist">Your wishlist</Link>
          </div>
          <div>
            <h4>Let’s connect</h4>
            <Link href="/book-a-viewing">Private viewings</Link>
            <Link href="/contact">Contact & FAQs</Link>
            <a href={instagram} target="_blank" rel="noreferrer">
              Instagram <ArrowUpRight size={13} />
            </a>
            {facebook && (
              <a href={facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            )}
          </div>
          <div>
            <h4>A personal experience</h4>
            <p>
              {settings.location}
              <br />
              {settings.meetup}
            </p>
            <Link href="/book-a-viewing" className="text-link">
              Find your moment →
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {settings.businessName}
          </span>
          <Link href="/admin">Administration ↗</Link>
        </div>
      </footer>
    </>
  );
}
