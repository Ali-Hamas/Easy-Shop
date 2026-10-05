"use client";
import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;
/** Start static on the server and during hydration; activate motion after preferences resolve. */
export const useMotionPreference = () =>
  useSyncExternalStore(subscribe, snapshot, () => true);
