"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Product } from "@/lib/data";
import type { Settings } from "@/lib/settings";
type Store = {
  products: Product[];
  categories: string[];
  settings: Settings;
  wishlist: string[];
  ready: boolean;
  error: string;
  toggleWish: (id: string) => void;
  refresh: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({
  children,
  initialProducts,
  initialCategories,
  initialSettings,
}: {
  children: ReactNode;
  initialProducts: Product[];
  initialCategories: string[];
  initialSettings: Settings;
}) {
  const [products, setProducts] = useState(initialProducts),
    [categories, setCategories] = useState(initialCategories),
    [settings, setSettings] = useState(initialSettings),
    [wishlist, setWishlist] = useState<string[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem("rk-wishlist") || "[]");
      if (Array.isArray(ids))
        setWishlist(ids.filter((id) => typeof id === "string"));
    } catch {
      /* Wishlist storage is optional. */
    }
    setReady(true);
  }, []);
  async function refresh() {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setProducts(data.products);
      setCategories(data.categories.map((c: { name: string }) => c.name));
      setSettings(data.settings);
      setError("");
    } catch {
      setError("The collection could not be refreshed. Please try again.");
    }
  }
  useEffect(() => {
    void refresh();
  }, [pathname]);
  function toggleWish(id: string) {
    const next = wishlist.includes(id)
      ? wishlist.filter((x) => x !== id)
      : [...wishlist, id];
    setWishlist(next);
    try {
      localStorage.setItem("rk-wishlist", JSON.stringify(next));
    } catch {
      /* The current page remains usable without persistent wishlist storage. */
    }
  }
  return (
    <Context.Provider
      value={{
        products,
        categories,
        settings,
        wishlist: wishlist.filter((id) =>
          products.some((product) => product.id === id),
        ),
        error,
        ready,
        toggleWish,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw Error("Store missing");
  return value;
}
