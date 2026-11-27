"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Camera,
  Diamond,
  PenTool,
  Sparkles,
} from "lucide-react";
import { Photo, ContactFields, Inquiry } from "./ui";
import { useStore } from "./store";
import { ContactCTA } from "./storefront";
import { FacebookIcon } from "./facebook-icon";
import { photos } from "@/lib/data";
import { api } from "@/lib/client";
import { manilaDate, manilaLabel } from "@/lib/manila";
import { SpamField, useSubmit } from "./forms";
import { UploadControl } from "./uploads";
export function DateCalendar({
  value,
  onChange,
  marked,
  restrict = false,
}: {
  value: string;
  onChange: (v: string) => void;
  marked?: Record<string, string>;
  restrict?: boolean;
}) {
  const initial = (value || manilaDate()).split("-").map(Number);
  const [month, setMonth] = useState([initial[0], initial[1] - 1]);
  const [year, m] = month;
  const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  function move(delta: number) {
    const date = new Date(Date.UTC(year, m + delta, 1));
    setMonth([date.getUTCFullYear(), date.getUTCMonth()]);
  }
  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>
          {new Intl.DateTimeFormat("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(Date.UTC(year, m, 1)))}
        </strong>
        <button type="button" aria-label="Next month" onClick={() => move(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {Array.from(
          { length: new Date(Date.UTC(year, m, 1)).getUTCDay() },
          (_, i) => (
            <span key={`blank-${i}`} />
          ),
        )}
        {Array.from({ length: days }, (_, i) => {
          const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={date}
              aria-label={date}
              aria-pressed={value === date}
              title={marked?.[date]}
              disabled={restrict && (!marked?.[date] || date < manilaDate())}
              className={`${value === date ? "chosen" : ""} ${marked?.[date] ? "marked-date" : ""}`}
              onClick={() => onChange(date)}
            >
              {i + 1}
              {marked?.[date] && <span className="date-dot" />}
            </button>
          );
        })}
      </div>
      <p className="small">Dates and times are shown in Asia/Manila.</p>
    </div>
  );
}
type Slot = {
  id: string;
  startsAt: string;
  date: string;
  label: string;
  remaining: number;
};
export function Booking() {
  const { settings, products } = useStore();
  const { submit, busy, error, success } = useSubmit("viewing");
  const [slots, setSlots] = useState<Slot[]>([]),
    [loadError, setLoadError] = useState(""),
    [date, setDate] = useState(""),
    [slotId, setSlotId] = useState(""),
    [productId, setProductId] = useState(""),
    [review, setReview] = useState<Record<string, string> | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [validation, setValidation] = useState("");
  useEffect(() => {
    api<Slot[]>("/api/availability")
      .then(setSlots)
      .catch((e) => setLoadError(e.message));
    const id = new URLSearchParams(window.location.search).get("product");
    if (id) setProductId(id);
  }, []);
  const selected = slots.find((s) => s.id === slotId);
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">A PRIVATE INVITATION</span>
        <h1>
          A closer look.
          <br />
          <em>A more personal experience.</em>
        </h1>
        <p>
          Take your time. Explore the details. Find a piece that feels like you.
        </p>
      </section>
      <section className="section consultation-layout">
        <aside className="consultation-aside">
          <Photo
            src={photos.custom}
            alt="Personal jewelry design consultation inspiration"
          />
          <h2>Your moment of brilliance</h2>
          <p>
            Request a private jewelry viewing or a one-to-one design
            conversation.
          </p>
          <p>
            <MapPin size={18} />
            {settings.location}
          </p>
          <p>{settings.meetup}</p>
          <p className="small">
            Requests remain pending until the business confirms your
            appointment.
          </p>
        </aside>
        <div className="form-panel">
          {success ? (
            <div className="success-panel" role="status">
              <div className="success-icon">
                <Check />
              </div>
              <h2>A beautiful beginning.</h2>
              <p>
                Your viewing request has been submitted. Our team will contact
                you to confirm your appointment.
              </p>
              <Link className="btn" href="/showroom">
                Explore the collection
              </Link>
            </div>
          ) : review ? (
            <>
              <h2>Review your request</h2>
              <dl className="review-list">
                {Object.entries(review)
                  .filter(
                    ([key]) =>
                      !["website", "slotId", "productId"].includes(key),
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                {selected && (
                  <div>
                    <dt>Time</dt>
                    <dd>{selected.label}</dd>
                  </div>
                )}
              </dl>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="button-row">
                <button
                  className="btn outline"
                  onClick={() => {
                    setDraft(review);
                    setReview(null);
                  }}
                >
                  Edit details
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void submit({ ...review, productId: productId || null })
                  }
                >
                  {busy ? "Sending…" : "Submit viewing request"}
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selected) {
                  setValidation("Please select an available date and time.");
                  return;
                }
                setReview({
                  ...(Object.fromEntries(
                    new FormData(e.currentTarget),
                  ) as Record<string, string>),
                  slotId,
                });
                setValidation("");
              }}
            >
              <SpamField />
              <span className="eyebrow">YOUR PERSONAL CONSULTATION</span>
              <h2>Book a private viewing</h2>
              <label>
                Consultation type
                <select name="type" defaultValue={draft.type}>
                  {[
                    "Jewelry Viewing",
                    "Engagement Ring Consultation",
                    "Custom Jewelry Consultation",
                    "General Jewelry Inquiry",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Preferred location
                <select name="location" defaultValue={draft.location}>
                  <option>{settings.location}</option>
                  <option>{settings.meetup}</option>
                </select>
              </label>
              <label>Preferred date</label>
              <DateCalendar
                value={date}
                onChange={(v) => {
                  setDate(v);
                  setSlotId("");
                }}
                restrict
                marked={Object.fromEntries(
                  slots.map((s) => [s.date, "Available appointments"]),
                )}
              />
              {loadError && <p role="alert">{loadError}</p>}
              {!slots.length && !loadError && (
                <p>
                  Please contact us directly to arrange a viewing if no
                  published time suits you.
                </p>
              )}
              <div className="time-slots">
                {slots
                  .filter((s) => s.date === date)
                  .map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      aria-pressed={slotId === s.id}
                      className={slotId === s.id ? "chosen" : ""}
                      onClick={() => setSlotId(s.id)}
                    >
                      {manilaLabel(s.startsAt)}
                    </button>
                  ))}
              </div>
              <ContactFields defaults={draft} />
              {productId && products.some((p) => p.id === productId) && (
                <label>
                  Piece of interest
                  <input
                    readOnly
                    value={products.find((p) => p.id === productId)?.name || ""}
                  />
                </label>
              )}
              <label>
                Special requests
                <textarea
                  name="message"
                  defaultValue={draft.message}
                  maxLength={12000}
                  rows={3}
                />
              </label>
              {validation && <p role="alert">{validation}</p>}
              <button className="btn full">Review my request</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
export function Customization() {
  const { submit, busy, error, success } = useSubmit("custom");
  const { settings } = useStore();
  const [references, setReferences] = useState<{ id: string; token: string }[]>(
    [],
  );
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">YOUR STORY, BEAUTIFULLY MADE</span>
        <h1>
          Create Your Own Kind of <em>Sparkle.</em>
        </h1>
        <p>Let’s explore your vision together.</p>
      </section>
      <section className="section consultation-layout">
        <aside className="consultation-aside">
          <Photo
            src={photos.custom}
            alt="Jewelry design workspace and sketches"
          />
          <h2>Dream it. Make it personal.</h2>
          <p>
            From engagement rings to personalized jewelry, let us help bring
            your dream design to life.
          </p>
          <div className="process">
            <span>01 / Share your inspiration</span>
            <span>02 / Explore design possibilities</span>
            <span>03 / Request a personal quotation</span>
          </div>
        </aside>
        <div className="form-panel">
          {success ? (
            <div className="success-panel" role="status">
              <div className="success-icon">
                <Check />
              </div>
              <h2>Your vision starts here.</h2>
              <p>
                Your design request and uploaded references have been received.
              </p>
              {settings.instagram && (
                <a
                  className="btn"
                  href={settings.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Connect on Instagram
                </a>
              )}
              {settings.facebook && (
                <a
                  className="btn outline"
                  href={settings.facebook}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FacebookIcon size={16} /> Connect on Facebook
                </a>
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await submit({
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                  references,
                });
              }}
            >
              <SpamField />
              <h2>Your bespoke brief</h2>
              <div className="form-row">
                <label>
                  Jewelry type
                  <select name="jewelry">
                    {[
                      "Engagement Ring",
                      "Ring",
                      "Necklace / Pendant",
                      "Earrings",
                      "Bracelet",
                      "Other",
                    ].map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Preferred metal
                  <input
                    name="metal"
                    maxLength={200}
                    placeholder="Your preference, if any"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Preferred gemstone
                  <input name="gemstone" maxLength={200} />
                </label>
                <label>
                  Estimated budget
                  <input
                    name="budget"
                    maxLength={200}
                    placeholder="Your preferred budget range"
                  />
                </label>
              </div>
              <label>
                Design description
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={12000}
                  rows={4}
                />
              </label>
              <h3>Reference images</h3>
              <UploadControl
                purpose="custom"
                onComplete={(id, token) => {
                  if (token)
                    setReferences((current) => [
                      ...current.filter((file) => file.id !== id),
                      { id, token },
                    ]);
                }}
              />
              {references.map((reference, i) => (
                <div key={reference.id} className="button-row">
                  <span>Reference {i + 1} uploaded securely</span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setReferences(
                        references.filter((file) => file.id !== reference.id),
                      )
                    }
                  >
                    Remove from request
                  </button>
                </div>
              ))}
              <ContactFields />
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="btn full" disabled={busy}>
                {busy ? "Sending…" : "Submit my design request"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
export function About() {
  const { settings } = useStore();
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">WELCOME TO OUR WORLD</span>
        <h1>
          Jewelry with beauty.
          <br />
          <em>Moments with meaning.</em>
        </h1>
        <p>Discover {settings.businessName}.</p>
      </section>
      <section className="section about-layout">
        <Photo
          src={photos.custom}
          alt="A personal jewelry design taking shape"
          sizes="(max-width:560px) 88vw,45vw"
        />
        <div>
          <span className="eyebrow">PERSONAL, BY NATURE</span>
          <h2>
            A little brilliance.
            <br />A lifetime of meaning.
          </h2>
          <p>
            RK Luxmnl Diamond Jewelry is a Philippine jewelry wholesaler and
            retailer offering natural diamonds, gemstones, and jewelry for
            life’s meaningful moments.
          </p>
          <p>
            From diamond rings and engagement pieces to necklaces, earrings,
            bracelets, and gemstone jewelry, our selection invites you to find
            something personal.
          </p>
          <p>
            Jewelry customization and personalized designs let you explore a
            piece inspired by your own story.
          </p>
          <Link className="btn outline" href="/customization">
            Discover bespoke jewelry
          </Link>
        </div>
      </section>
      <section className="section about-values">
        {[
          [Diamond, "Naturally beautiful", "Natural diamonds and gemstones."],
          [
            PenTool,
            "Uniquely personal",
            "Customization and personalized design possibilities.",
          ],
          [
            Sparkles,
            "A closer connection",
            `Viewings at ${settings.location}, with ${settings.meetup.toLowerCase()}.`,
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Diamond;
          return (
            <div key={String(title)}>
              <I />
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </div>
          );
        })}
      </section>
      <ContactCTA />
    </>
  );
}
const faqs = [
  [
    "Can I request customized jewelry?",
    "Yes. Share your ideas through our customization form to request a personal design consultation and quotation.",
  ],
  [
    "Can I book a private viewing?",
    "Yes. Request an available time through Book a Viewing. The business will personally confirm your appointment.",
  ],
  [
    "Do you offer meetups in Metro Manila?",
    "Metro Manila meetups are subject to arrangement and confirmation.",
  ],
  [
    "How can I inquire about a jewelry piece?",
    "Choose Inquire on This Item on its details page. Your request will be saved for the business. You may also contact us through our configured social profiles.",
  ],
  [
    "Can I send a reference design?",
    "Yes. Upload your inspiration images securely with your custom design request.",
  ],
  [
    "Can I request product videos?",
    "Yes. Include your request in a product inquiry.",
  ],
];
export function Contact() {
  const { settings } = useStore();
  const [inquiry, setInquiry] = useState(false);
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">WE’D LOVE TO HEAR FROM YOU</span>
        <h1>
          Let’s find your
          <br />
          <em>something special.</em>
        </h1>
        <p>
          A question, a dream design, a moment worth celebrating. Start a
          conversation.
        </p>
      </section>
      <section className="section contact-layout">
        <div>
          <h2>A personal connection</h2>
          {settings.instagram && (
            <div className="contact-block">
              <Camera />
              <div>
                <h3>Instagram</h3>
                <a
                  className="text-link"
                  href={settings.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit our Instagram ↗
                </a>
              </div>
            </div>
          )}
          {settings.facebook && (
            <div className="contact-block">
              <FacebookIcon />
              <div>
                <h3>Facebook</h3>
                <a
                  className="text-link"
                  href={settings.facebook}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit our Facebook page ↗
                </a>
              </div>
            </div>
          )}
          {settings.email && (
            <p>
              <a href={`mailto:${settings.email}`}>{settings.email}</a>
            </p>
          )}
          {settings.mobile && (
            <p>
              <a href={`tel:${settings.mobile}`}>{settings.mobile}</a>
            </p>
          )}
          <div className="contact-block">
            <MapPin />
            <div>
              <h3>Visit by appointment</h3>
              <p>
                {settings.location}
                <br />
                {settings.meetup}
              </p>
              <Link className="text-link" href="/book-a-viewing">
                Request a private viewing →
              </Link>
            </div>
          </div>
          <div className="contact-map">
            <iframe
              title="Infina Towers, Quezon City viewing location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3860.4879626126826!2d121.0648278751065!3d14.6282200858615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b7901b57fc0f%3A0x38a54da548bde62e!2sInfina%20Towers!5e0!3m2!1sen!2sph!4v1795217662033!5m2!1sen!2sph"
              width="600"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <button className="btn" onClick={() => setInquiry(true)}>
            Send a general inquiry →
          </button>
        </div>
        <div className="faq">
          <span className="eyebrow">A FEW HELPFUL DETAILS</span>
          <h2>Good to know</h2>
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      {inquiry && <Inquiry onClose={() => setInquiry(false)} />}
    </>
  );
}
