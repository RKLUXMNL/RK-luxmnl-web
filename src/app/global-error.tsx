"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#fff9f2",
          color: "#3b2418",
          fontFamily: "Georgia,serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <main style={{ maxWidth: 600, padding: 35, textAlign: "center" }}>
          <p style={{ letterSpacing: 4, fontSize: 12, color: "#a87526" }}>
            RK LUXMNL
          </p>
          <h1 style={{ fontSize: 44, fontWeight: 400 }}>A moment, please.</h1>
          <p style={{ lineHeight: 1.8 }}>
            We could not load the website. Please try again or contact us
            directly about your jewelry inquiry.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "14px 25px",
              background: "#e8c68b",
              border: "1px solid #c9973b",
              color: "#3b2418",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p>
            <a
              href="https://www.instagram.com/rkluxmnl/"
              style={{ color: "#a87526" }}
            >
              Contact RK Luxmnl on Instagram
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
