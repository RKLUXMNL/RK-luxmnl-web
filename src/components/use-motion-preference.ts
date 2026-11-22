"use client";
import { useSyncExternalStore } from "react";
const subscribe = (listener: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const snapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Match the server during hydration, then read the real device preference.
export function useMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
