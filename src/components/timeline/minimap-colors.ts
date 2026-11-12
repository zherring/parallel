import type { WindowRect } from "@/lib/minimap";

/** Keep each hue, but reserve its full saturation for films in the main viewport. */
export const MINIMAP_COLOR = "saturate-[0.25] data-[in-view]:saturate-100";

/** Called by both minimaps' frame-throttled scroll sync, without a React render. */
export function syncMinimapColors(track: HTMLElement | null, window: WindowRect) {
  track?.querySelectorAll<HTMLElement>("[data-minimap-fraction]").forEach((mark) => {
    const fraction = Number(mark.dataset.minimapFraction);
    const visible = fraction >= window.left && fraction <= window.left + window.width;
    if (mark.hasAttribute("data-in-view") !== visible) mark.toggleAttribute("data-in-view", visible);
  });
}
