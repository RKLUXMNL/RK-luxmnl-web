import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section empty">
      <h1>This page is not available.</h1>
      <p>
        The piece may no longer be published. Explore our collection or contact
        us for a personal selection.
      </p>
      <Link href="/shop" className="btn">
        Explore jewelry
      </Link>
    </section>
  );
}
