"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Spike (zherring/spike-portraits): the cut-paper portrait treatment in the real pages, behind `?portrait=montage` or `?portrait=color`.
 * The flag is remembered for the tab (sessionStorage), so it stays on while the visitor clicks from pair to pair, whose links do not carry it;
 * `?portrait=off` forgets it. Without the flag in the address or the tab's memory, nothing changes.
 */
export const PORTRAIT_MODES = ["montage", "color"] as const;
export type PortraitMode = (typeof PORTRAIT_MODES)[number];

const STORAGE_KEY = "spike-portrait";

function parseMode(value: string | null | undefined): PortraitMode | null {
  return PORTRAIT_MODES.find((mode) => mode === value) ?? null;
}

function readStored(): PortraitMode | null {
  try {
    return parseMode(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

/** The treatment the address asks for, else the one this tab last asked for; null for the app as it is. */
export function usePortraitMode(): PortraitMode | null {
  const value = useSearchParams()?.get("portrait") ?? null;
  const fromUrl = parseMode(value);
  // The server (and the hydrating render) has no tab memory, so a remembered flag shows after hydration.
  const stored = useSyncExternalStore(subscribe, readStored, () => null);

  useEffect(() => {
    try {
      if (value === "off") sessionStorage.removeItem(STORAGE_KEY);
      else if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // No storage (a private window): the flag works on the page that names it.
    }
  }, [value, fromUrl]);

  if (value === "off") return null;
  return fromUrl ?? stored;
}
