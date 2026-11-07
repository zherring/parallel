import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrackModeToggle, type TrackMode } from "./track-mode-toggle";

describe("TrackModeToggle", () => {
  it.each([
    ["combined", "true", "lucide-layers", "Switch to separate lanes"],
    ["separate", "false", "lucide-rows-2", "Switch to combined layout"],
  ] as const)("shows one icon button for the %s layout", (mode, pressed, icon, action) => {
    const html = renderToStaticMarkup(createElement(TrackModeToggle, { mode, onChange: () => {} }));
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Combined timeline"');
    expect(html).toContain(`aria-pressed="${pressed}"`);
    expect(html).toContain(icon);
    expect(html).toContain(action);
    expect(html).not.toContain('role="group"');
    expect(html).toContain("text-muted");
    expect(html).not.toContain("text-accent-green");
  });

  it.each([
    ["combined", "separate"],
    ["separate", "combined"],
  ] satisfies [TrackMode, TrackMode][])("switches from %s to %s", (mode, next) => {
    const onChange = vi.fn();
    const button = TrackModeToggle({ mode, onChange });
    button.props.onClick();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
  });
});
