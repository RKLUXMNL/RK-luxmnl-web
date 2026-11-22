"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section empty">
      <h1>A moment, please.</h1>
      <p>
        We could not load this page. Please try again or contact RK Luxmnl
        through Instagram.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
