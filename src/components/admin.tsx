"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowUp, ArrowDown, Trash2, LogOut } from "lucide-react";
import { api } from "@/lib/client";
import { money } from "@/lib/data";
import type { Settings } from "@/lib/settings";
import { manilaLabel } from "@/lib/manila";
import { UploadControl } from "./uploads";
import { Photo } from "./ui";
import { MediaPlayer } from "./video";
import { ProductMediaUpload } from "./product-media-upload";
type Asset = {
  id: string;
  filename: string;
  kind: string;
  purpose: string;
  provider: string;
  state: string;
  authorized: boolean;
  error?: string;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number; productCategories?: number };
};
type AdminRole = "OWNER" | "ADMIN";
type AdminRow = {
  id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
};
type AdminProduct = {
  isDemo: boolean;
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryIds?: string[];
  price: string | null;
  description: string;
  availability: string;
  published: boolean;
  ownerConfirmed: boolean;
  archived: boolean;
  specifications: Record<string, string>;
  policies: Record<string, string>;
  authenticityEnabled: boolean;
  authenticityText: string;
  certificateId: string | null;
  certificateType: string;
  certificateNumber: string;
  certificateIssuer: string;
  media: { assetId: string; asset: Asset }[];
};
type SessionRow = {
  id: string;
  title: string;
  startsAt: string;
  description: string;
  status: string;
  instagramUrl: string;
  facebookUrl: string;
  published: boolean;
  replayId: string | null;
  products: { productId: string; timestamp: number | null }[];
};
type ReelRow = {
  id: string;
  title: string;
  description: string;
  instagramUrl: string;
  published: boolean;
  assetId: string | null;
  downloadsEnabled: boolean;
  products: { productId: string }[];
};
type RequestRow = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  message: string;
  status: string;
  createdAt: string;
  type?: string;
  location?: string;
  jewelry?: string;
  metal?: string;
  gemstone?: string;
  budget?: string;
  product?: { name: string } | null;
  slot?: { startsAt: string };
  references?: { assetId: string }[];
};
type Data = {
  query: string;
  page: number;
  hasMore: boolean;
  products: AdminProduct[];
  categories: Category[];
  inquiries: RequestRow[];
  appointments: RequestRow[];
  customizations: RequestRow[];
  assets: Asset[];
  sessions: SessionRow[];
  reels: ReelRow[];
  settings: Settings;
  slots: { id: string; startsAt: string; capacity: number; enabled: boolean }[];
  blocked: { date: string; reason: string }[];
  counts: number[];
  viewer: { id: string; email: string; role: AdminRole };
  admins: AdminRow[];
};
const policyFields = [
  ["installment", "Layaway Computation"],
  ["payment", "Payment Methods"],
  ["delivery", "Delivery Options"],
] as const;
const specFields = [
  ["carat", "Gemstones Carat Weight"],
  ["metal", "Metal Type and Weight"],
  ["size", "Size"],
  ["inclusions", "Inclusions"],
  ["otherDetails", "Other Details"],
];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function Policies({
  values = {},
  prefix = "policy.",
}: {
  values?: Record<string, string>;
  prefix?: string;
}) {
  return (
    <>
      {policyFields.map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            name={`${prefix}${key}`}
            defaultValue={values[key] || ""}
            rows={3}
            maxLength={10000}
          />
        </label>
      ))}
    </>
  );
}
function ProductEditor({
  value,
  data,
  onSave,
  onRefresh,
  onClose,
}: {
  value: AdminProduct | null;
  data: Data;
  onSave: (resource: string, payload: unknown) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [mediaIds, setMediaIds] = useState(
      value?.media.map((m) => m.assetId) || [],
    ),
    [busy, setBusy] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false),
    [mediaPending, setMediaPending] = useState(false);
  function move(index: number, delta: number) {
    const copy = [...mediaIds];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    setMediaIds(copy);
  }
  return (
    <section className="admin-editor">
      <div className="admin-title">
        <h2>{value ? "Edit jewelry" : "Add jewelry"}</h2>
        <button
          aria-label="Close product editor"
          onClick={onClose}
          disabled={mediaBusy}
        >
          <X />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (mediaBusy || mediaPending) return;
          setBusy(true);
          const form = new FormData(e.currentTarget);
          const fields = Object.fromEntries(form) as Record<string, string>;
          const categoryIds = form
            .getAll("categoryIds")
            .map((categoryId) => String(categoryId));
          const payload = {
            id: value?.id,
            name: fields.name,
            slug: value?.slug || slugify(fields.name),
            categoryId: fields.categoryId,
            categoryIds,
            price: fields.price === "" ? null : Number(fields.price),
            description: fields.description,
            availability: fields.availability,
            published: fields.published === "on",
            ownerConfirmed: fields.ownerConfirmed === "on",
            archived: false,
            specifications: Object.fromEntries(
              specFields.map(([key]) => [key, fields[`spec.${key}`] || ""]),
            ),
            policies: Object.fromEntries(
              policyFields.map(([key]) => [key, fields[`policy.${key}`] || ""]),
            ),
            authenticityEnabled: value?.authenticityEnabled ?? false,
            authenticityText: value?.authenticityText ?? "",
            certificateType: value?.certificateType ?? "",
            certificateNumber: value?.certificateNumber ?? "",
            certificateIssuer: value?.certificateIssuer ?? "",
            certificateId: value?.certificateId ?? null,
            mediaIds,
          };
          if (await onSave("products", payload)) onClose();
          setBusy(false);
        }}
      >
        <fieldset>
          <legend>Basic information</legend>
          <div className="form-row">
            <label>
              Product name
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={value?.name}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Category
              <select
                name="categoryId"
                aria-label="Category"
                defaultValue={value?.categoryId}
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="category-options">
              <legend>Additional categories</legend>
              {data.categories.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={(value?.categoryIds || []).includes(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
            <label>
              Price (PHP; blank = inquiry)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={value?.price ?? ""}
              />
            </label>
          </div>
          <label>
            Availability
            <select
              name="availability"
              defaultValue={value?.availability || "Available"}
            >
              {["Available", "Reserved", "Sold", "Made to Order"].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Product description
            <textarea
              name="description"
              defaultValue={value?.description}
              rows={5}
              maxLength={12000}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Media</legend>
          <ProductMediaUpload
            selectedIds={mediaIds}
            onBusyChange={setMediaBusy}
            onPendingChange={setMediaPending}
            onRemove={(id) =>
              setMediaIds((current) => current.filter((item) => item !== id))
            }
            onComplete={async (id, orderedIds) => {
              setMediaIds((current) =>
                orderedIds
                  ? [
                      ...current.filter((value) => !orderedIds.includes(value)),
                      ...orderedIds,
                    ]
                  : [...new Set([...current, id])],
              );
              await onRefresh();
            }}
          />
          <details>
            <summary>Upload a video using Stream</summary>
            <UploadControl
              purpose="product"
              provider="stream"
              onComplete={async (id) => {
                setMediaIds((current) => [...new Set([...current, id])]);
                await onRefresh();
              }}
            />
          </details>
          <label>
            Add an existing file
            <select
              value=""
              disabled={mediaBusy || mediaPending || mediaIds.length >= 30}
              onChange={(e) => {
                if (e.target.value)
                  setMediaIds([...new Set([...mediaIds, e.target.value])]);
              }}
            >
              <option value="">Choose ready product media</option>
              {data.assets
                .filter((a) => a.purpose === "product" && a.state === "ready")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.filename} · {a.kind}
                  </option>
                ))}
            </select>
          </label>
          <p className="small">
            Photos and videos play in this gallery order. The first image is the
            catalog photograph. Remove detaches a file; permanent deletion is
            available in Media Library.
          </p>
          <div className="ordered-media">
            {mediaIds.map((id, index) => {
              const asset =
                data.assets.find((a) => a.id === id) ||
                value?.media.find((m) => m.assetId === id)?.asset;
              return (
                <div key={id} className="ordered-media-row">
                  {asset?.kind === "image" && (
                    <Photo src={`/api/media/${id}`} alt={asset.filename} />
                  )}
                  <span>
                    {asset?.filename || "Uploaded file"}{" "}
                    <small>{asset?.state}</small>
                  </span>
                  {asset?.kind === "image" && index > 0 && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={mediaBusy || mediaPending}
                      onClick={() =>
                        setMediaIds([
                          id,
                          ...mediaIds.filter((item) => item !== id),
                        ])
                      }
                    >
                      Set primary image
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Move media ${index + 1} up`}
                    disabled={index === 0 || mediaBusy || mediaPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move media ${index + 1} down`}
                    disabled={
                      index === mediaIds.length - 1 || mediaBusy || mediaPending
                    }
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove media ${index + 1}`}
                    disabled={mediaBusy || mediaPending}
                    onClick={() =>
                      setMediaIds(mediaIds.filter((x) => x !== id))
                    }
                  >
                    <X size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Specifications</legend>
          <div className="form-row">
            {specFields.map(([key, label]) => (
              <label key={key}>
                {label}
                {key === "inclusions" || key === "otherDetails" ? (
                  <textarea
                    name={`spec.${key}`}
                    defaultValue={value?.specifications[key] || ""}
                    rows={3}
                    maxLength={12000}
                  />
                ) : (
                  <input
                    name={`spec.${key}`}
                    defaultValue={value?.specifications[key] || ""}
                    maxLength={200}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Additional information</legend>
          <p className="small">
            Enter approved product-specific overrides only. Blank fields inherit
            approved Website Settings; sections without either are hidden.
          </p>
          <Policies values={value?.policies} />
        </fieldset>
        <fieldset>
          <legend>Publication</legend>
          <label className="check-label">
            <input
              type="checkbox"
              name="ownerConfirmed"
              defaultChecked={value?.ownerConfirmed}
            />{" "}
            I confirm this is actual approved inventory and the details, price
            and media are accurate.
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="published"
              defaultChecked={value?.published}
            />{" "}
            Publish on the website
          </label>
        </fieldset>
        <button className="btn" disabled={busy || mediaBusy || mediaPending}>
          {busy ? "Saving…" : "Save product"}
        </button>
        {mediaPending && (
          <p className="small" role="status">
            Upload all selected files, or remove unfinished files from the
            queue, before saving.
          </p>
        )}
      </form>
    </section>
  );
}
function ContentEditor({
  kind,
  value,
  data,
  onSave,
  onRefresh,
  onClose,
}: {
  kind: "sessions" | "reels";
  value: SessionRow | ReelRow | null;
  data: Data;
  onSave: (resource: string, payload: unknown) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [assetId, setAssetId] = useState(
      (value && ("replayId" in value ? value.replayId : value.assetId)) || "",
    ),
    [selected, setSelected] = useState(
      value?.products.map((p) => p.productId) || [],
    ),
    [busy, setBusy] = useState(false);
  const isLive = kind === "sessions";
  const facebookValue =
    value && "facebookUrl" in value ? value.facebookUrl : "";
  return (
    <section className="admin-editor">
      <div className="admin-title">
        <h2>
          {value ? "Edit" : "Add"} {isLive ? "live session" : "Reel"}
        </h2>
        <button aria-label="Close content editor" onClick={onClose}>
          <X />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const fields = Object.fromEntries(
            new FormData(e.currentTarget),
          ) as Record<string, string>;
          const common = {
            id: value?.id,
            title: fields.title,
            description: fields.description,
            instagramUrl: fields.instagramUrl,
            published: fields.published === "on",
            ...(isLive ? { facebookUrl: fields.facebookUrl } : {}),
          };
          const payload = isLive
            ? {
                ...common,
                startsAt: new Date(`${fields.startsAt}:00+08:00`).toISOString(),
                status: fields.status,
                replayId: assetId || null,
                products: selected.map((productId) => ({
                  productId,
                  timestamp: fields[`timestamp.${productId}`]
                    ? Number(fields[`timestamp.${productId}`])
                    : null,
                })),
              }
            : {
                ...common,
                assetId: assetId || null,
                downloadsEnabled: fields.downloadsEnabled === "on",
                productIds: selected,
              };
          if (await onSave(kind, payload)) onClose();
          setBusy(false);
        }}
      >
        <label>
          Title
          <input name="title" required defaultValue={value?.title} />
        </label>
        {isLive && (
          <div className="form-row">
            <label>
              Date and time (Asia/Manila)
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={
                  value && "startsAt" in value
                    ? new Date(new Date(value.startsAt).getTime() + 8 * 3600000)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>
            <label>
              Session status
              <select
                name="status"
                defaultValue={
                  value && "status" in value ? value.status : "Scheduled"
                }
              >
                {["Scheduled", "Live Now", "Completed", "Cancelled"].map(
                  (status) => (
                    <option key={status}>{status}</option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}
        <label>
          Description
          <textarea
            name="description"
            defaultValue={value?.description}
            rows={4}
          />
        </label>
        <label>
          Instagram {isLive ? "Live" : "Reel"} URL
          <input
            name="instagramUrl"
            type="url"
            defaultValue={value?.instagramUrl}
            placeholder="https://www.instagram.com/…"
          />
        </label>
        {isLive && (
          <label>
            Facebook Live URL
            <input
              name="facebookUrl"
              type="url"
              defaultValue={facebookValue}
              placeholder="https://www.facebook.com/…"
            />
          </label>
        )}
        <UploadControl
          purpose={isLive ? "live" : "reel"}
          provider={isLive ? "stream" : "object"}
          onComplete={async (id) => {
            setAssetId(id);
            await onRefresh();
          }}
        />
        <label>
          {isLive ? "Replay recording" : "Original video"}
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">No uploaded recording</option>
            {data.assets
              .filter((a) => a.purpose === (isLive ? "live" : "reel"))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename} · {a.state}
                </option>
              ))}
          </select>
        </label>
        {assetId && (
          <p className="small">
            Upload state:{" "}
            {data.assets.find((a) => a.id === assetId)?.state || "refreshing"}
          </p>
        )}
        <fieldset>
          <legend>Associated jewelry</legend>
          <p className="small">
            These are shared catalog records. Unpublished products never appear
            publicly.
          </p>
          {data.products
            .filter((p) => !p.archived)
            .map((p) => (
              <div key={p.id}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name} {!p.published && "(unpublished)"}
                </label>
                {isLive && selected.includes(p.id) && (
                  <label>
                    Featured at (seconds, optional)
                    <input
                      name={`timestamp.${p.id}`}
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={
                        value && "startsAt" in value
                          ? (value.products.find(
                              (item) => item.productId === p.id,
                            )?.timestamp ?? "")
                          : ""
                      }
                    />
                  </label>
                )}
              </div>
            ))}
        </fieldset>
        {!isLive && (
          <label className="check-label">
            <input
              type="checkbox"
              name="downloadsEnabled"
              defaultChecked={
                value && "downloadsEnabled" in value
                  ? value.downloadsEnabled
                  : false
              }
            />{" "}
            Allow downloading the authorized original file
          </label>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            name="published"
            defaultChecked={value?.published}
          />{" "}
          Publish
        </label>
        <p className="small">
          Recordings must be ready to play before they can be published.
          Completed sessions without a recording show a replay-unavailable
          message.
        </p>
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save content"}
        </button>
      </form>
    </section>
  );
}
export function Admin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("Overview"),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [search, setSearch] = useState(""),
    [productSort, setProductSort] = useState("name"),
    [logo, setLogo] = useState<string | null>(null),
    [productEdit, setProductEdit] = useState<AdminProduct | null | undefined>(
      undefined,
    ),
    [contentEdit, setContentEdit] = useState<
      SessionRow | ReelRow | null | undefined
    >(undefined),
    [adminForm, setAdminForm] = useState(false);
  async function refresh(q = search) {
    try {
      setData(await api<Data>(`/api/admin/data?q=${encodeURIComponent(q)}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    api<Data>("/api/admin/data")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function save(resource: string, payload: unknown) {
    try {
      await api(`/api/admin/${resource}`, payload);
      setFeedback("Changes saved.");
      setError("");
      await refresh();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function remove(resource: string, id: string) {
    const category = data?.categories.find((c) => c.id === id);
    const productCount =
      category?._count?.productCategories ?? category?._count?.products ?? 0;
    if (
      !confirm(
        resource === "products"
          ? "Archive this product and remove it from the public catalog?"
          : resource === "categories" && productCount > 0
            ? `Delete this category? Its ${productCount} product${productCount === 1 ? "" : "s"} will be unlinked from it and removed from the shop if no categories remain.`
            : "Delete this record?",
      )
    )
      return;
    try {
      await api(`/api/admin/${resource}`, { id }, "DELETE");
      setFeedback("Record updated.");
      await refresh();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const tabs = [
    "Overview",
    "Products",
    "Categories",
    "Inquiries",
    "Viewings",
    "Customization",
    "Live Selling",
    "Reels",
    "Media Library",
    "Website Settings",
    ...(data?.viewer.role === "OWNER" ? ["Administrators"] : []),
  ];
  const resource =
    tab === "Inquiries"
      ? "inquiries"
      : tab === "Viewings"
        ? "appointments"
        : "customizations";
  const requests = data?.[resource] || [];
  const sortedProducts = [...(data?.products || [])].sort((a, b) =>
    productSort === "name" ? a.name.localeCompare(b.name) : 0,
  );
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <span className="eyebrow">RK LUXMNL</span>
        <h2>Business studio</h2>
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => {
              setTab(name);
              setProductEdit(undefined);
              setContentEdit(undefined);
              setFeedback("");
              setAdminForm(false);
            }}
          >
            {name}
          </button>
        ))}
        <button
          onClick={async () => {
            try {
              await api("/api/auth/logout", {});
              setData(null);
              window.location.replace("/admin/login");
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <div className="admin-main">
        <div className="admin-title">
          <div>
            <span className="eyebrow">YOUR BUSINESS, AT A GLANCE</span>
            <h1>{tab}</h1>
          </div>
          {["Products", "Live Selling", "Reels"].includes(tab) && (
            <div className="admin-title-actions">
              {tab === "Products" && (
                <select
                  aria-label="Sort admin products"
                  value={productSort}
                  onChange={(e) => setProductSort(e.target.value)}
                >
                  <option value="name">Alphabetical (A–Z)</option>
                  <option value="recent">Recently added</option>
                </select>
              )}
              <button
                className="btn"
                onClick={() =>
                  tab === "Products"
                    ? setProductEdit(null)
                    : setContentEdit(null)
                }
              >
                <Plus size={16} /> Add{" "}
                {tab === "Products"
                  ? "product"
                  : tab === "Reels"
                    ? "Reel"
                    : "session"}
              </button>
            </div>
          )}
          {tab === "Administrators" && (
            <button className="btn" onClick={() => setAdminForm(true)}>
              <Plus size={16} /> Add administrator
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="notice form-error">
            {error}
          </p>
        )}
        {feedback && (
          <p role="status" className="notice">
            {feedback}
          </p>
        )}
        {!data ? (
          <p>Loading business records…</p>
        ) : (
          <>
            {tab === "Overview" && (
              <>
                <div className="stats">
                  {[
                    "Total products",
                    "Published products",
                    "New inquiries",
                    "Pending viewing requests",
                    "Customization requests",
                    "Completed live sessions",
                    "Ready videos",
                  ].map((label, i) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{data.counts[i]}</strong>
                    </div>
                  ))}
                </div>
                <p>
                  Publish only approved business information. Dates and
                  appointment times use Asia/Manila.
                </p>
              </>
            )}
            {tab === "Products" && (
              <>
                {productEdit !== undefined && (
                  <ProductEditor
                    key={productEdit?.id || "new"}
                    value={productEdit}
                    data={data}
                    onSave={save}
                    onClose={() => setProductEdit(undefined)}
                    onRefresh={refresh}
                  />
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Availability</th>
                        <th>Publication</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.map((p) => (
                        <tr key={p.id}>
                          <td data-label="Product">
                            {p.name}{" "}
                            {p.isDemo && <span className="badge">Demo</span>}
                          </td>
                          <td data-label="Price">
                            {money(p.price === null ? null : Number(p.price))}
                          </td>
                          <td data-label="Availability">{p.availability}</td>
                          <td data-label="Publication">
                            {p.archived
                              ? "Archived"
                              : p.published
                                ? "Published"
                                : "Unpublished"}
                          </td>
                          <td data-label="Actions">
                            <div className="button-row">
                              <button
                                className="text-link"
                                onClick={() => {
                                  setProductEdit(p);
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                Edit {p.name}
                              </button>
                              <button
                                aria-label={`Archive ${p.name}`}
                                onClick={() => void remove("products", p.id)}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "Categories" && (
              <>
                <form
                  className="admin-editor"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fields = Object.fromEntries(
                      new FormData(form),
                    ) as Record<string, string>;
                    if (
                      await save("categories", {
                        name: fields.name,
                        slug: slugify(fields.name),
                      })
                    )
                      form.reset();
                  }}
                >
                  <label>
                    Category name
                    <input name="name" required />
                  </label>
                  <button className="btn">Add category</button>
                </form>
                {data.categories.map((c) => (
                  <div key={c.id} className="ordered-media-row">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fields = Object.fromEntries(
                          new FormData(e.currentTarget),
                        ) as Record<string, string>;
                        await save("categories", {
                          id: c.id,
                          name: fields.name,
                          slug: slugify(fields.name),
                        });
                      }}
                    >
                      <input
                        name="name"
                        aria-label={`Category ${c.name}`}
                        defaultValue={c.name}
                        required
                      />
                      <button className="text-link">Save category</button>
                    </form>
                    <button
                      aria-label={`Delete category ${c.name}`}
                      onClick={() => void remove("categories", c.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </>
            )}
            {["Inquiries", "Viewings", "Customization"].includes(tab) && (
              <>
                <form
                  className="catalog-toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void refresh();
                  }}
                >
                  <input
                    type="search"
                    aria-label="Search customer requests"
                    placeholder="Search name, email or message"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button className="btn outline">Search</button>
                </form>
                {requests.map((row) => (
                  <details className="request-card" key={row.id}>
                    <summary>
                      <div>
                        <strong>{row.name}</strong>
                        <span>
                          {row.product?.name || row.type || row.jewelry}
                        </span>
                      </div>
                      <span className="badge">{row.status}</span>
                    </summary>
                    <div className="request-body">
                      <p>
                        <a href={`mailto:${row.email}`}>{row.email}</a> ·{" "}
                        <a href={`tel:${row.mobile}`}>{row.mobile}</a>
                      </p>
                      <p className="small">
                        Received {manilaLabel(row.createdAt)}
                      </p>
                      {row.slot && (
                        <p>Requested time: {manilaLabel(row.slot.startsAt)}</p>
                      )}
                      {row.location && <p>{row.location}</p>}
                      <p className="preserve-lines">{row.message}</p>
                      {[row.jewelry, row.metal, row.gemstone, row.budget]
                        .filter(Boolean)
                        .map((text, i) => (
                          <p key={i}>{text}</p>
                        ))}
                      {row.references?.map((file, i) => (
                        <a
                          className="btn outline"
                          key={file.assetId}
                          href={`/api/media/${file.assetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open private reference {i + 1}
                        </a>
                      ))}
                      <label>
                        Update status
                        <select
                          value={row.status}
                          onChange={(e) =>
                            void save(resource, {
                              id: row.id,
                              status: e.target.value,
                            })
                          }
                        >
                          {(tab === "Viewings"
                            ? ["Pending", "Confirmed", "Completed", "Cancelled"]
                            : tab === "Customization"
                              ? [
                                  "New",
                                  "Contacted",
                                  "In Progress",
                                  "Completed",
                                  "Closed",
                                ]
                              : ["New", "Contacted", "Closed"]
                          ).map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>
                ))}
                {!requests.length && <p>No matching requests.</p>}
                {tab === "Viewings" && (
                  <section className="admin-editor">
                    <h2>Availability</h2>
                    <p className="small">
                      Pending and confirmed requests occupy capacity. Cancelling
                      a request releases its slot. Blocking a date hides it from
                      new requests; existing customers must be contacted
                      separately.
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget,
                          fields = Object.fromEntries(
                            new FormData(form),
                          ) as Record<string, string>;
                        if (
                          await save("slots", {
                            startsAt: new Date(
                              `${fields.startsAt}:00+08:00`,
                            ).toISOString(),
                            capacity: Number(fields.capacity),
                            enabled: true,
                          })
                        )
                          form.reset();
                      }}
                    >
                      <div className="form-row">
                        <label>
                          Available time (Asia/Manila)
                          <input
                            type="datetime-local"
                            name="startsAt"
                            required
                          />
                        </label>
                        <label>
                          Capacity
                          <input
                            type="number"
                            min="1"
                            max="100"
                            name="capacity"
                            defaultValue="1"
                            required
                          />
                        </label>
                      </div>
                      <button className="btn">Add available slot</button>
                    </form>
                    {data.slots.map((slot) => (
                      <div className="ordered-media-row" key={slot.id}>
                        <span>
                          {manilaLabel(slot.startsAt)} · capacity{" "}
                          {slot.capacity}
                        </span>
                        <details>
                          <summary>Edit time / capacity</summary>
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const fields = Object.fromEntries(
                                new FormData(e.currentTarget),
                              ) as Record<string, string>;
                              await save("slots", {
                                id: slot.id,
                                startsAt: new Date(
                                  `${fields.startsAt}:00+08:00`,
                                ).toISOString(),
                                capacity: Number(fields.capacity),
                                enabled: slot.enabled,
                              });
                            }}
                          >
                            <label>
                              Time (Asia/Manila)
                              <input
                                type="datetime-local"
                                name="startsAt"
                                required
                                defaultValue={new Date(
                                  new Date(slot.startsAt).getTime() +
                                    8 * 3600000,
                                )
                                  .toISOString()
                                  .slice(0, 16)}
                              />
                            </label>
                            <label>
                              Capacity
                              <input
                                type="number"
                                min="1"
                                max="100"
                                name="capacity"
                                required
                                defaultValue={slot.capacity}
                              />
                            </label>
                            <p className="small">
                              Contact existing customers before changing their
                              requested time.
                            </p>
                            <button className="btn outline">Save slot</button>
                          </form>
                        </details>
                        <button
                          className="text-link"
                          onClick={() =>
                            void save("slots", {
                              id: slot.id,
                              startsAt: slot.startsAt,
                              capacity: slot.capacity,
                              enabled: !slot.enabled,
                            })
                          }
                        >
                          {slot.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          aria-label={`Delete slot ${slot.id}`}
                          onClick={() => void remove("slots", slot.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <form
                      className="block-date-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fields = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        await save("blocked", fields);
                      }}
                    >
                      <h3>Block a date</h3>
                      <label>
                        Date
                        <input type="date" name="date" required />
                      </label>
                      <label>
                        Reason (private)
                        <input name="reason" />
                      </label>
                      <button className="btn outline">Block date</button>
                    </form>
                    {data.blocked.map((date) => (
                      <div className="ordered-media-row" key={date.date}>
                        <span>
                          {date.date} · {date.reason}
                        </span>
                        <button
                          className="text-link"
                          onClick={() => void remove("blocked", date.date)}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
            {["Live Selling", "Reels"].includes(tab) && (
              <>
                {contentEdit !== undefined && (
                  <ContentEditor
                    key={contentEdit?.id || "new"}
                    kind={tab === "Live Selling" ? "sessions" : "reels"}
                    value={contentEdit}
                    data={data}
                    onSave={save}
                    onRefresh={refresh}
                    onClose={() => setContentEdit(undefined)}
                  />
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Publication</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tab === "Live Selling"
                        ? data.sessions
                        : data.reels
                      ).map((row) => (
                        <tr key={row.id}>
                          <td data-label="Title">
                            {row.title}
                            {"startsAt" in row && (
                              <p>
                                {manilaLabel(row.startsAt)} · {row.status}
                              </p>
                            )}
                          </td>
                          <td data-label="Publication">
                            {row.published ? "Published" : "Unpublished"}
                          </td>
                          <td data-label="Actions">
                            <div className="button-row">
                              <button
                                className="text-link"
                                onClick={() => setContentEdit(row)}
                              >
                                Edit {row.title}
                              </button>
                              <button
                                aria-label={`Delete ${row.title}`}
                                onClick={() =>
                                  void remove(
                                    tab === "Live Selling"
                                      ? "sessions"
                                      : "reels",
                                    row.id,
                                  )
                                }
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "Media Library" && (
              <>
                <p className="small">
                  Select the appropriate upload in Products, Live Selling, Reels
                  or Certificates. A failed provider connection never marks a
                  file ready. Referenced files must be detached before deletion.
                </p>
                {data.assets.map((asset) => (
                  <div className="request-card" key={asset.id}>
                    <div className="request-body">
                      <strong>{asset.filename}</strong>
                      <p>
                        {asset.purpose} · {asset.provider} · {asset.state}
                      </p>
                      {asset.error && <p>{asset.error}</p>}
                      <div className="button-row">
                        {asset.state === "ready" &&
                          asset.provider !== "stream" && (
                            <a
                              className="text-link"
                              href={`/api/media/${asset.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open file
                            </a>
                          )}
                        {asset.provider === "stream" && (
                          <button
                            className="text-link"
                            onClick={async () => {
                              try {
                                await api("/api/uploads", {
                                  action: "status",
                                  id: asset.id,
                                });
                                await refresh();
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Check processing
                          </button>
                        )}
                        <button
                          className="text-link"
                          onClick={async () => {
                            if (
                              !confirm(
                                "Permanently delete this unreferenced file from storage?",
                              )
                            )
                              return;
                            try {
                              await api("/api/uploads", {
                                action: "delete",
                                id: asset.id,
                              });
                              await refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Delete file
                        </button>
                      </div>
                      {asset.state === "ready" &&
                        asset.provider === "stream" && (
                          <details>
                            <summary>Preview recording</summary>
                            <MediaPlayer
                              assetId={asset.id}
                              provider={asset.provider}
                            />
                          </details>
                        )}
                    </div>
                  </div>
                ))}
              </>
            )}
            {tab === "Website Settings" && (
              <form
                className="admin-editor"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fields = Object.fromEntries(
                    new FormData(e.currentTarget),
                  ) as Record<string, string>;
                  await save("settings", {
                    businessName: fields.businessName,
                    instagram: fields.instagram,
                    facebook: fields.facebook,
                    email: fields.email,
                    mobile: fields.mobile,
                    location: fields.location,
                    meetup: fields.meetup,
                    logo: logo ?? fields.logo,
                    footerLogo: fields.footerLogo,
                    policies: Object.fromEntries(
                      policyFields.map(([key]) => [
                        key,
                        fields[`policy.${key}`],
                      ]),
                    ),
                  });
                }}
              >
                <h2>Business information</h2>
                <UploadControl
                  purpose="branding"
                  onComplete={(id) => setLogo(`/api/media/${id}`)}
                />
                {[
                  ["businessName", "Business name"],
                  ["instagram", "Instagram profile URL"],
                  ["facebook", "Facebook page URL"],
                  ["email", "Public email (optional)"],
                  ["mobile", "Public contact number (optional)"],
                  ["location", "Viewing location"],
                  ["meetup", "Meetup information"],
                  ["logo", "Header logo URL (optional)"],
                  ["footerLogo", "Footer logo URL (optional)"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    {key === "logo" ? (
                      <input
                        name={key}
                        value={logo ?? data.settings.logo}
                        onChange={(e) => setLogo(e.target.value)}
                      />
                    ) : (
                      <input
                        name={key}
                        defaultValue={String(
                          data.settings[key as keyof Settings] || "",
                        )}
                      />
                    )}
                  </label>
                ))}
                <h2>Approved shared policies</h2>
                <p>
                  Publish only client-approved information. Blank layaway,
                  payment and delivery sections stay hidden. Product-specific
                  text takes precedence.
                </p>
                <Policies values={data.settings.policies} />
                <button className="btn">Save website settings</button>
              </form>
            )}
            {tab === "Administrators" && data.viewer.role === "OWNER" && (
              <>
                {adminForm && (
                  <form
                    className="admin-editor"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fields = Object.fromEntries(
                        new FormData(e.currentTarget),
                      ) as Record<string, string>;
                      if (
                        await save("admins", {
                          action: "create",
                          email: fields.email,
                          password: fields.password,
                          role: fields.role,
                        })
                      ) {
                        e.currentTarget.reset();
                        setAdminForm(false);
                      }
                    }}
                  >
                    <h2>New administrator</h2>
                    <label>
                      Email
                      <input name="email" type="email" maxLength={200} required />
                    </label>
                    <label>
                      Password (14+ characters)
                      <input name="password" type="password" minLength={14} required />
                    </label>
                    <label>
                      Role
                      <select name="role" defaultValue="ADMIN">
                        <option value="ADMIN">Administrator</option>
                        <option value="OWNER">Owner</option>
                      </select>
                    </label>
                    <button className="btn">Create administrator</button>
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => setAdminForm(false)}
                    >
                      Cancel
                    </button>
                  </form>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Added</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.admins.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Email">
                            {row.email}
                            {row.id === data.viewer.id && " (you)"}
                          </td>
                          <td data-label="Role">
                            <select
                              value={row.role}
                              disabled={row.id === data.viewer.id}
                              onChange={(e) =>
                                save("admins", {
                                  action: "update",
                                  id: row.id,
                                  role: e.target.value,
                                })
                              }
                            >
                              <option value="ADMIN">Administrator</option>
                              <option value="OWNER">Owner</option>
                            </select>
                          </td>
                          <td data-label="Status">
                            {row.active ? "Active" : "Disabled"}
                          </td>
                          <td data-label="Added">{manilaLabel(row.createdAt)}</td>
                          <td data-label="Actions">
                            <button
                              className="btn outline"
                              disabled={row.id === data.viewer.id}
                              onClick={async () => {
                                if (
                                  !confirm(
                                    row.active
                                      ? `Disable ${row.email}? They will be signed out immediately.`
                                      : `Enable ${row.email}?`,
                                  )
                                )
                                  return;
                                await save("admins", {
                                  action: "update",
                                  id: row.id,
                                  active: !row.active,
                                });
                              }}
                            >
                              {row.active ? "Disable" : "Enable"}
                            </button>
                            {row.id !== data.viewer.id && (
                              <details>
                                <summary>Reset password</summary>
                                <form
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const fields = Object.fromEntries(
                                      new FormData(e.currentTarget),
                                    ) as Record<string, string>;
                                    if (
                                      await save("admins", {
                                        action: "resetPassword",
                                        id: row.id,
                                        password: fields.password,
                                      })
                                    )
                                      e.currentTarget.reset();
                                  }}
                                >
                                  <label>
                                    New password (14+ characters)
                                    <input
                                      name="password"
                                      type="password"
                                      minLength={14}
                                      required
                                    />
                                  </label>
                                  <button className="btn">Reset password</button>
                                </form>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Owners can manage administrator accounts. Disabling an account
                  or resetting its password signs that person out immediately.
                </p>
              </>
            )}
            {data.hasMore && (
              <button
                className="btn outline"
                onClick={async () => {
                  try {
                    const next = await api<Data>(
                      `/api/admin/data?q=${encodeURIComponent(data.query)}&page=${data.page + 1}`,
                    );
                    const merge = <T extends { id: string }>(a: T[], b: T[]) =>
                      Array.from(
                        new Map(
                          [...a, ...b].map((row) => [row.id, row]),
                        ).values(),
                      );
                    setData({
                      ...next,
                      products: merge(data.products, next.products),
                      inquiries: merge(data.inquiries, next.inquiries),
                      appointments: merge(data.appointments, next.appointments),
                      customizations: merge(
                        data.customizations,
                        next.customizations,
                      ),
                      slots: merge(data.slots, next.slots),
                      sessions: merge(data.sessions, next.sessions),
                      reels: merge(data.reels, next.reels),
                      assets: merge(data.assets, next.assets),
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Load more records
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
