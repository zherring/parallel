import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LANES_ENABLED } from "@/lib/film-prefs";
import { LayoutToggle, type Layout } from "./layout-toggle";

const render = (props: Partial<Parameters<typeof LayoutToggle>[0]> = {}) =>
  renderToStaticMarkup(createElement(LayoutToggle, { layout: "combined", several: true, onChange: () => {}, ...props }));

describe("LayoutToggle", () => {
  it("is one group of two icon buttons for several people while Lanes are parked: Focus and Combined, in that order", () => {
    const html = render();
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Timeline layout"');
    expect(html.match(/<button\b/g)).toHaveLength(2);
    const labels = [...html.matchAll(/aria-label="([^"]+)" aria-pressed/g)].map((match) => match[1]);
    expect(labels).toEqual(["Focus view", "Combined timeline"]);
    for (const icon of ["lucide-focus", "lucide-layers"]) expect(html).toContain(icon);
    // The option is hidden, not gone: it is the flag (`LANES_ENABLED`) that keeps it off.
    expect(LANES_ENABLED).toBe(false);
    expect(html).not.toContain("Separate lanes");
    expect(html).not.toContain("lucide-rows-2");
  });

  it("brings the Lanes option back for several people when it is turned on: Focus, Combined and Lanes", () => {
    const html = render({ lanes: true });
    expect(html.match(/<button\b/g)).toHaveLength(3);
    const labels = [...html.matchAll(/aria-label="([^"]+)" aria-pressed/g)].map((match) => match[1]);
    expect(labels).toEqual(["Focus view", "Combined timeline", "Separate lanes"]);
    expect(html).toContain("lucide-rows-2");
  });

  it("gives every button a title and presses the current layout only", () => {
    for (const [layout, pressed] of [
      ["focus", [true, false]],
      ["combined", [false, true]],
      // Lanes parked: a held "separate" presses nothing (the pages show it as the combined one, see `effectiveTrackMode`).
      ["separate", [false, false]],
    ] as const) {
      const html = render({ layout });
      expect([...html.matchAll(/aria-pressed="(true|false)"/g)].map((match) => match[1] === "true")).toEqual(pressed);
      expect(html.match(/\btitle="/g)).toHaveLength(2);
    }
    const lanes = render({ layout: "separate", lanes: true });
    expect([...lanes.matchAll(/aria-pressed="(true|false)"/g)].map((match) => match[1] === "true")).toEqual([false, false, true]);
  });

  it("offers one person Focus and the flat Timeline: there is no choice of lanes, turned on or not", () => {
    for (const lanes of [false, true]) {
      const html = render({ several: false, layout: "combined", lanes });
      expect(html.match(/<button\b/g)).toHaveLength(2);
      expect(html).toContain('aria-label="Timeline"');
      expect(html).not.toContain("Separate lanes");
    }
  });

  it("writes the words beside the icons only when asked to", () => {
    expect(render()).not.toMatch(/>Focus</);
    const labelled = render({ labelled: true });
    for (const word of ["Focus", "Combined"]) expect(labelled).toContain(`>${word}<`);
    expect(labelled).not.toContain(">Lanes<");
    expect(render({ labelled: true, lanes: true })).toContain(">Lanes<");
    expect(render({ labelled: true, several: false })).toContain(">Timeline<");
  });

  it("reports the layout whose button is pressed", () => {
    const onChange = vi.fn();
    const group = LayoutToggle({ layout: "combined", several: true, lanes: true, onChange }) as { props: { children: { props: { onClick: () => void } }[] } };
    const [focus, combined, lanes] = group.props.children;
    lanes.props.onClick();
    focus.props.onClick();
    combined.props.onClick();
    expect(onChange.mock.calls.map(([layout]) => layout satisfies Layout)).toEqual(["separate", "focus", "combined"]);
  });
});
