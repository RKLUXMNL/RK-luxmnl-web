"use client";
import { useEffect } from "react";
import {
  hasStrikePrice,
  isSaleProduct,
  money,
  type Product,
} from "@/lib/data";
import { Photo } from "./ui";
const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
function DetailGroup({
  title,
  values,
}: {
  title: string;
  values: [string, string][];
}) {
  if (!values.length) return null;
  return (
    <section className="print-group">
      <h3>{title}</h3>
      <dl>
        {values.map(([key, value]) => (
          <div key={key}>
            <dt>{label(key)}</dt>
            <dd className="preserve-lines">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function PrintSheet({ products }: { products: Product[] }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="print-sheet">
      <header className="print-header">
        <h1>RK Luxmnl — selected products</h1>
        <p>
          {new Date().toLocaleDateString("en-PH", {
            dateStyle: "long",
          })}
        </p>
      </header>
      <button className="btn print-button" onClick={() => window.print()}>
        Print page
      </button>
      {products.length ? (
        products.map((p) => (
          <article className="print-product" key={p.id}>
            <Photo
              className="print-photo"
              src={p.images[0]}
              alt={p.name}
              priority
            />
            <div className="print-copy">
              <span className="eyebrow">{p.categories.join(" · ")}</span>
              <h2>{p.name}</h2>
              <div className="print-price">
                {hasStrikePrice(p) && <s>{money(p.originalPrice)}</s>}{" "}
                {money(p.price)}
              </div>
              {isSaleProduct(p) && <span className="print-badge">ON SALE</span>}
              <p className="preserve-lines">{p.description}</p>
              <DetailGroup
                title="Specifications"
                values={Object.entries(p.specifications).filter(([, value]) =>
                  Boolean(value?.trim()),
                )}
              />
              <DetailGroup
                title="Policies"
                values={Object.entries(p.policies).filter(([, value]) =>
                  Boolean(value?.trim()),
                )}
              />
              <DetailGroup
                title="Authenticity and certificate"
                values={
                  [
                    ["authenticityText", p.authenticityText],
                    ["certificateType", p.certificateType],
                    ["certificateNumber", p.certificateNumber],
                    ["certificateIssuer", p.certificateIssuer],
                  ].filter(([, value]) => Boolean(value?.trim())) as [
                    string,
                    string,
                  ][]
                }
              />
            </div>
          </article>
        ))
      ) : (
        <p>No products selected.</p>
      )}
    </main>
  );
}
